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
      expect(pets.length).toBe(13);
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
      // Slice 2: a tap pets it (hearts + hop + its own happy sound).
      await expect.poll(() => page.evaluate(() => (window as any).__menu.lastPet), { timeout: 20_000 }).toMatchObject({ id: 'unicorn', kind: 'tap' });
      expect(await page.evaluate(() => (window as any).__menu.lastPet.hearts)).toBeGreaterThanOrEqual(4);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${SHOTS}/stable.png` });
      // Stroking a friend back and forth makes a trail of hearts.
      const cdp = await ctx.newCDPSession(page);
      const pt = (x: number, y: number) => [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
      const stroke = async (k: string) => {
        const r = await rect(page, k);
        const y = r.y + r.h * 0.45;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(r.x + r.w * 0.2, y) });
        for (let i = 1; i <= 16; i++) { const f = (i % 8) / 8; const x = r.x + r.w * (0.2 + 0.6 * (Math.floor(i / 8) % 2 ? 1 - f : f)); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x, y + (i % 2) * 3) }); await page.waitForTimeout(40); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      const h0 = await page.evaluate(() => (window as any).__menu.petHearts);
      await stroke('stall:eagle');
      await expect.poll(() => page.evaluate(() => (window as any).__menu.lastPet), { timeout: 20_000 }).toMatchObject({ id: 'eagle', kind: 'stroke' });
      expect(await page.evaluate(() => (window as any).__menu.petHearts)).toBeGreaterThanOrEqual(h0 + 3);
      await page.waitForTimeout(100);
      await page.screenshot({ path: `${SHOTS}/stable-petting.png` });
      // Stroking a locked silhouette does nothing.
      await page.waitForTimeout(1200);
      const h1 = await page.evaluate(() => (window as any).__menu.petHearts);
      await stroke('stall:snail');
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => (window as any).__menu.petHearts)).toBe(h1);
      // Tap a locked one: a hint about where to look.
      await tapRect(page, await rect(page, 'stall:bumblebee'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.hintText?.text ?? ''), { timeout: 20_000 }).toContain('Golden Honeycomb');
      await tapRect(page, await rect(page, 'stall:goose'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.hintText?.text ?? ''), { timeout: 20_000 }).toContain('Fall');
      // Slice 3: friends have idle moments on their own.
      await expect.poll(() => page.evaluate(() => (window as any).__menu.idleCount), { timeout: 30_000 }).toBeGreaterThanOrEqual(2);
      // Tap the Toy Airplane, then its Ride! button: it becomes your ride, the satchel closes and it flies in.
      await page.waitForTimeout(1500);
      await tapRect(page, await rect(page, 'stall:airplane'));
      await expect.poll(() => page.evaluate(() => !!(window as any).__menu.rects['ride:airplane']), { timeout: 20_000 }).toBe(true);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/stable-ride.png` });
      await tapRect(page, await rect(page, 'ride:airplane'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 20_000 }).toBe(false);
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2')!).mountPick), { timeout: 10_000 }).toBe('airplane');
      await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('world').mount.phase), { timeout: 20_000 }).not.toBe('off');
      expect(await page.evaluate(() => (window as any).__game.scene.getScene('world').mount.def.id)).toBe('airplane');
      await page.waitForTimeout(500);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  } finally { await browser.close(); }
});
