import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Walker, Oct 20: easier mounts. Every Wild Woods trip has a glowing mount lunchbox a short walk
// from the start while any mount treasure is unowned; it always gives the next mount.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOT = process.env.MOUNT_LUNCHBOX_SHOT ?? '/workspace/shots/mount-lunchbox.png';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const state = (page: Page) => cozy(page, 'state');
const wild = (page: Page) => cozy(page, 'wild()');
async function closeDialogs(page: Page) {
  for (let i = 0; i < 14 && (await state(page)).dialogOpen; i++) { await page.touchscreen.tap(590, 650); await page.waitForTimeout(700); }
}

test('mount lunchbox: near the start, walk-to by tap, unlocks pterodactyl in the picker', async ({ playwright: _pw }, info) => {
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
    expect((await state(page)).treasures ?? []).not.toContain('pterodactyl_egg');

    await cozy(page, 'enterWild(4242)');
    await expect.poll(async () => (await wild(page)).on, { timeout: 90_000, intervals: [500] }).toBe(true);
    await page.waitForTimeout(1500);
    await closeDialogs(page);
    const w = await wild(page);
    const lb = w.chests.find((c: any) => c.lunchbox);
    expect(lb).toBeTruthy();
    const dist = Math.hypot(lb.x - w.start[0], lb.y - w.start[1]);
    expect(dist).toBeLessThan(300);
    expect(lb.opened).toBe(false);
    // On screen right at arrival.
    const sp = await page.evaluate(([x, y]) => (window as any).__cozy.wildToScreen(x, y - 20), [lb.x, lb.y]);
    expect(sp.x).toBeGreaterThan(0); expect(sp.x).toBeLessThan(1180); expect(sp.y).toBeGreaterThan(0); expect(sp.y).toBeLessThan(820);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: SHOT });

    // A real tap on the lunchbox walks there (nav grid) and opens it.
    await page.touchscreen.tap(sp.x, sp.y);
    await expect.poll(async () => (await wild(page)).found, { timeout: 60_000, intervals: [400] }).toContain('pterodactyl_egg');
    await expect.poll(() => page.evaluate(() => !!(window as any).__game.scene.getScene('wildui').newMountC), { timeout: 5_000 }).toBe(true);
    await page.waitForTimeout(250);
    await page.screenshot({ path: SHOT.replace(/\.png$/, '-opened.png') });

    // Home: treasure banked, picker shows the pterodactyl.
    const home = await page.evaluate(() => (window as any).__game.scene.getScene('wildui').rects.home);
    await page.touchscreen.tap(home.x + home.w / 2, home.y + home.h / 2);
    await expect.poll(async () => (await wild(page)).on, { timeout: 60_000 }).toBe(false);
    await expect.poll(async () => (await state(page)).locked, { timeout: 60_000 }).toBe(false);
    await page.waitForTimeout(800);
    await closeDialogs(page);
    expect((await state(page)).treasures).toContain('pterodactyl_egg');
    await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => (window as any).__vui.rects.mount);
    await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
    await expect.poll(() => page.evaluate(() => !!(window as any).__vui.rects['mountPick:pterodactyl']), { timeout: 10_000 }).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
