import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Order 16 (+ Order 14 loot): one chest per Wild trip. Starting with the Acorn Cap found, the
// next trips give the Glow Scarf, the Ranger Coat, then the Pterodactyl Egg and Cloud Tuft.
// Both outfits can then be worn from the wardrobe.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.WILD_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const state = (page: Page) => cozy(page, 'state');
const wild = (page: Page) => cozy(page, 'wild()');
async function closeDialogs(page: Page) {
  for (let i = 0; i < 14 && (await state(page)).dialogOpen; i++) { await page.touchscreen.tap(590, 650); await page.waitForTimeout(700); }
}
const wildRect = (page: Page, k: string) => page.evaluate((k) => (window as any).__game.scene.getScene('wildui').rects[k], k);
const tapRect = async (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('wild unlocks: glow scarf, ranger coat, then mount treasures; outfits wearable', async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'classic', puzzles: {}, treasures: ['acorn_cap'], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  await closeDialogs(page);

  const expected = ['glow_scarf', 'ranger_coat', 'pterodactyl_egg', 'cloud_puppy_tuft'];
  for (const [i, id] of expected.entries()) {
    await cozy(page, `enterWild(${101 + i})`);
    await expect.poll(async () => (await wild(page)).on, { timeout: 90_000, intervals: [500] }).toBe(true);
    await page.waitForTimeout(1500);
    await closeDialogs(page);
    const chest = (await wild(page)).chests[0];
    // Standing on the chest opens it.
    await page.evaluate(([x, y]) => (window as any).__cozy.wildTeleport(x, y + 20), [chest.x, chest.y]);
    await expect.poll(async () => (await wild(page)).found, { timeout: 60_000, intervals: [400] }).toContain(id);
    if (id === 'pterodactyl_egg') { await page.waitForTimeout(500); await page.screenshot({ path: `${SHOTS}/wild-ptero-egg.png` }); }
    await tapRect(page, await wildRect(page, 'home'));
    await expect.poll(async () => (await wild(page)).on, { timeout: 60_000 }).toBe(false);
    await expect.poll(async () => (await state(page)).locked, { timeout: 60_000 }).toBe(false);
    await page.waitForTimeout(800);
    await closeDialogs(page);
    expect((await state(page)).treasures).toContain(id);
  }

  // Wardrobe: wear the Glow Scarf and the Ranger Coat.
  await page.evaluate(() => (window as any).__menu.show('wardrobe'));
  await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(800);
  await tapRect(page, await page.evaluate(() => (window as any).__menu.rects['scarf:moss']));
  await expect.poll(async () => (await state(page)).look.scarf, { timeout: 30_000 }).toBe('moss');
  await tapRect(page, await page.evaluate(() => (window as any).__menu.rects['outfit:ranger']));
  await expect.poll(async () => (await state(page)).look.outfit, { timeout: 30_000 }).toBe('ranger');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/wild-unlocks-wardrobe.png` });
  expect(errors).toEqual([]);
});
