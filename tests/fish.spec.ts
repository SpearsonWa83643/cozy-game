import { test, expect, chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.37 De-flatten slice 3: the Fish tab is an aquarium. Caught fish swim in a glass tank; journal cards
// below list every species. Tap a fish (or its card) and it darts and says hello.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.FISH_SHOTS ?? '/workspace/cozy-game/screenshots';

test('fish: aquarium with swimming caught fish and journal cards', async ({ playwright: _pw }, info) => {
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
        const fish = { bluegill: { n: 3, best: 18 }, golden_carp: { n: 1, best: 40 }, brook_trout: { n: 2, best: 30 }, moonfish: { n: 1, best: 44 }, old_boot: { n: 1, best: 28 } };
        localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
      });
      await page.reload();
      await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
      await page.waitForTimeout(1000);
      await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
      await page.evaluate(() => (window as any).__menu.show('fish'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
      const ids = await page.evaluate(() => (window as any).__menu.tankFish.map((f: any) => f.id).sort());
      expect(ids).toEqual(['bluegill', 'brook_trout', 'golden_carp', 'moonfish', 'old_boot']);
      // They swim: a fish moves over time.
      const x0 = await page.evaluate(() => (window as any).__menu.tankFish.find((f: any) => f.id === 'bluegill').x);
      await expect.poll(() => page.evaluate(() => (window as any).__menu.tankFish.find((f: any) => f.id === 'bluegill').x), { timeout: 30_000 }).not.toBe(x0);
      // Every journal card is on screen and tappable-sized.
      const vp = page.viewportSize()!;
      for (const k of ['fishcard:bluegill', 'fishcard:old_boot']) {
        const r = await page.evaluate((k) => (window as any).__menu.rects[k], k);
        expect(r.h).toBeGreaterThanOrEqual(44);
        expect(r.y + r.h).toBeLessThanOrEqual(vp.height);
        expect(r.x + r.w).toBeLessThanOrEqual(vp.width);
      }
      // Tap a swimming fish right where it is.
      const p = await page.evaluate(() => { const f = (window as any).__menu.tankFish.find((f: any) => f.id === 'golden_carp'); return { x: f.img.x, y: f.img.y }; });
      await page.touchscreen.tap(p.x, p.y);
      await expect.poll(() => page.evaluate(() => (window as any).__menu.lastFish), { timeout: 20_000 }).toBe('golden_carp');
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${SHOTS}/fish-aquarium.png` });
      // Tap an uncaught card: a hint about where to look.
      const r = await page.evaluate(() => (window as any).__menu.rects['fishcard:pike']);
      await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
      await expect.poll(() => page.evaluate(() => (window as any).__menu.lastFish), { timeout: 20_000 }).toBe('pike');
      await expect.poll(() => page.evaluate(() => (window as any).__menu.hintText?.text ?? ''), { timeout: 20_000 }).toContain('lake');
      // Switch away and back: no leftovers, still swimming.
      await page.evaluate(() => (window as any).__menu.show('map'));
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => (window as any).__menu.tankFish.length)).toBe(0);
      await page.evaluate(() => (window as any).__menu.show('fish'));
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => (window as any).__menu.tankFish.length)).toBe(5);
      await page.evaluate(() => (window as any).__menu.close());
      await page.waitForTimeout(500);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  } finally { await browser.close(); }
});
