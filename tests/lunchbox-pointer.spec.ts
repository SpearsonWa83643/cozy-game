import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Self-added 12.4 (Oct 24, 2026): after ~10 s in the Wild Woods, a little lunchbox bubble at the
// screen edge points toward the creature carrying the mount lunchbox (then toward the dropped box),
// and hides whenever the box is on screen or once it has been opened.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOT = process.env.LB_POINTER_SHOT ?? '/workspace/shots/lunchbox-pointer.png';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const state = (page: Page) => cozy(page, 'state');
const wild = (page: Page) => cozy(page, 'wild()');
const ptr = (page: Page) => page.evaluate(() => (window as any).__game.scene.getScene('wildui').lunchboxPointer);
const tp = (page: Page, x: number, y: number) => page.evaluate(([a, b]) => (window as any).__cozy.wildTeleport(a, b), [x, y]);
async function closeDialogs(page: Page) {
  for (let i = 0; i < 14 && (await state(page)).dialogOpen; i++) { await page.touchscreen.tap(590, 650); await page.waitForTimeout(700); }
}
/** A spot far from (x, y) inside the woods. */
async function farFrom(page: Page, x: number, y: number) {
  const m = await page.evaluate(() => { const w = (window as any).__game.scene.getScene('wild'); return { w: w.map.w, h: w.map.h }; });
  const fx = x < m.w / 2 ? m.w - 160 : 160, fy = y < m.h / 2 ? m.h - 200 : 200;
  return [fx, fy] as const;
}

test('lunchbox pointer: appears after a while, points at the carrier, hides when near, follows the dropped box', async ({ playwright: _pw }, info) => {
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
    await page.waitForTimeout(1200);
    await closeDialogs(page);

    await cozy(page, 'enterWild(4242)');
    await expect.poll(async () => (await wild(page)).on, { timeout: 90_000, intervals: [500] }).toBe(true);
    await page.waitForTimeout(800);
    await closeDialogs(page);
    let w = await wild(page);
    expect(w.carrier?.alive).toBe(true);
    // Not straight away: kids get a little time to explore first.
    let [fx, fy] = await farFrom(page, w.carrier.x, w.carrier.y);
    await tp(page, fx, fy);
    // (Slow headless loading can eat the delay, so restart the little timer here.)
    await page.evaluate(() => { const u = (window as any).__game.scene.getScene('wildui'); u.lbT0 = u.time.now; });
    await page.waitForTimeout(1500);
    expect((await ptr(page)).visible).toBe(false);

    // After the delay it shows up at the screen edge, pointing toward the carrier.
    await expect.poll(async () => (await ptr(page)).visible, { timeout: 20_000, intervals: [500] }).toBe(true);
    w = await wild(page);
    let p = await ptr(page);
    let target = await page.evaluate(([x, y]) => (window as any).__cozy.wildToScreen(x, y), [w.carrier.x, w.carrier.y - 50]);
    const ang = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    expect(ang(p.angle, Math.atan2(target.y - p.y, target.x - p.x))).toBeLessThan(0.35);
    expect(p.x).toBeGreaterThan(40); expect(p.x).toBeLessThan(1140); expect(p.y).toBeGreaterThan(40); expect(p.y).toBeLessThan(780);
    // Never on top of a HUD button.
    const rects = await page.evaluate(() => (window as any).__game.scene.getScene('wildui').rects);
    for (const r of Object.values(rects) as any[]) expect(p.x > r.x - 20 && p.x < r.x + r.w + 20 && p.y > r.y - 20 && p.y < r.y + r.h + 20).toBe(false);
    await page.waitForTimeout(400);
    await page.screenshot({ path: SHOT });

    // Walk near the carrier: the real lunchbox is on screen, so the pointer hides.
    await tp(page, w.carrier.x - 130, w.carrier.y + 24);
    await expect.poll(async () => (await ptr(page)).visible, { timeout: 5_000 }).toBe(false);

    // Bop the carrier: the box drops; go far away and the pointer now leads back to the dropped box.
    for (let i = 0; i < 16 && (await wild(page)).carrier?.alive; i++) {
      const c = (await wild(page)).carrier;
      await tp(page, c.x - 64, c.y);
      const at = await page.evaluate(() => (window as any).__game.scene.getScene('wildui').rects.attack);
      await page.touchscreen.tap(at.x + at.w / 2, at.y + at.h / 2);
      await page.waitForTimeout(700);
    }
    await expect.poll(async () => (await wild(page)).chests.some((c: any) => c.lunchbox), { timeout: 10_000 }).toBe(true);
    w = await wild(page);
    const lb = w.chests.find((c: any) => c.lunchbox);
    [fx, fy] = await farFrom(page, lb.x, lb.y);
    await tp(page, fx, fy);
    await expect.poll(async () => (await ptr(page)).visible, { timeout: 5_000 }).toBe(true);
    p = await ptr(page);
    target = await page.evaluate(([x, y]) => (window as any).__cozy.wildToScreen(x, y), [lb.x, lb.y - 30]);
    expect(ang(p.angle, Math.atan2(target.y - p.y, target.x - p.x))).toBeLessThan(0.35);

    // Open it: pointer gone for good, even when far away again.
    await tp(page, lb.x, lb.y + 20);
    await expect.poll(async () => (await wild(page)).found, { timeout: 60_000, intervals: [400] }).toContain('pterodactyl_egg');
    await tp(page, fx, fy);
    await page.waitForTimeout(800);
    expect((await ptr(page)).visible).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
