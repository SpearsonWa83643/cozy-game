import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 38 (Walker, Nov 3 8:57 AM CT): Sky View, each mount's own top-down flying view. While riding, a HUD
// button opens it: the 74 top-down art (you riding, flying forward), the mount's own sky, signature
// trail and rhythm, speed effects; tap = whoosh + barrel roll; pause card > Land returns to the ride.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.SHOTS ?? 'screenshots';
const ui = (page: Page, expr: string) => page.evaluate(`(() => { const u = window.__game.scene.getScene('ui'); return ${expr}; })()`) as Promise<any>;
const chase = (page: Page) => page.evaluate(() => (window as any).__chase ?? null);
const SAVE = { v: 2, theme: 'spring', puzzles: { trail: true, stones: true }, treasures: ['pterodactyl_egg', 'rainbow_horseshoe'], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [],
  look: { hat: 'straw', scarf: 'red', outfit: 'teal', back: 'backpack', feather: true, shells: false } };

test('sky view: per-mount flying view from the HUD while riding', async ({ page }) => {
  test.setTimeout(1_500_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('cozy.save.v2', JSON.stringify(s)); localStorage.setItem('cozy.whatsnew.seen', 'x'); }, SAVE);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.evaluate(() => document.getElementById('whatsnew')?.remove());
  await page.waitForTimeout(1500);
  for (let i = 0; i < 8 && (await page.evaluate(() => (window as any).__cozy.state.dialogOpen)); i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(700); }

  // Hidden on foot; shows once you ride.
  expect(await ui(page, 'u.skyC.visible')).toBe(false);
  await page.evaluate(() => (window as any).__cozy.callMount('eagle'));
  await expect.poll(async () => (await page.evaluate(() => (window as any).__cozy.mount())).phase, { timeout: 120_000, intervals: [300] }).toBe('ride');
  await expect.poll(() => ui(page, 'u.skyC.visible'), { timeout: 30_000 }).toBe(true);
  const b = await ui(page, '({ x: u.skyC.x, y: u.skyC.y, jx: u.jailC.x, jy: u.jailC.y })');
  expect(b.y).toBe(b.jy); expect(b.jx - b.x).toBeGreaterThanOrEqual(56);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/sky-view-button.png` });
  await page.touchscreen.tap(b.x, b.y);
  await expect.poll(async () => (await chase(page))?.phase, { timeout: 180_000, intervals: [500] }).toBe('play');
  let c = await chase(page);
  expect(c.sky.title).toBe('Eagle Sky');
  expect(c.sky.label).toContain('Eagle Sky');
  expect(c.top.tex).toBe('td_eagle_straw_teal_red_backpack_1');
  expect(c.top.wings).toBe(true);
  expect(c.taken.length).toBe(0);
  await expect.poll(async () => (await chase(page)).sky.sig, { timeout: 60_000 }).toBeGreaterThan(0);
  // Tap = whoosh: boost + barrel roll.
  const before = c.fx.boosts;
  await page.touchscreen.tap(700, 500);
  await expect.poll(async () => (await chase(page)).sky.rolls, { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
  expect((await chase(page)).fx.boosts).toBeGreaterThan(before);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/sky-view-eagle.png` });
  // No thief, no time-out: still flying well past the chase's limit would be slow to test; check no nets fly.
  await page.waitForTimeout(3000);
  c = await chase(page);
  expect(c.nets).toBe(0); expect(c.phase).toBe('play');

  // Land from the pause card: back to the ride.
  await page.touchscreen.tap(c.pause.x, c.pause.y);
  await expect.poll(async () => (await chase(page)).card?.title, { timeout: 30_000 }).toBe('Eagle Sky');
  const land = await page.evaluate(() => (window as any).__chaseScene.buttonAt('land'));
  await page.touchscreen.tap(land.x, land.y);
  await expect.poll(async () => (await chase(page))?.on, { timeout: 60_000 }).toBe(false);
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.isActive('world')), { timeout: 30_000 }).toBe(true);
  expect((await page.evaluate(() => (window as any).__cozy.mount())).phase).toBe('ride');

  // Other mounts get their own sky and trail.
  for (const [id, title, shot] of [['unicorn', 'Rainbow Sky', 'unicorn'], ['cowboy_cookie', 'Cookie Sky', 'cookie'], ['sky_jelly', 'Glow Jelly Sky', 'jelly']] as const) {
    expect(await page.evaluate((m) => (window as any).__cozy.skyView(m), id)).toBe(true);
    await expect.poll(async () => (await chase(page))?.phase, { timeout: 180_000, intervals: [500] }).toBe('play');
    expect((await chase(page)).sky.title).toBe(title);
    await page.touchscreen.tap(500, 500);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SHOTS}/sky-view-${shot}.png` });
    await page.evaluate(() => (window as any).__chaseScene.finish('quit'));
    await expect.poll(() => page.evaluate(() => (window as any).__game.scene.isActive('world')), { timeout: 60_000 }).toBe(true);
    await page.waitForTimeout(700);
  }
  expect(errors).toEqual([]);
});
