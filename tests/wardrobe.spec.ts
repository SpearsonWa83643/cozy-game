import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.36 Wardrobe slice 1: a big character beside an illustrated wardrobe (hats on the shelf, scarves on
// hooks, outfits on hangers, extras in the drawer). Tap an item to wear it; locked items stay locked.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.WARDROBE_SHOTS ?? '/workspace/cozy-game/screenshots';
const look = (page: Page) => page.evaluate(() => (window as any).__cozy.state.look);
const rect = (page: Page, k: string) => page.evaluate((k) => (window as any).__menu.rects[k], k);
const tapRect = async (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('wardrobe: big hero, illustrated wardrobe, tap to wear', async ({ playwright: _pw }, info) => {
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
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
      await page.reload();
      await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
      await page.waitForTimeout(1000);
      await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
      await page.evaluate(() => (window as any).__menu.show('wardrobe'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
      await page.waitForTimeout(1200);
      // Every item has a spot, all inside the panel, none overlapping the hero stage.
      const all = await page.evaluate(() => { const m = (window as any).__menu; return { rects: m.rects, box: m.box }; });
      const ids = Object.keys(all.rects).filter((k) => /^(hat|scarf|outfit|back|feather|shells):/.test(k));
      expect(ids.length).toBe(23);
      for (const k of ids) {
        const r = all.rects[k];
        expect(r.x).toBeGreaterThanOrEqual(all.rects.hero.x + all.rects.hero.w);
        expect(r.x + r.w).toBeLessThanOrEqual(all.box.x + all.box.w);
        expect(r.y + r.h).toBeLessThanOrEqual(all.box.y + all.box.h);
        expect(r.w).toBeGreaterThan(50);
        expect(r.h).toBeGreaterThan(50);
      }
      // The hero fills most of its stage.
      const hero = await page.evaluate(() => { const h = (window as any).__menu.heroImg; return { h: h.displayHeight }; });
      expect(hero.h).toBeGreaterThan(all.rects.hero.h * 0.6);
      await page.screenshot({ path: `${SHOTS}/wardrobe.png` });
      // Tap to wear.
      expect((await look(page)).outfit).toBe('teal');
      await tapRect(page, await rect(page, 'outfit:moss'));
      await expect.poll(async () => (await look(page)).outfit, { timeout: 20_000 }).toBe('moss');
      await page.waitForTimeout(600);
      await tapRect(page, await rect(page, 'hat:none'));
      await expect.poll(async () => (await look(page)).hat, { timeout: 20_000 }).toBe('none');
      await page.waitForTimeout(600);
      // Locked: nothing changes.
      await tapRect(page, await rect(page, 'scarf:petal'));
      await page.waitForTimeout(1500);
      expect((await look(page)).scarf).toBe('red');
      await tapRect(page, await rect(page, 'hat:straw'));
      await expect.poll(async () => (await look(page)).hat, { timeout: 20_000 }).toBe('straw');
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  } finally { await browser.close(); }
});
