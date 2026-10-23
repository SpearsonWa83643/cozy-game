import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.4 Building interiors, slice 3: the Workshop. Tap the workbench, pick a thing to build, hammer it
// three times, and it pops into the room. Costs village wood and stone; too little shows a gentle "need".
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.INTERIOR_SHOTS ?? '/workspace/cozy-game/screenshots';
type R = { x: number; y: number; w: number; h: number };
const ir = (page: Page, k: string) => page.evaluate((k) => (window as any).__interior.rects[k], k);
const item = (page: Page, k: string) => page.evaluate((k) => (window as any).__interior.itemRect(k), k);
const st = (page: Page) => page.evaluate(() => { const s = (window as any).__interior; return { open: s.open, last: s.lastAction, crafted: s.crafted, craft: s.craft, picker: s.pickerOpen, items: s.items.map((i: any) => i.k) }; });
const tapRect = async (page: Page, r: R) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('workshop: build things from wood and stone', async ({ playwright: _pw }, info) => {
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
          village: { res: { food: 5, wood: 3, stone: 1 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 1 }, { id: 2, type: 'workshop', gx: 4, gy: 1 }],
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

      // The workshop's card has "Go inside!" too.
      const p = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [k.x, k.y] as const);
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForFunction(() => !!(window as any).__vui.rects['card:inside'], null, { timeout: 15_000 });
      await page.waitForTimeout(300);
      await tapRect(page, await page.evaluate(() => (window as any).__vui.rects['card:inside']));
      await expect.poll(async () => (await st(page)).open, { timeout: 15_000 }).toBe(true);
      await page.waitForTimeout(900);
      let s = await st(page);
      expect(s.items.sort()).toEqual(['lamp', 'lumber', 'plant', 'rug', 'toolwall', 'toyboat', 'workbench']);
      expect(await page.evaluate(() => (window as any).__interior.btype)).toBe('workshop');
      await page.screenshot({ path: `${SHOTS}/workshop.png` });
      const res = () => page.evaluate(() => { const r = JSON.parse(localStorage.getItem('cozy.save.v2')!).village.res; return { wood: r.wood, stone: r.stone }; });
      const benchTap = async () => { const b = (await item(page, 'workbench'))!; await page.touchscreen.tap(b.x + b.w / 2, b.y + b.h * 0.72); };

      // Supplies say how much wood and stone there is.
      await tapRect(page, (await item(page, 'lumber'))!);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('lumber:count');

      // Workbench: the picker opens.
      await benchTap();
      await expect.poll(async () => (await st(page)).picker, { timeout: 5_000 }).toBe(true);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/workshop-picker.png` });
      // Stone Frog needs 2 stone: a gentle "need", nothing spent.
      await tapRect(page, await ir(page, 'craft:stonefrog'));
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('need:stonefrog');
      expect((await st(page)).picker).toBe(true);
      // Toy Boat: 1 wood.
      await tapRect(page, await ir(page, 'craft:toyboat'));
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('workbench:start:toyboat');
      expect((await st(page)).picker).toBe(false);
      await page.waitForTimeout(400);
      await benchTap();
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('workbench:hammer1');
      await page.waitForTimeout(300);
      await benchTap();
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('workbench:hammer2');
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${SHOTS}/workshop-hammer.png` });
      await page.waitForTimeout(300);
      await benchTap();
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('workbench:built');
      s = await st(page);
      expect(s.crafted).toBe(1);
      expect(s.items.filter((i: string) => i === 'toyboat').length).toBe(2);
      await expect.poll(res, { timeout: 5_000 }).toEqual({ wood: 2, stone: 1 });

      // Rocking horse: 2 wood + 1 stone (uses the rest).
      await page.waitForTimeout(600);
      await benchTap();
      await expect.poll(async () => (await st(page)).picker, { timeout: 5_000 }).toBe(true);
      await page.waitForTimeout(300);
      await tapRect(page, await ir(page, 'craft:rockinghorse'));
      await expect.poll(async () => (await st(page)).craft?.id, { timeout: 5_000 }).toBe('rockinghorse');
      for (let i = 0; i < 3; i++) { await page.waitForTimeout(300); await benchTap(); }
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('workbench:built');
      await expect.poll(res, { timeout: 5_000 }).toEqual({ wood: 0, stone: 0 });
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${SHOTS}/workshop-built.png` });
      await tapRect(page, (await item(page, 'rockinghorse'))!);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('rockinghorse:rock');

      // Picker closes with its X.
      await page.waitForTimeout(400);
      await benchTap();
      await expect.poll(async () => (await st(page)).picker, { timeout: 5_000 }).toBe(true);
      await page.waitForTimeout(300);
      await tapRect(page, await ir(page, 'pick-close'));
      await expect.poll(async () => (await st(page)).picker, { timeout: 5_000 }).toBe(false);

      // Workshop tray has workshop things; built things are saved.
      await tapRect(page, await ir(page, 'decorate'));
      await page.waitForFunction(() => (window as any).__interior.decorating, null, { timeout: 5_000 });
      for (const t of ['workbench', 'lumber', 'toolwall']) expect(await ir(page, `tray:${t}`)).toBeTruthy();
      expect(await ir(page, 'tray:bed')).toBeFalsy();
      await tapRect(page, await ir(page, 'decorate'));
      await tapRect(page, await ir(page, 'close'));
      await expect.poll(async () => (await st(page)).open, { timeout: 10_000 }).toBe(false);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2')!).interiors['2'].items.map((i: any) => i.k));
      expect(saved).toContain('rockinghorse');
      await page.waitForTimeout(400);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
