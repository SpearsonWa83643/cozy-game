import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.38 Mount Stable: a barn with a stall for every mount. Unlocked friends flap; locked ones are silhouettes
// that give a hint about where to find them.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.STABLE_SHOTS ?? '/workspace/cozy-game/screenshots';
const rect = (page: Page, k: string) => page.evaluate((k) => (window as any).__menu.rects[k], k);
const tapRect = async (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('stable: every mount in a stall, locked ones give hints', async ({ playwright: _pw }, info) => {
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
        localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: ['pterodactyl_egg', 'rainbow_horseshoe', 'toy_propeller'], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [], mountPick: 'unicorn' }));
      });
      await page.reload();
      await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
      await page.waitForTimeout(1000);
      await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
      await page.evaluate(() => (window as any).__menu.show('map'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
      // The Stable tab sits in the tab row, clear of the theme buttons.
      const tab = await rect(page, 'tab:stable');
      const th = await rect(page, 'theme:spring');
      expect(tab.w).toBeGreaterThanOrEqual(90);
      expect(tab.x + tab.w).toBeLessThanOrEqual(th.x - 4);
      await tapRect(page, tab);
      await expect.poll(() => page.evaluate(() => (window as any).__menu.tab), { timeout: 20_000 }).toBe('stable');
      await page.waitForTimeout(800);
      const pets = await page.evaluate(() => (window as any).__menu.stablePets.map((p: any) => [p.id, p.on]));
      expect(pets.length).toBe(11);
      const on = pets.filter((p: any) => p[1]).map((p: any) => p[0]).sort();
      expect(on).toEqual(['airplane', 'eagle', 'pterodactyl', 'unicorn']);
      const vp = page.viewportSize()!;
      for (const k of ['stall:eagle', 'stall:reindeer']) {
        const r = await rect(page, k);
        expect(r.w).toBeGreaterThanOrEqual(80);
        expect(r.y + r.h).toBeLessThanOrEqual(vp.height);
        expect(r.x + r.w).toBeLessThanOrEqual(vp.width);
      }
      // Tap an unlocked friend: it hops and says hello.
      await tapRect(page, await rect(page, 'stall:unicorn'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.lastMount), { timeout: 20_000 }).toBe('unicorn');
      await expect.poll(() => page.evaluate(() => (window as any).__menu.hintText?.text ?? ''), { timeout: 20_000 }).toContain('Unicorn');
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${SHOTS}/stable.png` });
      // Tap a locked one: a hint about where to look.
      await tapRect(page, await rect(page, 'stall:bumblebee'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.hintText?.text ?? ''), { timeout: 20_000 }).toContain('Golden Honeycomb');
      await tapRect(page, await rect(page, 'stall:goose'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.hintText?.text ?? ''), { timeout: 20_000 }).toContain('Fall');
      await page.evaluate(() => (window as any).__menu.close());
      await page.waitForTimeout(500);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  } finally { await browser.close(); }
});
