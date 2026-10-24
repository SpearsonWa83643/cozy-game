import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Walker, Oct 24: the mount lunchbox is not parked by the entrance any more. One random creature in
// the woods carries it (a tiny glowing lunchbox on its head). Bop that creature and the box pops out
// where it stood; walk to it (or tap it) and it opens and gives the next mount.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOT = process.env.MOUNT_LUNCHBOX_SHOT ?? '/workspace/shots/mount-lunchbox.png';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const state = (page: Page) => cozy(page, 'state');
const wild = (page: Page) => cozy(page, 'wild()');
async function closeDialogs(page: Page) {
  for (let i = 0; i < 14 && (await state(page)).dialogOpen; i++) { await page.touchscreen.tap(590, 650); await page.waitForTimeout(700); }
}

test('mount lunchbox: carried by a random creature, pops out when it is bopped, unlocks pterodactyl', async ({ playwright: _pw }, info) => {
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
    let w = await wild(page);
    // Not by the entrance any more: no lunchbox yet, but a random creature carries it.
    expect(w.chests.find((c: any) => c.lunchbox)).toBeFalsy();
    expect(w.carrier).toBeTruthy();
    expect(w.carrier.alive).toBe(true);
    expect(w.mons.some((m: any) => m.id === w.carrier.id)).toBe(true);
    // Show the carrier with its tiny lunchbox.
    await page.evaluate(([x, y]) => (window as any).__cozy.wildTeleport(x - 130, y + 24), [w.carrier.x, w.carrier.y]);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: SHOT.replace(/\.png$/, '-carrier.png') });

    // Bop it with the big Bop! button until it poofs.
    for (let i = 0; i < 16 && (await wild(page)).carrier?.alive; i++) {
      const c = (await wild(page)).carrier;
      await page.evaluate(([x, y]) => (window as any).__cozy.wildTeleport(x - 64, y), [c.x, c.y]);
      const at = await page.evaluate(() => (window as any).__game.scene.getScene('wildui').rects.attack);
      await page.touchscreen.tap(at.x + at.w / 2, at.y + at.h / 2);
      await page.waitForTimeout(700);
    }
    expect((await wild(page)).carrier.alive).toBe(false);
    // The lunchbox popped out right where the creature stood.
    await expect.poll(async () => (await wild(page)).chests.some((c: any) => c.lunchbox), { timeout: 10_000 }).toBe(true);
    w = await wild(page);
    const lb = w.chests.find((c: any) => c.lunchbox);
    expect(Math.hypot(lb.x - w.carrier.x, lb.y - w.carrier.y)).toBeLessThan(60);
    expect(lb.opened).toBe(false);
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT });

    // A real tap on the lunchbox (or just standing by it) opens it.
    const sp = await page.evaluate(([x, y]) => (window as any).__cozy.wildToScreen(x, y - 20), [lb.x, lb.y]);
    await page.waitForTimeout(1200);
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
