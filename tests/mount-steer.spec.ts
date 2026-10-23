import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Walker, Oct 20: while riding, drag to steer the mount; let go and after ~2 s it tours on its own
// again from where it is. A quick ground tap still drops you off.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOT = process.env.MOUNT_STEER_SHOT ?? '/workspace/shots/mount-steer.png';
const mount = (page: Page) => page.evaluate(() => (window as any).__cozy.mount());

test('mount steer: drag steers toward the drag, release resumes the tour, tap still lands', async ({ playwright: _pw }, info) => {
  test.setTimeout(600_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
    await page.evaluate(() => (window as any).__cozy.teleport(1400, 1100));
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => (window as any).__vui.rects.mount);
    await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
    await expect.poll(async () => (await mount(page)).phase, { timeout: 90_000, intervals: [200] }).toBe('ride');
    await page.waitForTimeout(1500);

    // Drag against the tour's direction so the effect is unmistakable.
    const m0 = await mount(page);
    expect(m0.steering).toBe(false);
    const sx = Math.cos(m0.heading) > 0 ? -1 : 1;
    const cdp = await page.context().newCDPSession(page);
    const pt = (x: number, y: number) => [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
    const x0 = 590, y0 = 520, dx = sx * 110;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0, y0) });
    for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x0 + (dx * i) / 6, y0) }); await page.waitForTimeout(60); }
    await expect.poll(async () => (await mount(page)).steering, { timeout: 5_000, intervals: [100] }).toBe(true);
    const g1 = (await mount(page)).ground;
    for (let i = 0; i < 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x0 + dx + (i % 2) * 0.5, y0) }); await page.waitForTimeout(250); }
    await page.screenshot({ path: SHOT });
    const m2 = await mount(page);
    expect(m2.steering).toBe(true);
    expect((m2.ground[0] - g1[0]) * sx).toBeGreaterThan(120);
    expect(Math.sign(Math.cos(m2.heading))).toBe(sx);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();

    // Let go: coasts briefly, then back to the tour (still riding), no snap.
    await page.waitForTimeout(800);
    const m3 = await mount(page);
    expect(m3.steering).toBe(true);
    expect(Math.hypot(m3.ground[0] - m2.ground[0], m3.ground[1] - m2.ground[1])).toBeLessThan(260);
    await expect.poll(async () => (await mount(page)).steering, { timeout: 20_000, intervals: [200] }).toBe(false);
    const m4 = await mount(page);
    expect(m4.phase).toBe('ride');
    expect(m4.tours).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(1500);
    expect((await mount(page)).speed).toBeGreaterThan(60);

    // A quick tap on the ground still means "drop me off here".
    const e = (await mount(page)).eagle;
    const tp = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [e[0] + 160, e[1] + 140]);
    await page.touchscreen.tap(tp.x, tp.y);
    await expect.poll(async () => (await mount(page)).phase, { timeout: 10_000, intervals: [100] }).not.toBe('ride');
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
