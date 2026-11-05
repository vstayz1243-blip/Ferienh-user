import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let feedServer;
let appProcess;
let baseUrl;
let validDate;
let checkoutDate;
let stderr = '';

async function listen(server) {
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    return server.address().port;
}

async function getFreePort() {
    const server = createServer();
    const port = await listen(server);
    await new Promise((resolve) => server.close(resolve));
    return port;
}

async function waitForHealth(url) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (appProcess.exitCode !== null) {
            throw new Error(`API process exited early (code ${appProcess.exitCode}): ${stderr}`);
        }
        try {
            const response = await fetch(url + '/api/health');
            if (response.ok) return;
        } catch {}
        await delay(100);
    }
    throw new Error(`API did not become ready: ${stderr}`);
}

before(async () => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 10);
    validDate = start.toISOString().slice(0, 10).replaceAll('-', '');
    const checkout = new Date(start);
    checkout.setUTCDate(checkout.getUTCDate() + 2);
    checkoutDate = checkout.toISOString().slice(0, 10).replaceAll('-', '');

    const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Ferienhaus Tests//DE',
        'BEGIN:VEVENT',
        'UID:integration-booking@example.test',
        'DTSTAMP:20260101T120000Z',
        `DTSTART;VALUE=DATE:${validDate}`,
        `DTEND;VALUE=DATE:${checkoutDate}`,
        'SUMMARY:Test booking',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    feedServer = createServer((request, response) => {
        response.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8' });
        response.end(request.url === '/invalid' ? 'not an ical feed' : ics);
    });
    const feedPort = await listen(feedServer);
    const appPort = await getFreePort();

    baseUrl = `http://127.0.0.1:${appPort}`;
    appProcess = spawn(process.execPath, ['server.mjs'], {
        cwd: ROOT,
        env: {
            ...process.env,
            PORT: String(appPort),
            HP_ICAL_141_URL: `http://127.0.0.1:${feedPort}/valid`,
            HP_ICAL_136_URL: `http://127.0.0.1:${feedPort}/invalid`
        },
        stdio: ['ignore', 'ignore', 'pipe']
    });
    appProcess.stderr.setEncoding('utf8');
    appProcess.stderr.on('data', (chunk) => { stderr += chunk; });
    await waitForHealth(baseUrl);
});

after(async () => {
    if (appProcess && appProcess.exitCode === null) {
        appProcess.kill('SIGTERM');
        await Promise.race([
            new Promise((resolve) => appProcess.once('exit', resolve)),
            delay(2000)
        ]);
    }
    if (feedServer?.listening) {
        await new Promise((resolve) => feedServer.close(resolve));
    }
});

test('health endpoint returns HTTP 200', async () => {
    const response = await fetch(baseUrl + '/api/health');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
});

test('availability endpoint parses iCalendar and caches the result', async () => {
    const firstResponse = await fetch(baseUrl + '/api/availability?house=141');
    assert.equal(firstResponse.status, 200);
    const first = await firstResponse.json();
    const startIso = `${validDate.slice(0, 4)}-${validDate.slice(4, 6)}-${validDate.slice(6, 8)}`;
    const checkoutIso = `${checkoutDate.slice(0, 4)}-${checkoutDate.slice(4, 6)}-${checkoutDate.slice(6, 8)}`;

    assert.equal(first.house, '141');
    assert.equal(first.bookedDates.includes(startIso), true);
    assert.equal(first.bookedDates.includes(checkoutIso), false);
    assert.equal(first.cached, false);

    const secondResponse = await fetch(baseUrl + '/api/availability?house=141');
    assert.equal(secondResponse.status, 200);
    assert.equal((await secondResponse.json()).cached, true);
});

test('malformed iCalendar feed returns a controlled 502 response', async () => {
    const response = await fetch(baseUrl + '/api/availability?house=136');
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /valid iCalendar/i);
});

test('unknown house is rejected with HTTP 400', async () => {
    const response = await fetch(baseUrl + '/api/availability?house=999');
    assert.equal(response.status, 400);
});

test('unsupported API method is rejected with HTTP 405', async () => {
    const response = await fetch(baseUrl + '/api/availability?house=141', { method: 'POST' });
    assert.equal(response.status, 405);
});

test('static homepage is served successfully', async () => {
    const response = await fetch(baseUrl + '/');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /Ferienhaus/i);
});
