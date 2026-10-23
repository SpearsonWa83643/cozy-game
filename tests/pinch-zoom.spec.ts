import { test, expect, type Page, type CDPSession } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.1 Pinch zoom: two-finger pinch zooms around the fingers (no walk taps), big + / - buttons,
// limits (never past the map edges, never too close), same in the glade and the Wild Woods.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.ZOOM_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const zi = (page: Page) => cozy(page, 'zoomInfo()');
const pt = (id: number, x: number, y: number) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 });

async function pinch(page: Page, cdp: CDPSession, cx: number, cy: number, d0: number, d1: number) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(1, cx - d0 / 2, cy)] });
  await page.waitForTimeout(40);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(1, cx - d0 / 2, cy), pt(2, cx + d0 / 2, cy)] });
  await page.waitForTimeout(40);
  for (let i = 1; i <= 8; i++) {
    const d = d0 + ((d1 - d0) * i) / 8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(1, cx - d / 2, cy), pt(2, cx + d / 2, cy)] });
    await page.waitForTimeout(50);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [pt(1, cx - d1 / 2, cy)] });
  await page.waitForTimeout(40);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
}
const tapRect = (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('pinch zoom + zoom buttons + limits (glade and Wild Woods)', async ({ page }) => {
  test.setTimeout(300_000);
  let cdp: CDPSession | null = null;
  try {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1200);
    for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
    await page.waitForTimeout(800);
    cdp = await page.context().newCDPSession(page);

    const z0 = await zi(page);
    expect(z0.mul).toBe(1);
    expect(z0.buttons.length).toBe(2);
    const s0 = await cozy(page, 'state');

    // 1. Pinch out: zooms in, the hero doesn't walk anywhere, and the camera goes back to following.
    await pinch(page, cdp, 520, 430, 160, 380);
    const z1 = await zi(page);
    expect(z1.mul).toBeGreaterThan(1.5);
    expect(z1.zoom).toBeGreaterThan(z0.zoom * 1.4);
    expect(z1.following).toBe(true);
    await page.waitForTimeout(600);
    const s1 = await cozy(page, 'state');
    expect(Math.hypot(s1.x - s0.x, s1.y - s0.y)).toBeLessThan(4);
    expect(s1.pathLen).toBe(0);
    await page.screenshot({ path: `${SHOTS}/pinch-zoom-in.png` });

    // 2. Limits: a big pinch out stops at the max, a big pinch in stops at the min.
    await pinch(page, cdp, 600, 430, 120, 560);
    expect((await zi(page)).mul).toBeCloseTo(z0.max, 2);
    await pinch(page, cdp, 600, 430, 600, 60);
    await pinch(page, cdp, 600, 430, 600, 60);
    const zl = await zi(page);
    expect(zl.mul).toBeCloseTo(zl.min, 2);
    expect(zl.zoom).toBeGreaterThanOrEqual(zl.floor - 1e-3);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/pinch-zoom-out.png` });
    const s2 = await cozy(page, 'state');
    expect(Math.hypot(s2.x - s0.x, s2.y - s0.y)).toBeLessThan(4);

    // 3. Buttons: + steps in (and stops at the max), - steps back out. No walking from button taps.
    const [plus, minus] = z0.buttons;
    await tapRect(page, plus); await page.waitForTimeout(400);
    const zb = await zi(page);
    expect(zb.mul).toBeCloseTo(zl.min * 1.25, 2);
    for (let i = 0; i < 6; i++) { await tapRect(page, plus); await page.waitForTimeout(300); }
    expect((await zi(page)).mul).toBeCloseTo(z0.max, 2);
    await tapRect(page, minus); await tapRect(page, minus); await page.waitForTimeout(400);
    expect((await zi(page)).mul).toBeCloseTo(z0.max / 1.25 / 1.25, 2);
    const s3 = await cozy(page, 'state');
    expect(Math.hypot(s3.x - s0.x, s3.y - s0.y)).toBeLessThan(4);
    // A normal tap still walks.
    await page.touchscreen.tap(700, 430);
    await expect.poll(async () => { const s = await cozy(page, 'state'); return Math.hypot(s.x - s0.x, s.y - s0.y); }, { timeout: 15_000 }).toBeGreaterThan(20);

    // 4. Wild Woods: same zoom carries over, same buttons and pinch, view stays inside the map.
    const mulBefore = (await zi(page)).mul;
    await cozy(page, 'enterWild(4242)');
    await expect.poll(async () => (await cozy(page, 'wild()')).on, { timeout: 60_000, intervals: [500] }).toBe(true);
    await page.waitForTimeout(1500);
    const w0 = await zi(page);
    expect(w0.mul).toBeCloseTo(mulBefore, 3);
    expect(w0.buttons.length).toBe(2);
    await tapRect(page, w0.buttons[1]); await page.waitForTimeout(400);
    expect((await zi(page)).mul).toBeCloseTo(mulBefore / 1.25, 2);
    const p0 = (await cozy(page, 'wild()')).player;
    await pinch(page, cdp, 600, 450, 500, 80);
    await pinch(page, cdp, 600, 450, 500, 80);
    const w1 = await zi(page);
    const wl = await cozy(page, 'wild()');
    expect(w1.mul).toBeCloseTo(w1.min, 2);
    expect(Math.hypot(wl.player[0] - p0[0], wl.player[1] - p0[1])).toBeLessThan(4);
    await page.waitForTimeout(1000);
    const w2 = await zi(page);
    expect(w2.view[0]).toBeGreaterThanOrEqual(0);
    expect(w2.view[1]).toBeGreaterThanOrEqual(0);
    expect(w2.view[0] + w2.view[2]).toBeLessThanOrEqual(wl.w + 1);
    expect(w2.view[1] + w2.view[3]).toBeLessThanOrEqual(wl.h + 1);
    await page.screenshot({ path: `${SHOTS}/pinch-zoom-wild.png` });
    expect(errors).toEqual([]);
  } finally {
    await cdp?.detach().catch(() => {});
    await page.close();
  }
});
