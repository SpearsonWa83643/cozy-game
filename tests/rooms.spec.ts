import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.4 Building interiors, slice 4: the Garden shed (grow flowers in pots, water them all) and the
// Fishing hut (cast into the fishing hole, a fish hops out and back in).
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.INTERIOR_SHOTS ?? '/workspace/cozy-game/screenshots';
type R = { x: number; y: number; w: number; h: number };
const ir = (page: Page, k: string) => page.evaluate((k) => (window as any).__interior.rects[k], k);
const item = (page: Page, k: string) => page.evaluate((k) => (window as any).__interior.itemRect(k), k);
const st = (page: Page) => page.evaluate(() => { const s = (window as any).__interior; return { open: s.open, last: s.lastAction, grown: s.grown, picked: s.picked, caught: s.caught, items: s.items.map((i: any) => i.k) }; });
const tapRect = async (page: Page, r: R) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('garden shed + fishing hut interiors', async ({ playwright: _pw }, info) => {
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
          v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: { sunfish: { n: 2, best: 10 } }, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: ['feed', 'pantry', 'nearbed'],
          village: { res: { food: 5, wood: 3, stone: 1 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 1 }, { id: 2, type: 'garden', gx: 4, gy: 1 }, { id: 4, type: 'fishhut', gx: 7, gy: 0 }],
            villagers: [{ id: 3, name: 'Bea', trait: 'Loves flowers', kind: 0, job: null, food: 1, sleep: 1, fun: 1 }], nextId: 8, wanderer: 0, events: 0 },
        }));
      });
      await page.reload();
      await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
      await page.evaluate(() => (window as any).__cozy.villageSpeed(0));
      await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
      const goIn = async (id: number) => {
        const k = (await page.evaluate(() => (window as any).__cozy.village())).buildings.find((b: any) => b.id === id);
        await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y + 170), [k.x, k.y] as const);
        await page.waitForTimeout(2500); // let the camera settle on the hero before mapping to the screen
        const p = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [k.x, k.y] as const);
        await page.touchscreen.tap(p.x, p.y);
        await page.waitForFunction(() => !!(window as any).__vui.rects['card:inside'], null, { timeout: 15_000 });
        await page.waitForTimeout(300);
        await tapRect(page, await page.evaluate(() => (window as any).__vui.rects['card:inside']));
        await expect.poll(async () => (await st(page)).open, { timeout: 15_000 }).toBe(true);
        await page.waitForTimeout(900);
      };
      const tapItem = async (k: string) => tapRect(page, (await item(page, k))!);
      const last = async (v: string) => expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe(v);

      // ---- Garden shed.
      await goIn(2);
      expect(await page.evaluate(() => (window as any).__interior.btype)).toBe('garden');
      expect((await st(page)).items.sort()).toEqual(['plant', 'pot', 'pot_1', 'pot_2', 'rug', 'seedrack', 'veggiebasket', 'wateringcan']);
      await page.screenshot({ path: `${SHOTS}/garden.png` });
      await tapItem('veggiebasket'); await last('veggiebasket:count');
      await page.waitForTimeout(300);
      await tapItem('seedrack'); await last('seedrack:seeds');
      // The bud blooms; tap the bloom to pick it.
      await page.waitForTimeout(300);
      await tapItem('pot_2'); await last('pot_2:grow');
      expect((await st(page)).items).toContain('pot_3');
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${SHOTS}/garden-bloom.png` });
      await tapItem('pot_3'); await last('pot_3:pick');
await expect.poll(async () => (await st(page)).picked, { timeout: 5_000 }).toBe(1);
      await expect.poll(async () => (await st(page)).items.filter((i: string) => i === 'pot').length, { timeout: 5_000 }).toBe(2);
      // The watering can waters every pot at once: pot, pot → pot_1; pot_1 → pot_2.
      await page.waitForTimeout(500);
      await tapItem('wateringcan'); await last('wateringcan:water');
      await expect.poll(async () => (await st(page)).items.filter((i: string) => i.startsWith('pot')).sort(), { timeout: 5_000 }).toEqual(['pot_1', 'pot_1', 'pot_2']);
      await expect.poll(async () => (await st(page)).grown, { timeout: 5_000 }).toBe(4);
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2')!).interiors?.['2']?.items.map((i: any) => i.k).filter((k: string) => k.startsWith('pot')).sort()), { timeout: 5_000 }).toEqual(['pot_1', 'pot_1', 'pot_2']);
      await page.waitForTimeout(700);
      await tapRect(page, await ir(page, 'decorate'));
      await page.waitForFunction(() => (window as any).__interior.decorating, null, { timeout: 5_000 });
      for (const t of ['pot', 'wateringcan', 'seedrack', 'veggiebasket']) expect(await ir(page, `tray:${t}`)).toBeTruthy();
      expect(await ir(page, 'tray:bed')).toBeFalsy();
      await tapRect(page, await ir(page, 'decorate'));
      await tapRect(page, await ir(page, 'close'));
      await expect.poll(async () => (await st(page)).open, { timeout: 10_000 }).toBe(false);
      await page.waitForTimeout(800);

      // ---- Fishing hut.
      // (The card's "Go inside!" path is shared and covered above by the garden; open the hut via the same event.)
      await page.evaluate(() => (window as any).__interior.game.events.emit('interior', { id: 4, type: 'fishhut', name: 'Fishing Hut' }));
      await expect.poll(async () => (await st(page)).open, { timeout: 15_000 }).toBe(true);
      await page.waitForTimeout(900);
      expect(await page.evaluate(() => (window as any).__interior.btype)).toBe('fishhut');
      expect((await st(page)).items.sort()).toEqual(['chair', 'fishbarrel', 'fishhole', 'lifering', 'plant', 'rodrack']);
      await page.screenshot({ path: `${SHOTS}/fishhut.png` });
      await tapItem('fishhole'); await last('fishhole:cast');
      await tapItem('fishhole'); await last('fishhole:wait');
      await last('fishhole:caught');
      await expect.poll(async () => (await st(page)).caught, { timeout: 5_000 }).toBe(1);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${SHOTS}/fishhut-catch.png` });
      await page.waitForTimeout(1200);
      await tapItem('fishbarrel'); await last('fishbarrel:count');
      await page.waitForTimeout(300);
      await tapItem('lifering'); await last('lifering:spin');
      await page.waitForTimeout(300);
      await tapItem('rodrack'); await last('rodrack:rods');
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
