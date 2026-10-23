import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.36 Wardrobe slice 1: a big character beside an illustrated wardrobe (hats on the shelf, scarves on
// hooks, outfits on hangers, extras in the drawer). Tap an item to wear it; locked items stay locked.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.WARDROBE_SHOTS ?? '/workspace/cozy-game/screenshots';
const look = (page: Page) => page.evaluate(() => (window as any).__cozy.state.look);
const rect = (page: Page, k: string) => page.evaluate((k) => (window as any).__menu.rects[k], k);
const reaction = (page: Page) => page.evaluate(() => (window as any).__menu.lastReaction);
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
      expect(await reaction(page)).toBe('outfit');
      await page.waitForTimeout(600);
      await tapRect(page, await rect(page, 'hat:none'));
      await expect.poll(async () => (await look(page)).hat, { timeout: 20_000 }).toBe('none');
      expect(await reaction(page)).toBe('off');
      await page.waitForTimeout(600);
      // 9.36 slice 3: a scarf makes the hero wiggle (with sparkles).
      await tapRect(page, await rect(page, 'scarf:none'));
      await expect.poll(async () => (await look(page)).scarf, { timeout: 20_000 }).toBe('none');
      await page.waitForTimeout(600);
      await tapRect(page, await rect(page, 'scarf:red'));
      await expect.poll(async () => (await look(page)).scarf, { timeout: 20_000 }).toBe('red');
      expect(await reaction(page)).toBe('scarf');
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${SHOTS}/wardrobe-react.png` });
      await page.waitForTimeout(600);
      // Locked: nothing changes.
      await tapRect(page, await rect(page, 'scarf:petal'));
      await page.waitForTimeout(1500);
      expect((await look(page)).scarf).toBe('red');
      await tapRect(page, await rect(page, 'hat:straw'));
      await expect.poll(async () => (await look(page)).hat, { timeout: 20_000 }).toBe('straw');
      expect(await reaction(page)).toBe('hat');
      // After the reaction the hero settles back to normal (poll: tweens run slowly on a loaded box).
      await expect.poll(async () => {
        const sq = await page.evaluate(() => (window as any).__menu.heroSquash);
        return Math.max(Math.abs(sq.x - 1), Math.abs(sq.y - 1));
      }, { timeout: 15_000 }).toBeLessThan(0.02);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  } finally { await browser.close(); }
});

// 9.36 slice 2: drag an item onto the character to wear it, drag a worn item off the character to take it
// off, and anything dropped elsewhere springs back home.
test('wardrobe: drag and drop dress-up', async ({ playwright: _pw }, info) => {
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
      const cdp = await page.context().newCDPSession(page);
      const pt = (x: number, y: number) => [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
      const drag = async (x0: number, y0: number, x1: number, y1: number, shot?: string) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0, y0) });
        await page.waitForTimeout(150);
        for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x0 + ((x1 - x0) * i) / 10, y0 + ((y1 - y0) * i) / 10) }); await page.waitForTimeout(120); }
        await page.waitForTimeout(400);
        if (shot) await page.screenshot({ path: shot });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      const c = (r: { x: number; y: number; w: number; h: number }) => [r.x + r.w / 2, r.y + r.h / 2] as const;
      const hero = await rect(page, 'hero');
      // Drag the moss tunic onto the character: worn.
      const [mx, my] = c(await rect(page, 'outfit:moss'));
      await drag(mx, my, hero.x + hero.w / 2, hero.y + hero.h * 0.6, `${SHOTS}/wardrobe-drag.png`);
      await expect.poll(async () => (await look(page)).outfit, { timeout: 20_000 }).toBe('moss');
      await expect.poll(() => page.evaluate(() => (window as any).__menu.drag), { timeout: 20_000 }).toBe(null);
      // Drag the straw hat around and drop it back in the wardrobe: nothing changes, it springs home.
      const [sx, sy] = c(await rect(page, 'hat:straw'));
      await drag(sx, sy, sx - 60, sy + 140);
      await page.waitForTimeout(1500);
      expect((await look(page)).hat).toBe('straw');
      expect(await page.evaluate(() => (window as any).__menu.drag)).toBe(null);
      // Drag the hat off the character's head into the wardrobe: taken off.
      const h = await page.evaluate(() => { const i = (window as any).__menu.heroImg; return { x: i.x, top: i.y - i.displayHeight, dh: i.displayHeight }; });
      await drag(h.x, h.top + h.dh * 0.2, sx, sy + 120);
      await expect.poll(async () => (await look(page)).hat, { timeout: 20_000 }).toBe('none');
      // Locked items don't drag.
      const [px, py] = c(await rect(page, 'scarf:petal'));
      await drag(px, py, hero.x + hero.w / 2, hero.y + hero.h * 0.5);
      await page.waitForTimeout(1500);
      expect((await look(page)).scarf).toBe('red');
      // A plain tap still works.
      await tapRect(page, await rect(page, 'hat:straw'));
      await expect.poll(async () => (await look(page)).hat, { timeout: 20_000 }).toBe('straw');
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  } finally { await browser.close(); }
});

// 9.36 slice 4: newly unlocked items glow "new" (this visit only), and the wardrobe dresses up per theme.
test('wardrobe: new glow + themed wardrobe', async ({ playwright: _pw }, info) => {
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
        const free = ['hat:straw', 'hat:none', 'scarf:red', 'scarf:none', 'outfit:teal', 'outfit:moss', 'back:none'];
        localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: ['acorn_cap'], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [], seenWardrobe: free }));
      });
      await page.reload();
      await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
      await page.waitForTimeout(1000);
      await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
      const openWardrobe = async () => {
        await page.evaluate(() => (window as any).__menu.show('wardrobe'));
        await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
        await page.waitForTimeout(1000);
      };
      const closeMenu = async () => {
        await page.evaluate(() => (window as any).__menu.close());
        await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(false);
        await page.waitForTimeout(600);
      };
      const newIds = () => page.evaluate(() => [...((window as any).__menu.newIds ?? [])]);
      await openWardrobe();
      expect(await newIds()).toEqual(['hat:acorn']);
      await page.screenshot({ path: `${SHOTS}/wardrobe-new.png` });
      // Still "new" after a re-render within the same visit, until you wear it.
      await tapRect(page, await rect(page, 'outfit:moss'));
      await expect.poll(async () => (await look(page)).outfit, { timeout: 20_000 }).toBe('moss');
      expect(await newIds()).toEqual(['hat:acorn']);
      await tapRect(page, await rect(page, 'hat:acorn'));
      await expect.poll(async () => (await look(page)).hat, { timeout: 20_000 }).toBe('acorn');
      expect(await newIds()).toEqual([]);
      await closeMenu();
      await openWardrobe();
      expect(await newIds()).toEqual([]);
      // Each theme dresses the wardrobe.
      for (const t of ['fall', 'halloween', 'christmas', 'spring']) {
        await closeMenu();
        await page.evaluate((t) => (window as any).__cozy.setTheme(t), t);
        await page.waitForTimeout(1500);
        await openWardrobe();
        expect(await page.evaluate(() => (window as any).__menu.wardrobeTheme)).toBe(t);
        if (t !== 'spring') await page.screenshot({ path: `${SHOTS}/wardrobe-${t}.png` });
      }
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  } finally { await browser.close(); }
});
