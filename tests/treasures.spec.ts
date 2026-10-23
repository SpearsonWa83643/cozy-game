import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.37 De-flatten slice 2: the Treasures tab is a display cabinet. Found treasures sit under glass domes;
// missing ones are silhouettes. Tap one: it hops and sparkles (found) or shakes and gives a hint (missing).
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.TREASURE_SHOTS ?? '/workspace/cozy-game/screenshots';
const rect = (page: Page, k: string) => page.evaluate((k) => (window as any).__menu.rects[k], k);
const tapRect = async (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('treasures: display cabinet with domes, silhouettes and jars', async ({ playwright: _pw }, info) => {
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
        localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: ['golden_feather', 'rusty_key', 'acorn_cap', 'glow_pearl'], fish: {}, minor: { petal: 12, shell: 4, acorn: 25 }, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
      });
      await page.reload();
      await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
      await page.waitForTimeout(1000);
      await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
      await page.evaluate(() => (window as any).__menu.show('treasures'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
      await page.waitForTimeout(1200);
      const n = await page.evaluate(() => Object.keys((window as any).__menu.treasureImgs).length);
      expect(n).toBeGreaterThanOrEqual(17);
      // Every treasure slot and jar is on screen and big enough to tap.
      const vp = page.viewportSize()!;
      for (const k of ['treasure:golden_feather', 'treasure:golden_honeycomb', 'minor:petal', 'minor:starshard']) {
        const r = await rect(page, k);
        expect(r.w).toBeGreaterThanOrEqual(44);
        expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.w).toBeLessThanOrEqual(vp.width);
        expect(r.y + r.h).toBeLessThanOrEqual(vp.height);
      }
      await tapRect(page, await rect(page, 'treasure:golden_feather'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.lastTreasure), { timeout: 20_000 }).toBe('golden_feather');
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${SHOTS}/treasures-shelf.png` });
      await tapRect(page, await rect(page, 'treasure:fox_hood'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.lastTreasure), { timeout: 20_000 }).toBe('fox_hood');
      await expect.poll(() => page.evaluate(() => (window as any).__menu.hintText?.text ?? ''), { timeout: 20_000 }).toContain('Hint:');
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  } finally { await browser.close(); }
});
