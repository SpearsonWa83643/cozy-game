import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 12.1 Regression: after leaving ANY building interior the hero must walk again (tap-to-move and the stick).
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
type R = { x: number; y: number; w: number; h: number };
const ir = (page: Page, k: string) => page.evaluate((k) => (window as any).__interior.rects[k], k);
const hero = (page: Page) => page.evaluate(() => { const s = (window as any).__cozy.state; return { x: s.x, y: s.y }; });
const tapRect = async (page: Page, r: R) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
const TYPES: [string, number, number, number][] = [['home', 1, 0, 1], ['kitchen', 2, 4, 1], ['workshop', 3, 8, 1], ['garden', 4, 0, 5], ['fishhut', 5, 4, 5]];

test('exiting every interior leaves the hero able to walk (tap + stick)', async ({ playwright: _pw }, info) => {
  test.setTimeout(500_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate((T) => {
      localStorage.clear();
      localStorage.setItem('cozy.save.v2', JSON.stringify({
        v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: ['feed', 'pantry', 'nearbed'],
        village: { res: { food: 5, wood: 3, stone: 1 }, buildings: T.map(([type, id, gx, gy]: any) => ({ id, type, gx, gy })),
          villagers: [{ id: 9, name: 'Bea', trait: 'Loves flowers', kind: 0, job: null, food: 1, sleep: 1, fun: 1 }], nextId: 12, wanderer: 0, events: 0 },
      }));
    }, TYPES as any);
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.evaluate(() => (window as any).__cozy.villageSpeed(0));
    await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
    const cdp = await ctx.newCDPSession(page);

    const dist = async (h: { x: number; y: number }) => { const n = await hero(page); return Math.hypot(n.x - h.x, n.y - h.y); };
    const stickTry = async (dx: number) => {
      const h1 = await hero(page);
      const sx = 420, sy = 600;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
      for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + dx * i * 12, y: sy, id: 1 }] }); await page.waitForTimeout(60); }
      let ok = false;
      for (let i = 0; i < 40 && !ok; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + dx * 72.5, y: sy, id: 1 }] });
        await page.waitForTimeout(250);
        ok = (await dist(h1)) > 30;
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
      return ok;
    };
    const walkCheck = async (label: string) => {
      const dismissDialog = async () => { for (let i = 0; i < 10 && (await page.evaluate(() => (window as any).__cozy.state.dialogOpen)); i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); } };
      await dismissDialog();
      // Tap to walk: tap open ground near the hero (screen space); try each side so water / walls cannot hide a pass.
      let moved = false;
      for (const [ox, oy] of [[130, 40], [-130, 40], [0, -130], [0, 130]]) {
        const h0 = await hero(page);
        const sp = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [h0.x + ox, h0.y + oy] as const);
        await page.touchscreen.tap(sp.x, sp.y);
        for (let i = 0; i < 16 && !moved; i++) { await page.waitForTimeout(400); moved = (await dist(h0)) > 40; }
        if (moved) break;
        await dismissDialog();
      }
      expect(moved, `${label}: tap-to-walk moved`).toBe(true);
      await page.waitForTimeout(1200);
      // (a sign may have popped a hint dialog on the way; that is unrelated to the bug)
      await dismissDialog();
      // Stick: drag right (or left if a wall is in the way) and the hero must move.
      const ok = (await stickTry(1)) || (await stickTry(-1));
      if (!ok) await page.screenshot({ path: 'test-results/stick-fail.png' });
      expect(ok, `${label}: stick moved`).toBe(true);
    };

    for (const [type, id] of TYPES) {
      const b = (await page.evaluate(() => (window as any).__cozy.village())).buildings.find((q: any) => q.id === id);
      await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y + 170), [b.x, b.y] as const);
      await page.waitForTimeout(900);
      if (id === 1) { await walkCheck('control before any interior'); await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y + 170), [b.x, b.y] as const); }
      await page.waitForTimeout(700);
      const p = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [b.x, b.y] as const);
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForFunction(() => !!(window as any).__vui.rects['card:inside'], null, { timeout: 15_000 });
      await page.waitForTimeout(300);
      await tapRect(page, await page.evaluate(() => (window as any).__vui.rects['card:inside']));
      await expect.poll(() => page.evaluate(() => (window as any).__interior.open), { timeout: 15_000 }).toBe(true);
      expect(await page.evaluate(() => (window as any).__interior.btype)).toBe(type);
      await page.waitForTimeout(700);
      await tapRect(page, await ir(page, 'close'));
      await expect.poll(() => page.evaluate(() => (window as any).__interior.open), { timeout: 10_000 }).toBe(false);
      await expect.poll(() => page.evaluate(() => { const i = (window as any).__interior; return i.children.length; }), { timeout: 15_000, message: `${type}: room cleared` }).toBe(0);
      await expect.poll(() => page.evaluate(() => (window as any).__game.registry.get('menuOpen')), { timeout: 8_000, message: `${type}: menuOpen cleared` }).toBeFalsy();
      // Root cause guard: the closed room must not leave anything registered in the Interior scene's input list.
      await expect.poll(() => page.evaluate(() => (window as any).__interior.input._list.length), { timeout: 8_000, message: `${type}: interior input list empty after exit` }).toBe(0);
      await page.waitForTimeout(300);
      await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y + 170), [b.x, b.y] as const);
      await page.waitForTimeout(700);
      await walkCheck(`${type} after exit`);
    }
    expect(errors).toEqual([]);
    await page.close();
  } finally {
    await browser.close();
  }
});
