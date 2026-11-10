import { test, expect } from '@playwright/test';

function dateOffset(days) {
    const value = new Date();
    value.setDate(value.getDate() + days);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

test.beforeEach(async ({ page }) => {
    const bookedDate = dateOffset(5);

    // Keep the browser suite deterministic and independent from private H&P feeds.
    await page.route('**/api/availability**', async (route) => {
        const house = new URL(route.request().url()).searchParams.get('house');
        if (!['141', '136'].includes(house)) {
            await route.fulfill({ status: 400, json: { error: 'Invalid house' } });
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            json: {
                house,
                bookedDates: [bookedDate],
                fetchedAt: new Date().toISOString(),
                rangeMonths: 18,
                cached: false
            }
        });
    });

    // External fonts, stock images and animation CDN are not required for functional tests.
    await page.route('https://**/*', (route) => route.abort());
});

test('homepage renders the landing page and links to both main sections', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Ferienhäuser 141 \/ 136/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Rein ins Gefühl');
    await expect(page.locator('.home-house-promo')).toHaveCount(1);
    await expect(page.locator('#nearby-highlights .nearby-card')).toHaveCount(3);
    await expect(page.locator('#dreiwelten-bottom')).toBeVisible();
    await page.goto('/auszeit');
    await expect(page.locator('#dreiwelten')).toBeVisible();
    await expect(page.locator('#idee')).toBeVisible();
    await page.goto('/haeuser');
    await expect(page.locator('.house-card')).toHaveCount(2);
    await page.goto('/kontakt');
    await expect(page.locator('#contactForm')).toBeVisible();
});

test('both detail pages can be opened directly', async ({ page }) => {
    await page.goto('/ferienhaus-141.html');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('141');
    await expect(page.locator('.detail-booking a').first()).toHaveAttribute(
        'href',
        /etlink\.hptouristik\.de/
    );

    await page.goto('/ferienhaus-136.html');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('136');
    await expect(page.locator('.detail-booking a').first()).toHaveAttribute(
        'href',
        /etlink\.hptouristik\.de/
    );
});

test('desktop navigation links to the main sections', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'The mobile menu has a dedicated test.');
    await page.goto('/');
    const navigation = page.locator('#main-navigation');
    await expect(navigation.getByRole('link', { name: 'Unsere Häuser' })).toHaveAttribute('href', '/haeuser');
    await expect(navigation.getByRole('link', { name: 'Die Auszeit' })).toHaveAttribute('href', '/auszeit');
    await expect(navigation.getByRole('link', { name: 'Kontakt' })).toHaveAttribute('href', '/kontakt');
});

test('mobile navigation opens and closes after selecting a section', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Only the mobile project has a collapsible navigation.');
    await page.goto('/');
    const toggle = page.locator('.menu-toggle');
    const navigation = page.locator('#main-navigation');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(navigation).toHaveClass(/is-open/);

    await navigation.getByRole('link', { name: 'Unsere Häuser' }).click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(navigation).not.toHaveClass(/is-open/);
    await expect(page).toHaveURL(/\/haeuser$/);
});

test('calendar loads availability for both houses', async ({ page }) => {
    await page.goto('/haeuser');
    for (const house of ['141', '136']) {
        const calendar = page.locator(`[data-calendar-house="${house}"]`);
        await expect(calendar.locator('[data-calendar-status]')).toContainText('Live-Daten von H&P geladen');
        await expect(calendar.locator('.calendar-day.is-booked')).toHaveCount(1);
        await expect(calendar.locator('.calendar-day.is-unknown')).toHaveCount(0);
    }
});

test('calendar month navigation moves forward and backward', async ({ page }) => {
    await page.goto('/haeuser');
    const calendar = page.locator('[data-calendar-house="141"]');
    const month = calendar.locator('[data-calendar-month]');
    const initialMonth = await month.innerText();

    await calendar.locator('[data-calendar-next]').click();
    await expect(month).not.toHaveText(initialMonth);

    await calendar.locator('[data-calendar-prev]').click();
    await expect(month).toHaveText(initialMonth);
});

test('calendar displays a controlled error when the API is unavailable', async ({ page }) => {
    await page.unroute('**/api/availability**');
    await page.route('**/api/availability**', (route) =>
        route.fulfill({ status: 503, contentType: 'application/json', json: { error: 'Feed unavailable' } })
    );

    await page.goto('/haeuser');
    const status = page.locator('[data-calendar-house="141"] [data-calendar-status]');
    await expect(status).toContainText('Live-Daten aktuell nicht erreichbar');
    await expect(status).toHaveAttribute('data-state', 'error');
    await expect(page.locator('[data-calendar-house="141"] .calendar-day.is-unknown').first()).toBeVisible();
});

