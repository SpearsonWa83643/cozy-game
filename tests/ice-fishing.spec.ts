import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 11.5b Winter frozen pond + ice fishing: in Winter the pond and lake are ice, the boats are put away,
// tapping the ice chips a hole and the usual fishing flow runs through it (catch gets a frosty touch).
// Back in another theme the ice is gone and the boats work again.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.ICE_SHOTS ?? '/workspace/cozy-game/screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const ice = (page: Page) => cozy(page, 'ice()');
const boat = (page: Page) => cozy(page, 'boat()');
const fishState = async (page: Page) => (await cozy(page, 'fish()')).state as string;

async function boot(page: Page) {
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
}
async function closeDialogs(page: Page) {
  for (let i = 0; i < 12 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 300); await page.waitForTimeout(500); }
}
async function tapWorld(page: Page, x: number, y: number) {
  await page.waitForTimeout(300);
  const p = await page.evaluate(([a, b]) => (window as any).__cozy.worldToScreen(a, b), [x, y]);
  await page.touchscreen.tap(p.x, p.y);
}
async function teleport(page: Page, x: number, y: number) {
  await page.evaluate(([a, b]) => (window as any).__cozy.teleport(a, b), [x, y]);
  await page.waitForTimeout(1200);
}

test('winter: frozen pond, ice fishing through a hole, boats put away; boats back in spring', async ({ playwright: _pw }, info) => {
  test.setTimeout(600_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await boot(page);
      await closeDialogs(page);
      // Not winter yet: liquid water, boats ready.
      const i0 = await ice(page);
      expect(i0.frozen).toBe(false);
      const b0 = await boat(page);
      expect(b0.open).toBe(true);
      expect(b0.visible).toEqual([true, true]);
      const [pondBoat, lakeBoat] = b0.boats;

      // 1. Winter: the pond and lake freeze, lilies tuck away, boats are hidden and can't be boarded.
      await page.evaluate(() => (window as any).__cozy.setTheme('winter'));
      await page.waitForTimeout(800);
      await closeDialogs(page);
      const i1 = await ice(page);
      expect(i1.frozen).toBe(true);
      expect(i1.ice).toEqual({ pond: true, lake: true });
      expect(i1.lilies).toBe(0);
      const b1 = await boat(page);
      expect(b1.open).toBe(false);
      expect(b1.visible).toEqual([false, false]);
      expect(b1.enabled).toEqual([false, false]);

      // 2. Stand where the pond boat was and tap it: no boat ride, the hero chips an ice hole instead.
      await teleport(page, pondBoat.stand[0], pondBoat.stand[1]);
      await tapWorld(page, pondBoat.x, pondBoat.y - 20);
      await expect.poll(async () => (await ice(page)).cuts, { timeout: 20_000, intervals: [200] }).toBeGreaterThanOrEqual(1);
      expect((await boat(page)).active).toBe(false);
      await expect.poll(() => fishState(page), { timeout: 20_000, intervals: [200] }).toMatch(/wait|bite/);
      const hole = (await ice(page)).holes[0];
      expect(await cozy(page, `waterAt(${hole.x}, ${hole.y})`)).toBe('pond');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/winter-ice-fishing.png` });

      // 3. Play it out: hook the bite and reel with well-timed taps (stamped like world.spec).
      const cdp = await page.context().newCDPSession(page);
      const touch = async (x: number, y: number, epochMs?: number) => {
        const ts = epochMs ? { timestamp: epochMs / 1000 } : {};
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 2, radiusX: 6, radiusY: 6, force: 1 }], ...ts });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], ...ts });
      };
      for (let attempt = 0; attempt < 8 && (await ice(page)).catches === 0; attempt++) {
        if ((await fishState(page)) === 'idle') {
          await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('ui').cardOpen), { timeout: 30_000 }).toBeFalsy();
          await closeDialogs(page);
          // Tapping near the existing hole reuses it (no new hole).
          for (let t = 0; t < 4 && (await fishState(page)) === 'idle'; t++) { await tapWorld(page, hole.x + 8, hole.y); await page.waitForTimeout(1500); }
        }
        await expect.poll(() => fishState(page), { timeout: 90_000, intervals: [150] }).toMatch(/bite|idle/);
        if ((await fishState(page)) !== 'bite') continue;
        await touch(590, 300);
        await expect.poll(() => fishState(page), { timeout: 20_000, intervals: [100] }).toMatch(/reel|idle/);
        for (let k = 0; k < 20 && (await fishState(page)) === 'reel'; k++) {
          const at = await cozy(page, 'fishZoneEpoch(300)');
          if (at < 0) break;
          await page.waitForTimeout(Math.max(0, at - Date.now()));
          await touch(590, 300, at);
          await page.waitForTimeout(400);
        }
        await page.waitForTimeout(1500);
      }
      const i3 = await ice(page);
      expect(i3.catches).toBeGreaterThan(0);
      expect(i3.cuts).toBe(1);
      expect(i3.holes.length).toBe(1);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/winter-ice-fishing-catch.png` });
      if (await page.evaluate(() => (window as any).__game.scene.getScene('ui').cardOpen)) await page.touchscreen.tap(590, 300);
      await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('ui').cardOpen), { timeout: 30_000 }).toBe(false);
      await cdp.detach();

      // 4. The lake is ice too: from beside the pier, the lake boat is gone and a tap on the ice cuts a hole.
      await teleport(page, lakeBoat.stand[0], lakeBoat.stand[1]);
      await closeDialogs(page);
      await tapWorld(page, lakeBoat.x, lakeBoat.y + 40);
      await expect.poll(async () => (await ice(page)).holes.some((h: any) => h.water === 'lake'), { timeout: 20_000, intervals: [200] }).toBe(true);
      expect((await boat(page)).active).toBe(false);
      await expect.poll(() => fishState(page), { timeout: 20_000, intervals: [200] }).toMatch(/wait|bite/);
      await tapWorld(page, lakeBoat.stand[0], lakeBoat.stand[1] - 40); // line back in
      await expect.poll(() => fishState(page), { timeout: 20_000, intervals: [200] }).toBe('idle');

      // 5. Spring: the ice melts away, holes are gone and the boats are back and rideable.
      await page.evaluate(() => (window as any).__cozy.setTheme('spring'));
      await page.waitForTimeout(800);
      await closeDialogs(page);
      const i5 = await ice(page);
      expect(i5.frozen).toBe(false);
      expect(i5.ice).toEqual({ pond: false, lake: false });
      expect(i5.holes.length).toBe(0);
      expect(i5.lilies).toBeGreaterThan(0);
      const b5 = await boat(page);
      expect(b5.open).toBe(true);
      expect(b5.visible).toEqual([true, true]);
      await teleport(page, pondBoat.stand[0], pondBoat.stand[1]);
      await closeDialogs(page);
      await tapWorld(page, pondBoat.x, pondBoat.y - 20);
      await expect.poll(async () => (await boat(page)).active, { timeout: 30_000, intervals: [250] }).toBe(true);
      expect((await ice(page)).cuts).toBe(2); // no holes cut outside Winter
      await page.screenshot({ path: `${SHOTS}/spring-boat-after-ice.png` });

      // 6. Winter arriving while you're in a boat puts you on the shore.
      await page.evaluate(() => (window as any).__cozy.setTheme('winter'));
      await page.waitForTimeout(800);
      expect((await boat(page)).active).toBe(false);
      const s6 = await cozy(page, 'state');
      expect(await cozy(page, `waterAt(${s6.x}, ${s6.y})`)).toBeNull();

      expect(errors).toEqual([]);
    } finally { await ctx.close(); }
  } finally { await browser.close(); }
});
