import { test, expect } from '@playwright/test';

test('static responses include baseline security headers', async ({ request }) => {
    const response = await request.get('/');
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
});

test('environment and hidden repository files are not served', async ({ request }) => {
    for (const path of ['/.env', '/.git/config', '/.github/workflows/tests.yml']) {
        const response = await request.get(path);
        expect([403, 404]).toContain(response.status());
    }
});

test('encoded path traversal cannot read files outside the web root', async ({ request }) => {
    const response = await request.get('/%2e%2e%2f.env');
    expect([400, 403, 404]).toContain(response.status());
});

test('private H&P iCalendar feed URLs are not exposed in public frontend assets', async ({ request }) => {
    for (const path of ['/', '/site.js', '/ferienhaus-141.html', '/ferienhaus-136.html']) {
        const response = await request.get(path);
        expect(response.ok()).toBeTruthy();
        const body = await response.text();
        expect(body).not.toMatch(/api2\.hptouristik\.de\/api\/v1\/calendar/i);
    }
});

test('API errors do not return stack traces', async ({ request }) => {
    const response = await request.get('/api/availability?house=999');
    expect(response.status()).toBe(400);
    const body = await response.text();
    expect(body).not.toMatch(/at\s+\w+\s*\(|node_modules|Error:\s/);
});

test('contact form treats user input as a value rather than executable markup', async ({ page }) => {
    // Keep this security test independent from scroll-triggered reveal animations.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const contactForm = page.locator('#contactForm');
    await expect(contactForm).toHaveCount(1);
    await contactForm.scrollIntoViewIfNeeded();
    await expect(contactForm).toBeVisible();

    const nameField = contactForm.locator('#name');
    await expect(nameField).toBeVisible();

    const payload = '<img src=x onerror=alert(1)>';
    const dialogs = [];
    page.on('dialog', async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.dismiss();
    });

    await nameField.fill(payload);

    await expect(nameField).toHaveValue(payload);
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(dialogs).toEqual([]);
});