test('gallery changes slides with its controls', async ({ page }) => {
    await page.goto('/haeuser');
    const gallery = page.locator('.house-gallery').first();
    const slides = gallery.locator('[data-gallery-image]');
    await expect(slides.first()).toHaveClass(/is-active/);

    await gallery.locator('.gallery-arrow-next').click({ force: true });
    await expect(slides.nth(1)).toHaveClass(/is-active/);

    await gallery.locator('.gallery-arrow-prev').click({ force: true });
    await expect(slides.first()).toHaveClass(/is-active/);
});

test('gallery automatically advances after five seconds', async ({ page }) => {
    await page.clock.install();
    await page.goto('/haeuser');
    const slides = page.locator('.house-gallery').first().locator('[data-gallery-image]');

    await expect(slides.nth(0)).toHaveClass(/is-active/);
    await page.clock.fastForward(5000);
    await expect(slides.nth(1)).toHaveClass(/is-active/);
});

test('gallery opens and closes the lightbox', async ({ page }) => {
    await page.goto('/haeuser');
    await page.locator('.house-gallery [data-gallery-image]').first().click();

    const lightbox = page.locator('#galleryLightbox');
    await expect(lightbox).toBeVisible();
    await expect(lightbox.locator('img')).toHaveAttribute('src', /images\.unsplash\.com/);

    await lightbox.getByRole('button', { name: 'Bildansicht schließen' }).click();
    await expect(lightbox).not.toBeVisible();
});

test('reduced-motion preference disables gallery autoplay', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await page.goto('/haeuser');
    const slides = page.locator('.house-gallery').first().locator('[data-gallery-image]');

    await page.clock.fastForward(10_000);
    await expect(slides.first()).toHaveClass(/is-active/);
    await expect(slides.nth(1)).not.toHaveClass(/is-active/);
});

test('house selection updates the H&P booking destination', async ({ page }) => {
    await page.goto('/kontakt');
    const house = page.locator('#house');
    const bookingLink = page.locator('#checkAvailabilityLink');

    await house.selectOption('Ferienhaus 136');
    await expect(bookingLink).toHaveAttribute('href', /62e926f3435840d9977847435863ebc0/);

    await house.selectOption('Ferienhaus 141');
    await expect(bookingLink).toHaveAttribute('href', /1828ce058f3e46a6b617ef0608db5af8/);
});

test('contact form calculates the stay duration', async ({ page }) => {
    await page.goto('/kontakt');
    await page.locator('#arrival').fill('2027-06-10');
    await page.locator('#departure').fill('2027-06-13');

    await expect(page.locator('#stayDuration')).toHaveText('3 Übernachtungen');
    await expect(page.locator('#stayNights')).toHaveText('3');
});

test('departure cannot be on or before arrival', async ({ page }) => {
    await page.goto('/kontakt');
    const arrival = page.locator('#arrival');
    const departure = page.locator('#departure');

    await arrival.fill('2027-06-10');
    await departure.fill('2027-06-10');
    await arrival.dispatchEvent('change');

    await expect(departure).toHaveValue('');
});

test('contact form rejects an invalid email address', async ({ page }) => {
    await page.goto('/kontakt');
    const email = page.locator('#email');
    await email.fill('not-an-email');

    const isValid = await email.evaluate((element) => element.checkValidity());
    expect(isValid).toBe(false);
});

test('house detail inquiry preselects the requested house', async ({ page }) => {
    await page.goto('/ferienhaus-136.html');
    await page.getByRole('link', { name: /Aufenthalt anfragen/ }).click();
    await expect(page).toHaveURL(/\/kontakt$/);
    await expect(page.locator('#house')).toHaveValue('Ferienhaus 136');
});

test('page has SEO metadata and meaningful image alternative text', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Ferienhäuser/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Ferienhaus/);

    const imagesWithoutAlt = await page.locator('img').evaluateAll((images) =>
        images.filter((image) => !image.hasAttribute('alt')).length
    );
    expect(imagesWithoutAlt).toBe(0);
});

test('layout does not overflow horizontally on desktop or mobile', async ({ page }) => {
    await page.goto('/');
    const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});
