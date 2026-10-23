import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.4 Building interiors, slice 2: the Kitchen. Cook breakfast on the stove in three taps (pancakes, then
// eggs), brew coffee, peek in the fridge, wash at the sink. Kitchen tray + tiles and a checkerboard floor.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.INTERIOR_SHOTS ?? '/workspace/cozy-game/screenshots';
type R = { x: number; y: number; w: number; h: number };
const ir = (page: Page, k: string) => page.evaluate((k) => (window as any).__interior.rects[k], k);
const item = (page: Page, k: string) => page.evaluate((k) => (window as any).__interior.itemRect(k), k);
const st = (page: Page) => page.evaluate(() => { const s = (window as any).__interior; return { open: s.open, last: s.lastAction, meals: s.meals, coffees: s.coffees, recipe: s.recipe, stage: s.cookStage, items: s.items.map((i: any) => i.k) }; });
const tapRect = async (page: Page, r: R) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('kitchen: cook breakfast, brew coffee', async ({ playwright: _pw }, info) => {
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
        localStorage.setItem('cozy.save.v2', JSON.stringify({
          v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: ['feed', 'pantry', 'nearbed'],
          village: { res: { food: 5, wood: 1, stone: 0 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 1 }, { id: 2, type: 'kitchen', gx: 4, gy: 1 }],
            villagers: [{ id: 3, name: 'Bea', trait: 'Loves flowers', kind: 0, job: null, food: 1, sleep: 1, fun: 1 }], nextId: 8, wanderer: 0, events: 0 },
        }));
      });
      await page.reload();
      await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
      await page.evaluate(() => (window as any).__cozy.villageSpeed(0));
      await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
      const k = (await page.evaluate(() => (window as any).__cozy.village())).buildings.find((b: any) => b.id === 2);
      await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y + 170), [k.x, k.y] as const);
      await page.waitForTimeout(1200);

      // The kitchen's card has "Go inside!" too.
      const p = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [k.x, k.y] as const);
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForFunction(() => !!(window as any).__vui.rects['card:inside'], null, { timeout: 15_000 });
      await page.waitForTimeout(300);
      await tapRect(page, await page.evaluate(() => (window as any).__vui.rects['card:inside']));
      await expect.poll(async () => (await st(page)).open, { timeout: 15_000 }).toBe(true);
      await page.waitForTimeout(900);
      let s = await st(page);
      expect(s.items.sort()).toEqual(['chair', 'chair', 'clock', 'coffee', 'fridge', 'plant', 'sink', 'stove', 'table']);
      expect(await page.evaluate(() => (window as any).__interior.btype)).toBe('kitchen');
      await page.screenshot({ path: `${SHOTS}/kitchen.png` });

      // Pancakes: pour, flip, breakfast.
      const stove = (await item(page, 'stove'))!;
      await tapRect(page, stove);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('stove:pour');
      await page.waitForTimeout(400);
      await tapRect(page, stove);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('stove:flip');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/kitchen-cooking.png` });
      await tapRect(page, stove);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('stove:breakfast');
      s = await st(page);
      expect(s).toMatchObject({ meals: 1, recipe: 'eggs', stage: 0 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SHOTS}/kitchen-breakfast.png` });

      // Next time it's eggs: crack, sizzle, breakfast.
      await tapRect(page, stove);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('stove:crack');
      await page.waitForTimeout(300);
      await tapRect(page, stove);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('stove:sizzle');
      await page.waitForTimeout(300);
      await tapRect(page, stove);
      await expect.poll(async () => (await st(page)).meals, { timeout: 5_000 }).toBe(2);

      // Coffee brews, then a second tap while brewing just says "almost".
      await tapRect(page, (await item(page, 'coffee'))!);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('coffee:brew');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/kitchen-coffee.png` });
      await expect.poll(async () => (await st(page)).coffees, { timeout: 5_000 }).toBe(1);

      // Fridge and sink.
      await tapRect(page, (await item(page, 'fridge'))!);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('fridge:open');
      await tapRect(page, (await item(page, 'sink'))!);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('sink:wash');

      // Kitchen tray has kitchen things.
      await tapRect(page, await ir(page, 'decorate'));
      await page.waitForFunction(() => (window as any).__interior.decorating, null, { timeout: 5_000 });
      for (const t of ['stove', 'coffee', 'fridge', 'sink']) expect(await ir(page, `tray:${t}`)).toBeTruthy();
      expect(await ir(page, 'tray:bed')).toBeFalsy();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/kitchen-decorate.png` });
      await tapRect(page, await ir(page, 'decorate'));
      await tapRect(page, await ir(page, 'close'));
      await expect.poll(async () => (await st(page)).open, { timeout: 10_000 }).toBe(false);
      await page.waitForTimeout(400);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
