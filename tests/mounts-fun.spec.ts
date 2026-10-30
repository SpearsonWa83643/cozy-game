import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 12.3: six new cute mounts (incl. Walker's cookie-in-a-cowboy-hat and chili-in-a-poncho figurines).
// They live in the stable and the Call Mount picker, and can be ridden and steered like the others.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.MOUNT_SHOTS ?? 'screenshots';
const NEW: [string, string][] = [
  ['cowboy_cookie', 'cowboy_hat'], ['chili_poncho', 'chili_poncho'], ['magic_carpet', 'magic_tassel'],
  ['rubber_duck', 'duck_squeak'], ['sky_jelly', 'jelly_gem'], ['strawberry', 'berry_seed'],
];
const ALL_TREASURES = ['pterodactyl_egg', 'cloud_puppy_tuft', 'rainbow_horseshoe', 'golden_honeycomb', 'glow_pearl', 'sugar_cube', 'toy_propeller', 'pumpkin_seed', ...NEW.map((n) => n[1])];
const mount = (page: Page) => page.evaluate(() => (window as any).__cozy.mount());
const vrect = (page: Page, id: string) => page.evaluate((id) => (window as any).__vui.rects[id], id) as Promise<{ x: number; y: number; w: number; h: number }>;
const tapV = async (page: Page, id: string) => { const r = await vrect(page, id); await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2); };

test('new mounts: stable, picker, ride and steer', async ({ playwright: _pw }, info) => {
  test.setTimeout(900_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
  const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: t, fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  }, ALL_TREASURES);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });

  // Stable: 22 stalls (3 rows), every new friend awake.
  await page.evaluate(() => (window as any).__menu.show('stable'));
  await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(1200);
  const pets = await page.evaluate(() => (window as any).__menu.stablePets.map((p: any) => [p.id, p.on]));
  expect(pets.length).toBe(22);
  for (const [id] of NEW) expect(pets.find((p: any) => p[0] === id)?.[1], `${id} awake`).toBe(true);
  const vp = page.viewportSize()!;
  for (const [id] of NEW) {
    const r = await page.evaluate((id) => (window as any).__menu.rects[`stall:${id}`], id);
    expect(r, `stall ${id}`).toBeTruthy();
    expect(r.w).toBeGreaterThanOrEqual(80); expect(r.h).toBeGreaterThanOrEqual(120);
    expect(r.y + r.h).toBeLessThanOrEqual(vp.height); expect(r.x + r.w).toBeLessThanOrEqual(vp.width);
  }
  await page.screenshot({ path: `${SHOTS}/stable-22.png` });
  const closeBtn = await page.evaluate(() => (window as any).__menu.rects.close);
  await page.touchscreen.tap(closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2);
  await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(false);

  // Picker: every friend has a tile that is fully on screen.
  await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
  await page.waitForTimeout(500);
  await tapV(page, 'mount');
  await expect.poll(() => page.evaluate(() => !!(window as any).__vui.mountPicker), { timeout: 10_000, intervals: [100] }).toBe(true);
  const eagleTile = await vrect(page, 'mountPick:eagle');
  expect(eagleTile).toBeTruthy();
  for (const [id] of NEW) {
    const r = await vrect(page, `mountPick:${id}`);
    expect(r, `tile ${id}`).toBeTruthy();
    expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(vp.width); expect(r.y + r.h).toBeLessThanOrEqual(vp.height);
    expect(r.w).toBeGreaterThanOrEqual(100);
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/mount-picker-22.png` });

  // Ride each new friend: pick the tile for the first, Call Mount directly for the rest.
  for (const [i, [id]] of NEW.entries()) {
    if (i === 0) await tapV(page, `mountPick:${id}`);
    else await page.evaluate((id) => (window as any).__cozy.callMount(id), id);
    await expect.poll(async () => (await mount(page)).id, { timeout: 10_000, intervals: [100] }).toBe(id);
    await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [200] }).toBe('ride');
    expect((await mount(page)).riderOn).toBe(true);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOTS}/mount-${id}-riding.png` });
    // Steer: a tap on the ground flies there; then hop off.
    const before = (await mount(page)).ground;
    await page.evaluate(() => { const m = (window as any).__cozy.mount(); (window as any).__cozy.mountTap(m.ground[0] + 160, m.ground[1] + 40); });
    await page.waitForTimeout(1500);
    const mid = (await mount(page));
    expect(Math.hypot(mid.ground[0] - before[0], mid.ground[1] - before[1]), `${id} steers`).toBeGreaterThan(20);
    await page.evaluate(() => { const m = (window as any).__cozy.mount(); (window as any).__cozy.mountTap(m.ground[0] + 100, m.ground[1] + 80); });
    await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [300] }).toBe('off');
  }
  expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
