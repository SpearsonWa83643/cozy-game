import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Order 16 (light): Glow Scarf + Ranger Coat. Locked in the wardrobe at first; trip 1's chest gives
// the scarf (home by button), trip 2's gives the coat (home by fainting, finds kept). Both can be worn,
// and treasures + look survive a reload. Two trips only, so it fits the low-memory 1x config.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.WILD_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const state = (page: Page) => cozy(page, 'state');
const wild = (page: Page) => cozy(page, 'wild()');
async function closeDialogs(page: Page) {
  for (let i = 0; i < 14 && (await state(page)).dialogOpen; i++) { await page.touchscreen.tap(590, 650); await page.waitForTimeout(700); }
}
const wildRect = (page: Page, k: string) => page.evaluate((k) => (window as any).__game.scene.getScene('wildui').rects[k], k);
const menuRect = (page: Page, k: string) => page.evaluate((k) => (window as any).__menu.rects[k], k);
const tapRect = async (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
async function boot(page: Page) {
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  await closeDialogs(page);
}
async function openWardrobe(page: Page) {
  await page.evaluate(() => (window as any).__menu.show('wardrobe'));
  await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(800);
}
async function closeMenu(page: Page) {
  await page.evaluate(() => (window as any).__menu.close());
  await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(false);
  await page.waitForTimeout(500);
}
async function trip(page: Page, seed: number, id: string, home: 'button' | 'faint') {
  await cozy(page, `enterWild(${seed})`);
  await expect.poll(async () => (await wild(page)).on, { timeout: 90_000, intervals: [500] }).toBe(true);
  await page.waitForTimeout(1500);
  await closeDialogs(page);
  const chest = (await wild(page)).chests[0];
  await page.evaluate(([x, y]) => (window as any).__cozy.wildTeleport(x, y + 20), [chest.x, chest.y]);
  await expect.poll(async () => (await wild(page)).found, { timeout: 60_000, intervals: [400] }).toEqual([id]);
  if (home === 'button') await tapRect(page, await wildRect(page, 'home'));
  else await page.evaluate(() => (window as any).__game.scene.getScene('wild').goHome('faint'));
  await expect.poll(async () => (await wild(page)).on, { timeout: 60_000 }).toBe(false);
  await expect.poll(async () => (await state(page)).locked, { timeout: 60_000 }).toBe(false);
  await page.waitForTimeout(900);
  await closeDialogs(page);
  expect((await state(page)).treasures).toContain(id);
}

test('glow scarf + ranger coat: locked, found in two wild trips, wearable, persist', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'classic', puzzles: {}, treasures: ['acorn_cap'], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await boot(page);

  // Locked at first: tapping does nothing.
  await openWardrobe(page);
  const look0 = (await state(page)).look;
  await tapRect(page, await menuRect(page, 'scarf:moss'));
  await tapRect(page, await menuRect(page, 'outfit:ranger'));
  await page.waitForTimeout(500);
  expect((await state(page)).look.scarf).toBe(look0.scarf);
  expect((await state(page)).look.outfit).toBe(look0.outfit);
  await closeMenu(page);

  await trip(page, 201, 'glow_scarf', 'button');
  expect((await state(page)).treasures).not.toContain('ranger_coat');
  await trip(page, 202, 'ranger_coat', 'faint');

  await openWardrobe(page);
  await tapRect(page, await menuRect(page, 'scarf:moss'));
  await expect.poll(async () => (await state(page)).look.scarf, { timeout: 30_000 }).toBe('moss');
  await tapRect(page, await menuRect(page, 'outfit:ranger'));
  await expect.poll(async () => (await state(page)).look.outfit, { timeout: 30_000 }).toBe('ranger');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/scarf-coat-wardrobe.png` });
  await closeMenu(page);

  // Survives a reload (persist is debounced 250 ms).
  await page.waitForTimeout(800);
  await page.reload();
  await boot(page);
  const s = await state(page);
  expect(s.treasures).toEqual(expect.arrayContaining(['acorn_cap', 'glow_scarf', 'ranger_coat']));
  expect(s.look.scarf).toBe('moss');
  expect(s.look.outfit).toBe('ranger');
  await page.screenshot({ path: `${SHOTS}/scarf-coat-worn.png` });
  expect(errors).toEqual([]);
});
