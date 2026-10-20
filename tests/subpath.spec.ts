import { test, expect } from '@playwright/test';

// The game must boot from a /<repo>/ subpath with relative assets,
// expose home-screen install metadata, respond to touch, and log no errors.
test('boots under subpath with install metadata, touch works, no console errors', async ({ page, baseURL }) => {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

  const res = await page.goto(baseURL!);
  expect(res?.status()).toBe(200);
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });

  // Install metadata resolves relative to the subpath.
  const meta = await page.evaluate(async () => {
    const q = (s: string) => document.querySelector(s)?.getAttribute('content') ?? document.querySelector(s)?.getAttribute('href');
    const manifestHref = (document.querySelector('link[rel=manifest]') as HTMLLinkElement).href;
    const iconHref = (document.querySelector('link[rel=apple-touch-icon]') as HTMLLinkElement).href;
    const m = await (await fetch(manifestHref)).json();
    const icon = await fetch(new URL(m.icons[0].src, manifestHref).href);
    return {
      capable: q('meta[name=apple-mobile-web-app-capable]'), manifestHref, iconHref,
      start: new URL(m.start_url, manifestHref).href, scope: new URL(m.scope, manifestHref).href,
      iconOk: icon.ok, iconType: icon.headers.get('content-type'),
    };
  });
  expect(meta.capable).toBe('yes');
  expect(meta.start).toBe(new URL('./', baseURL!).href);
  expect(meta.scope).toBe(new URL('./', baseURL!).href);
  expect(meta.iconOk).toBe(true);
  expect(meta.iconType).toContain('image/png');

  // Touch: a quick tap-to-move.
  const s0 = await page.evaluate(() => (window as any).__cozy.state);
  const p = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [s0.x + 120, s0.y - 40]);
  await page.touchscreen.tap(p.x, p.y);
  await expect.poll(async () => (await page.evaluate(() => (window as any).__cozy.state)).x, { timeout: 120_000, intervals: [500] })
    .toBeGreaterThan(s0.x + 60);

  await page.screenshot({ path: 'test-results/subpath.png', scale: 'css' });
  expect(failed, failed.join('\n')).toEqual([]);
  expect(errors, errors.join('\n')).toEqual([]);
});
