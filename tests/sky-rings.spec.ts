import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 80: while riding a flying friend, five star rings float ahead; steer through them (real touch
// drags) for "1 of 5!" ... "All 5!"; a fresh trail comes back later; rings vanish when you land.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.RING_SHOTS ?? 'test-results';
const cz = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('sky rings: appear while riding, steer through all five, cheer, respawn, hide on landing', async ({ playwright: _pw }, info) => {
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
    expect((await cz(page, 'rings()')).list.every((r: any) => !r.on)).toBe(true);
    await cz(page, 'teleport(1400, 1100)');
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => (window as any).__vui.rects.mount);
    await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
    await expect.poll(async () => (await cz(page, 'mount()')).phase, { timeout: 90_000, intervals: [200] }).toBe('ride');
    await expect.poll(async () => (await cz(page, 'rings()')).left, { timeout: 30_000, intervals: [200] }).toBe(5);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/sky-rings.png` });

    // Steer with a real touch drag toward the nearest ring until all five are collected.
    const cdp = await page.context().newCDPSession(page);
    const pt = (x: number, y: number) => [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
    const x0 = 590, y0 = 520;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0, y0) });
    let shot2 = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 240_000) {
      const s = await cz(page, 'rings()');
      if (s.sets >= 1) break;
      const m = await cz(page, 'mount()');
      const live = s.list.filter((q: any) => q.on && !q.got);
      if (!live.length) { await page.waitForTimeout(200); continue; }
      const [ex, ey] = m.eagle;
      live.sort((a: any, b: any) => Math.hypot(a.x - ex, a.y - ey) - Math.hypot(b.x - ex, b.y - ey));
      const dx = live[0].x - ex, dy = live[0].y - ey, d = Math.hypot(dx, dy) || 1;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x0 + (dx / d) * 110, y0 + (dy / d) * 110) });
      if (!shot2 && s.got >= 2) { shot2 = true; await page.screenshot({ path: `${SHOTS}/sky-rings-two.png` }); }
      await page.waitForTimeout(150);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const done = await cz(page, 'rings()');
    expect(done.sets).toBe(1);
    expect(done.total).toBe(5);
    await page.screenshot({ path: `${SHOTS}/sky-rings-all.png` });
    // A fresh trail comes back ahead.
    await expect.poll(async () => (await cz(page, 'rings()')).spawns, { timeout: 60_000, intervals: [300] }).toBeGreaterThanOrEqual(2);
    expect((await cz(page, 'rings()')).left).toBe(5);
    expect((await cz(page, 'mount()')).phase).toBe('ride');
    // Land: rings vanish.
    await page.evaluate(() => (window as any).__cozy.mountLand?.() ?? (window as any).__cozy.dropMount?.());
    const st = await cz(page, 'mount()');
    if (st.phase === 'ride') {
      const sp = await cz(page, `worldToScreen(${st.ground[0] + 120}, ${st.ground[1] + 60})`);
      await page.touchscreen.tap(sp.x, sp.y);
    }
    await expect.poll(async () => (await cz(page, 'mount()')).phase, { timeout: 60_000, intervals: [300] }).not.toBe('ride');
    await expect.poll(async () => (await cz(page, 'rings()')).list.every((q: any) => !q.on), { timeout: 10_000 }).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
