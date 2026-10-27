import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 22: each theme has its own little chime when picked from the HUD theme picker.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const tapRect = async (page: Page, k: string) => {
  const r = await page.evaluate((k) => (window as any).__cozy.themeHud().rects[k], k);
  await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
};

test('theme chimes: picking a theme plays its own motif', async ({ page }) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await page.evaluate(() => (window as any).__cozy.state.dialogOpen)); i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
  for (const id of ['summer', 'fall', 'halloween', 'christmas', 'winter', 'spring']) {
    await tapRect(page, 'btn');
    await page.waitForTimeout(500);
    await tapRect(page, id);
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => (window as any).__cozy.village().theme)).toBe(id);
    expect(await page.evaluate(() => (window as any).__chime)).toBe(id);
  }
  expect(errors).toEqual([]);
});
