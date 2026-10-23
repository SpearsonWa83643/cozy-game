import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.4 Building interiors, slice 1: step inside your Home. Tap things to play; Decorate to add, drag and
// bin furniture. The room is saved per building.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.INTERIOR_SHOTS ?? '/workspace/cozy-game/screenshots';
type R = { x: number; y: number; w: number; h: number };
const ir = (page: Page, k: string) => page.evaluate((k) => (window as any).__interior.rects[k], k);
const item = (page: Page, k: string) => page.evaluate((k) => (window as any).__interior.itemRect(k), k);
const st = (page: Page) => page.evaluate(() => { const s = (window as any).__interior; return { open: s.open, decorating: s.decorating, lampOn: s.lampOn, last: s.lastAction, items: s.items.map((i: any) => i.k) }; });
const tapRect = async (page: Page, r: R) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
const tapLow = async (page: Page, r: R) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h * 0.7);

test('interior: go inside the home, play, decorate, saved', async ({ playwright: _pw }, info) => {
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
          village: { res: { food: 5, wood: 1, stone: 0 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 1 }],
            villagers: [{ id: 3, name: 'Bea', trait: 'Loves flowers', kind: 0, job: null, food: 1, sleep: 1, fun: 1 }], nextId: 8, wanderer: 0, events: 0 },
        }));
      });
      await page.reload();
      await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
      await page.evaluate(() => (window as any).__cozy.villageSpeed(0));
      await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
      const home = (await page.evaluate(() => (window as any).__cozy.village())).buildings.find((b: any) => b.id === 1);
      await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y + 160), [home.x, home.y] as const);
      await page.waitForTimeout(1200);

      // 1. Tap the home: its card has a "Go inside!" button.
      const p = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [home.x, home.y] as const);
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForFunction(() => !!(window as any).__vui.rects['card:inside'], null, { timeout: 15_000 });
      await page.waitForTimeout(300);
      await tapRect(page, await page.evaluate(() => (window as any).__vui.rects['card:inside']));
      await expect.poll(async () => (await st(page)).open, { timeout: 15_000 }).toBe(true);
      await page.waitForTimeout(900);
      let s = await st(page);
      expect(s.items.sort()).toEqual(['bed', 'chair', 'lamp', 'painting', 'plant', 'rug', 'table']);
      expect(await page.evaluate(() => (window as any).__game.registry.get('menuOpen'))).toBe(true);
      await page.screenshot({ path: `${SHOTS}/interior-home.png` });

      // 2. Play: the lamp turns off and on; the bed makes you sleepy; the plant gets watered.
      await tapLow(page, (await item(page, 'lamp'))!);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('lamp:off');
      expect((await st(page)).lampOn).toBe(false);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/interior-night.png` });
      await tapLow(page, (await item(page, 'lamp'))!);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('lamp:on');
      await tapRect(page, (await item(page, 'bed'))!);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('bed:sleep');
      await tapRect(page, (await item(page, 'plant'))!);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('plant:water');

      // 3. Decorate: the tray appears; tap the teddy to add it.
      await tapRect(page, await ir(page, 'decorate'));
      await expect.poll(async () => (await st(page)).decorating, { timeout: 5_000 }).toBe(true);
      await tapRect(page, await ir(page, 'tray:teddy'));
      await expect.poll(async () => (await st(page)).items.includes('teddy'), { timeout: 5_000 }).toBe(true);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${SHOTS}/interior-decorate.png` });

      // 4. Drag the chair somewhere new (CDP touch), then drag the painting into the bin.
      const cdp = await ctx.newCDPSession(page);
      const drag = async (from: [number, number], to: [number, number]) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from[0], y: from[1] }] });
        for (let i = 1; i <= 12; i++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from[0] + ((to[0] - from[0]) * i) / 12, y: from[1] + ((to[1] - from[1]) * i) / 12 }] });
          await page.waitForTimeout(30);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(400);
      };
      const ch = (await item(page, 'chair'))!;
      const x0 = await page.evaluate(() => (window as any).__interior.items.find((i: any) => i.k === 'chair').x);
      await drag([ch.x + ch.w / 2, ch.y + ch.h * 0.6], [ch.x + ch.w / 2 - 260, ch.y + ch.h * 0.6 + 20]);
      expect((await st(page)).last).toBe('move:chair');
      expect(await page.evaluate(() => (window as any).__interior.items.find((i: any) => i.k === 'chair').x)).toBeLessThan(x0 - 0.1);
      const pt = (await item(page, 'painting'))!;
      const bin = await ir(page, 'bin');
      await drag([pt.x + pt.w / 2, pt.y + pt.h / 2], [bin.x + bin.w / 2, bin.y + bin.h / 2]);
      expect((await st(page)).last).toBe('bin:painting');
      expect((await st(page)).items).not.toContain('painting');

      // 5. Done, then out the door. The room is saved.
      await tapRect(page, await ir(page, 'decorate'));
      await expect.poll(async () => (await st(page)).decorating, { timeout: 5_000 }).toBe(false);
      await tapRect(page, await ir(page, 'door'));
      await expect.poll(async () => (await st(page)).open, { timeout: 10_000 }).toBe(false);
      await expect.poll(() => page.evaluate(() => (window as any).__game.registry.get('menuOpen')), { timeout: 5_000 }).toBe(false);
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2')!).interiors?.['1']?.items?.map((i: any) => i.k).sort()), { timeout: 5_000 })
        .toEqual(['bed', 'chair', 'lamp', 'plant', 'rug', 'table', 'teddy']);

      // 6. Back inside (straight from the event): the teddy is still there.
      await page.waitForTimeout(600);
      await page.evaluate(() => (window as any).__game.events.emit('interior', { id: 1, type: 'home', name: 'Home' }));
      await expect.poll(async () => (await st(page)).open, { timeout: 10_000 }).toBe(true);
      expect((await st(page)).items).toContain('teddy');
      await page.waitForTimeout(700);
      await tapRect(page, (await item(page, 'teddy'))!);
      await expect.poll(async () => (await st(page)).last, { timeout: 5_000 }).toBe('teddy:hug');
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
