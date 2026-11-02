import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ICAL from 'ical.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;
const RANGE_MONTHS = 18;

const feeds = {
    '141': process.env.HP_ICAL_141_URL,
    '136': process.env.HP_ICAL_136_URL
};

const cache = new Map();

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon'
};

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    });
    response.end(JSON.stringify(payload));
}

function dateKey(time) {
    return [
        String(time.year).padStart(4, '0'),
        String(time.month).padStart(2, '0'),
        String(time.day).padStart(2, '0')
    ].join('-');
}

function addEventDays(bookedDates, start, end, rangeStart, rangeEnd) {
    if (!start || !end) return;

    // iCalendar DTEND is exclusive. For timed events ending after midnight,
    // the end date itself is also occupied.
    const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day));
    const endBoundary = new Date(Date.UTC(end.year, end.month - 1, end.day));
    const hasTimeOnEndDate = !end.isDate && (end.hour !== 0 || end.minute !== 0 || end.second !== 0);
    if (hasTimeOnEndDate) endBoundary.setUTCDate(endBoundary.getUTCDate() + 1);

    const lowerBound = new Date(Date.UTC(rangeStart.year, rangeStart.month - 1, rangeStart.day));
    const upperBound = new Date(Date.UTC(rangeEnd.year, rangeEnd.month - 1, rangeEnd.day));

    while (cursor < endBoundary) {
        if (cursor >= lowerBound && cursor < upperBound) {
            bookedDates.add(cursor.toISOString().slice(0, 10));
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
}

function isCancelled(event) {
    const status = event.component.getFirstPropertyValue('status');
    return String(status || '').toUpperCase() === 'CANCELLED';
}

function collectEventDates(event, rangeStart, rangeEnd, bookedDates) {
    if (isCancelled(event)) return;

    if (event.isRecurring()) {
        // Expand from the original DTSTART. Starting the iterator at rangeStart
        // would change the recurrence anchor and can shift weekly/monthly rules.
        const iterator = event.iterator();
        let occurrence;
        let safetyCounter = 0;

        while ((occurrence = iterator.next()) && safetyCounter < 100000) {
            safetyCounter += 1;
            if (occurrence.compare(rangeEnd) >= 0) break;
            if (occurrence.compare(rangeStart) < 0) continue;

            const details = event.getOccurrenceDetails(occurrence);
            if (!isCancelled(details.item)) {
                addEventDays(bookedDates, details.startDate, details.endDate, rangeStart, rangeEnd);
            }
        }
        return;
    }

    addEventDays(bookedDates, event.startDate, event.endDate, rangeStart, rangeEnd);
}

function parseCalendar(icsText) {
    const parsed = ICAL.parse(icsText);
    const calendar = new ICAL.Component(parsed);
    const components = calendar.getAllSubcomponents('vevent');
    const events = components.map((component) => new ICAL.Event(component));
    const masters = events.filter((event) => !event.isRecurrenceException());
    const exceptions = events.filter((event) => event.isRecurrenceException());
    const now = new Date();
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + RANGE_MONTHS, now.getDate()));
    const rangeStart = ICAL.Time.fromJSDate(start, true);
    const rangeEnd = ICAL.Time.fromJSDate(end, true);
    const bookedDates = new Set();

    // Attach RECURRENCE-ID exceptions to their master events so moved and
    // cancelled occurrences are handled by ICAL.js during expansion.
    for (const exception of exceptions) {
        const master = masters.find((event) => event.uid === exception.uid && event.isRecurring());
        if (master) {
            try {
                master.relateException(exception);
            } catch (error) {
                console.warn('Skipping an invalid iCal recurrence exception:', error.message);
            }
        }
    }

    for (const event of masters) {
        try {
            collectEventDates(event, rangeStart, rangeEnd, bookedDates);
        } catch (error) {
            // Ignore malformed individual events, but keep valid events from the feed.
            console.warn('Skipping an invalid iCal event:', error.message);
        }
    }

    return [...bookedDates].sort();
}

async function getAvailability(house) {
    const cached = cache.get(house);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return { ...cached.payload, cached: true };
    }

    const feedUrl = feeds[house];
    if (!feedUrl) {
        const error = new Error(`The iCal feed for house ${house} is not configured on the server.`);
        error.statusCode = 503;
        throw error;
    }

    let response;
    try {
        response = await fetch(feedUrl, {
            headers: { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1' },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });
    } catch (cause) {
        const error = new Error('The H&P calendar feed could not be reached.');
        error.statusCode = 502;
        error.cause = cause;
        throw error;
    }

    if (!response.ok) {
        const error = new Error(`H&P returned HTTP ${response.status} for the calendar feed.`);
        error.statusCode = 502;
        throw error;
    }

    const icsText = await response.text();
    if (!icsText.includes('BEGIN:VCALENDAR')) {
        const error = new Error('The response from H&P is not a valid iCalendar feed.');
        error.statusCode = 502;
        throw error;
    }

    let bookedDates;
    try {
        bookedDates = parseCalendar(icsText);
    } catch (cause) {
        const error = new Error('The H&P calendar feed could not be parsed.');
        error.statusCode = 502;
        error.cause = cause;
        throw error;
    }

    const payload = {
        house,
        bookedDates,
        fetchedAt: new Date().toISOString(),
        rangeMonths: RANGE_MONTHS
    };
    cache.set(house, { payload, cachedAt: Date.now() });
    return { ...payload, cached: false };
}

async function handleApi(request, response, url) {
    if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'Method not allowed.' });
        return;
    }

    if (url.pathname === '/api/health') {
        sendJson(response, 200, { status: 'ok' });
        return;
    }

    if (url.pathname !== '/api/availability') {
        sendJson(response, 404, { error: 'API route not found.' });
        return;
    }

    const house = url.searchParams.get('house');
    if (!['141', '136'].includes(house)) {
        sendJson(response, 400, { error: 'Please provide house=141 or house=136.' });
        return;
    }

    try {
        sendJson(response, 200, await getAvailability(house));
    } catch (error) {
        console.error(`Availability API error for house ${house}:`, error.message);
        sendJson(response, error.statusCode || 500, { error: error.message });
    }
}

async function serveStatic(request, response, url) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' });
        response.end();
        return;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        response.writeHead(400);
        response.end('Bad request');
        return;
    }

    if (pathname === '/') pathname = '/index.html';
    const filePath = path.resolve(ROOT, `.${pathname}`);
    if (!filePath.startsWith(ROOT + path.sep) || pathname.split('/').some((part) => part.startsWith('.'))) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
    }

    try {
        const content = await readFile(filePath);
        const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        response.writeHead(200, {
            'Content-Type': contentType,
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        });
        if (request.method === 'HEAD') response.end();
        else response.end(content);
    } catch {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
    }
}

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
        await handleApi(request, response, url);
        return;
    }
    await serveStatic(request, response, url);
});

server.listen(PORT, () => {
    console.log(`Ferienhaus website running at http://localhost:${PORT}`);
    for (const house of ['141', '136']) {
        console.log(`H&P iCal feed for house ${house}: ${feeds[house] ? 'configured' : 'NOT configured'}`);
    }
});
