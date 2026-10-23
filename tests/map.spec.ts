import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.37 De-flatten slice 1: the Map tab is an old paper map on a wooden table, with landmark pins,
// ribbon labels, wax-seal puzzle marks and a bobbing "you are here" pin. Tap a pin to hear about it.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.MAP_SHOTS ?? '/workspace/cozy-game/screenshots';
const rect = (page: Page, k: string) => page.evaluate((k) => (window as any).__menu.rects[k], k);
const tapRect = async (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('map: paper map on a table with tappable landmark pins', async ({ playwright: _pw }, info) => {
  test.setTimeout(400_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(FILE);
      await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'fall', puzzles: { lanterns: true }, treasures: [], fish: {}, minor: {}, visited: ['glade', 'river', 'village', 'lake'], chests: [], snacks: 0, tips: [] }));
      });
      await page.reload();
      await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
      await page.waitForTimeout(1000);
      await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
      await page.evaluate(() => (window as any).__menu.show('map'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
      await page.waitForTimeout(1500);
      // Pins only for places you've been: home, village, pond, brookside yes; Mistbirch (forest) and the Wild no.
      const pins = await page.evaluate(() => Object.keys((window as any).__menu.mapPins).sort());
      expect(pins).toEqual(['brookside', 'home', 'pond', 'village']);
      await tapRect(page, await rect(page, 'pin:village'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.lastPin), { timeout: 20_000 }).toBe('village');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/map-table.png` });
      // Switching tabs and back still works, and closing works.
      await tapRect(page, await rect(page, 'tab:fish'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.tab), { timeout: 20_000 }).toBe('fish');
      await tapRect(page, await rect(page, 'tab:map'));
      await expect.poll(() => page.evaluate(() => Object.keys((window as any).__menu.mapPins).length), { timeout: 20_000 }).toBe(4);
      await page.evaluate(() => (window as any).__menu.close());
      await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(false);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  } finally { await browser.close(); }
});
