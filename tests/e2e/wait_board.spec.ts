import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('keeps styles applied after the Vite client takes over', async ({ page }) => {
  await page.goto('http://127.0.0.1:4176/#content');
  const clientStyles = page.locator(
    'style[data-vite-dev-id$="/theme.css"], style[data-vite-dev-id$="/dashboard.module.css"]',
  );
  await expect(clientStyles).toHaveCount(2);
  await expect(page.locator('[data-react-router-critical-css]')).toHaveCount(0);
  await expect
    .poll(() =>
      clientStyles.evaluateAll((styles) =>
        styles.every(
          (style) => style instanceof HTMLStyleElement && style.sheet !== null,
        ),
      ),
    )
    .toBe(true);
  await expect(page.locator('html')).not.toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
});

test('renders seeded park waits and updates the board by park', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Parks at a glance' })).toBeVisible();
  await expect(page.getByText('Sample data', { exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(
    page.getByRole('list', { name: 'Ride waits' }).getByRole('listitem'),
  ).toHaveCount(16);

  await page.getByRole('link', { name: /SeaWorld Orlando/ }).click();
  await expect(page.getByRole('combobox', { name: 'Park', exact: true })).toHaveValue(
    'seaworld',
  );
  await expect(
    page.getByRole('list', { name: 'Ride waits' }).getByRole('listitem'),
  ).toHaveCount(4);

  await page.getByRole('combobox', { name: 'Availability' }).selectOption('open');
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('longest');
  await page.getByRole('button', { name: 'Apply' }).click();
  const rides = page.getByRole('list', { name: 'Ride waits' }).getByRole('listitem');
  await expect(rides).toHaveCount(3);
  await expect(rides.first()).toContainText('Penguin Trek');

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
});

test('serves the public board without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL + '/?park=legoland&availability=open');
  await expect(
    page.getByRole('list', { name: 'Ride waits' }).getByRole('listitem'),
  ).toHaveCount(3);
  await context.close();
});

test('serves Worker liveness with a bounded request contract', async ({ request }) => {
  const live = await request.get('/health/live');
  expect(live.status()).toBe(200);
  expect(live.headers()['cache-control']).toBe('no-store');
  expect(await live.json()).toEqual({ status: 'ok' });

  const head = await request.head('/health/live');
  expect(head.status()).toBe(200);
  expect(await head.text()).toBe('');
  expect((await request.get('/health/live?debug=true')).status()).toBe(400);
  const post = await request.post('/health/live');
  expect(post.status()).toBe(405);
  expect(post.headers()['allow']).toBe('GET, HEAD');
});

test('keeps the data adapter private and returns the public response headers', async ({
  request,
}) => {
  const response = await request.get('/api/v1/park-waits');
  expect(response.ok()).toBe(true);
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['content-security-policy']).toMatch(/nonce-/);
  expect(response.headers()['x-robots-tag']).toContain('noindex');
  const body: unknown = await response.json();
  expect(body).toEqual(
    expect.objectContaining({
      data: expect.objectContaining({
        parks: expect.arrayContaining([expect.objectContaining({ id: 'seaworld' })]),
      }),
    }),
  );
  expect((await request.get('/park-waits')).status()).toBe(404);
  expect((await request.get('/api/v1/park-waits?unknown=1')).status()).toBe(400);
});
