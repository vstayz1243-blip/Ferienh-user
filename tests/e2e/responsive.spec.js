import { test, expect } from '@playwright/test';

const viewports = [
    { width: 320, height: 640 },
    { width: 360, height: 800 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 414, height: 896 },
    { width: 430, height: 932 },
    { width: 540, height: 960 },
    { width: 768, height: 1024 },
    { width: 820, height: 1180 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 }
];

const pages = [
    '/',
    '/auszeit',
    '/haeuser',
    '/kontakt',
    '/ferienhaus-141.html',
    '/ferienhaus-136.html'
];

test.beforeEach(async ({ page }) => {
    await page.route('**/api/availability**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            json: {
                house: new URL(route.request().url()).searchParams.get('house'),
                bookedDates: [],
                fetchedAt: new Date().toISOString(),
                rangeMonths: 18,
                cached: false
            }
        })
    );

    // Layout tests do not depend on third-party image, font or animation CDNs.
    await page.route('https://**/*', (route) => route.abort());
});

for (const viewport of viewports) {
    test(`responsive layout at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop-chromium', 'The full viewport matrix runs once in desktop Chromium.');

        await page.setViewportSize(viewport);

        for (const path of pages) {
            await page.goto(path);
            await expect(page.locator('body')).toBeVisible();

            const layout = await page.evaluate(() => {
                const viewportWidth = document.documentElement.clientWidth;
                const documentWidth = document.documentElement.scrollWidth;
                const images = [...document.querySelectorAll('img')]
                    .filter((image) => image.getAttribute('src'))
                    .map((image) => {
                        const style = getComputedStyle(image);
                        const bounds = image.getBoundingClientRect();
                        return {
                            width: bounds.width,
                            objectFit: style.objectFit,
                            maxWidth: style.maxWidth
                        };
                    });

                return {
                    viewportWidth,
                    documentWidth,
                    images,
                    overflowingImages: images.filter((image) =>
                        image.width > viewportWidth + 1 ||
                        image.maxWidth !== '100%' ||
                        !['cover', 'contain'].includes(image.objectFit)
                    )
                };
            });

            expect(
                layout.documentWidth,
                `Horizontal overflow on ${path} at ${viewport.width}x${viewport.height}: document=${layout.documentWidth}, viewport=${layout.viewportWidth}`
            ).toBeLessThanOrEqual(layout.viewportWidth + 1);

            expect(
                layout.overflowingImages,
                `Images must stay within the viewport and use a non-distorting fit mode on ${path} at ${viewport.width}px`
            ).toEqual([]);
        }
    });
}

test('mobile layout remains usable at a narrow touch viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Only the mobile browser project runs this touch-layout check.');
    await page.setViewportSize({ width: 320, height: 720 });

    for (const path of pages) {
        await page.goto(path);
        await expect(page.locator('body')).toBeVisible();

        const dimensions = await page.evaluate(() => ({
            viewport: document.documentElement.clientWidth,
            content: document.documentElement.scrollWidth
        }));
        expect(dimensions.content, `Horizontal overflow on ${path} at 320px`).toBeLessThanOrEqual(dimensions.viewport + 1);
    }
});
