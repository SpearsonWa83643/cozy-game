import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.3 Mount fast travel -> 65 waypoint fly map: while riding, one big Fly! button opens a paper map of the whole
// world with big round site icons (village, stable, jail, every region and puzzle). Tap one and the mount flies there;
// long flights ease the camera out. Places you haven't found on foot are locked.
const FILE = pathToFileURL(resolve(process.env.SINGLE ?? 'dist-single/index.html')).href;
const SHOTS = process.env.FT_SHOTS ?? '/workspace/cozy-game/screenshots';
const mount = (page: Page) => page.evaluate(() => (window as any).__cozy.mount());
// The flight tour: old landmarks, the new regions, the stable and jail, and a puzzle.
const TOUR = ['brookside', 'stable', 'meadow', 'hills', 'jail', 'bay', 'grove', 'p:bells', 'village', 'home'];
const fly = (page: Page) => page.evaluate(() => { const f = (window as any).__vui.fly; return { btn: f.btnShown, open: f.open, pins: f.pins.map((p: any) => ({ id: p.site.id, name: p.site.name, x: p.site.x, y: p.site.y, locked: p.locked, px: p.x, py: p.y, r: p.r })) }; });

async function boot(page: Page, saveJson: string | null, query = '') {
  await page.goto(FILE + query);
  await page.evaluate((sj) => { try { localStorage.clear(); if (sj) localStorage.setItem('cozy.save.v2', sj); } catch { /* */ } }, saveJson);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
}
async function ride(page: Page) {
  const r = await page.evaluate(() => (window as any).__vui.rects.mount);
  await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
  await expect.poll(async () => (await mount(page)).phase, { timeout: 90_000, intervals: [200] }).toBe('ride');
}
const tapRect = async (page: Page, id: string) => {
  const r = await page.evaluate((k) => (window as any).__vui.rects[k], id);
  await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
};

test('fast travel: each landmark button flies the mount there; unknown places stay locked', async ({ playwright: _pw }, info) => {
  test.setTimeout(2_400_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      // 1) A fresh glade: the south bridge is open, so every landmark can be found on foot.
      await boot(page, null);
      const hidden = await page.evaluate(() => (window as any).__vui.travelShown);
      expect(hidden).toBe(false);
      await ride(page);
      await expect.poll(async () => (await fly(page)).btn, { timeout: 10_000 }).toBe(true);
      const vp = page.viewportSize()!;
      const fb = await page.evaluate(() => (window as any).__vui.rects.flymap);
      expect(fb.w).toBeGreaterThanOrEqual(84); expect(fb.x + fb.w).toBeLessThanOrEqual(vp.width);
      const openMap = async () => {
        await expect.poll(async () => (await fly(page)).btn, { timeout: 10_000 }).toBe(true);
        await tapRect(page, 'flymap');
        await expect.poll(async () => (await fly(page)).open, { timeout: 5_000 }).toBe(true);
        await page.waitForTimeout(500);
      };
      await openMap();
      const f0 = await fly(page);
      const locks = Object.fromEntries(f0.pins.map((p: any) => [p.id, p.locked]));
      console.log('fresh locks', JSON.stringify(locks));
      expect(f0.pins.length).toBeGreaterThanOrEqual(19);
      // Every landmark and region can be found on foot from a fresh glade.
      for (const id of TOUR) expect(locks[id]).toBe(false);
      // Every pin is on screen, big enough for a finger, and no two overlap.
      for (const p of f0.pins) {
        const r = await page.evaluate((k) => (window as any).__vui.rects['travel:' + k], p.id);
        expect(r.w).toBeGreaterThanOrEqual(60);
        expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.w).toBeLessThanOrEqual(vp.width + 1);
        expect(r.y).toBeGreaterThan(60); expect(r.y + r.h).toBeLessThanOrEqual(vp.height + 1);
      }
      for (let i = 0; i < f0.pins.length; i++) for (let j = i + 1; j < f0.pins.length; j++) {
        const a = f0.pins[i], b = f0.pins[j];
        expect(Math.hypot(a.px - b.px, a.py - b.py), `${a.id}/${b.id}`).toBeGreaterThanOrEqual(a.r + b.r - 1);
      }
      await page.screenshot({ path: `${SHOTS}/fast-travel-map.png` });
      // A locked one (somewhere you can't walk to) wiggles and doesn't fly; the map stays open.
      await page.evaluate(() => { (window as any).__vui.fly.pins.find((b: any) => b.site.id === 'mistbirch').locked = true; });
      const before = (await mount(page)).travels;
      await tapRect(page, 'travel:mistbirch');
      await page.waitForTimeout(600);
      expect((await mount(page)).travels).toBe(before);
      expect((await fly(page)).open).toBe(true);
      // The big X closes it; the Fly! button comes back.
      await tapRect(page, 'flyclose');
      await expect.poll(async () => (await fly(page)).open, { timeout: 5_000 }).toBe(false);

      // 2) Fly the tour, opening the map each time.
      const zoomOf = () => page.evaluate(() => (window as any).__cozy.zoomInfo().zoom);
      const z0 = await zoomOf();
      let shotMid = false;
      for (const id of TOUR) {
        const lm = f0.pins.find((p: any) => p.id === id)!;
        const n0 = (await mount(page)).arrivals;
        await openMap();
        await tapRect(page, 'travel:' + id);
        await expect.poll(async () => (await mount(page)).phase, { timeout: 8_000, intervals: [100] }).toBe('travel');
        await expect.poll(async () => (await fly(page)).open, { timeout: 5_000 }).toBe(false);
        if (!shotMid && id === 'stable') {
          // A long flight: up high, and the camera eases out to show the land rolling by.
          await expect.poll(async () => (await mount(page)).seg ?? 0, { timeout: 120_000, intervals: [100] }).toBeGreaterThan(0.4);
          const s = await mount(page);
          expect(s.alt).toBeGreaterThan(80);
          const zm = await zoomOf();
          console.log('zoom base', z0, 'mid-flight', zm);
          expect(zm).toBeLessThan(z0 * 0.93);
          await page.screenshot({ path: `${SHOTS}/fast-travel-flying.png` });
          shotMid = true;
        }
        await expect.poll(async () => (await mount(page)).arrivals, { timeout: 180_000, intervals: [150] }).toBe(n0 + 1).catch(async (e) => {
          console.log('stuck', JSON.stringify(await mount(page)), JSON.stringify(await page.evaluate(() => (window as any).__cozy.state)));
          throw e;
        });
        const s = await mount(page);
        expect(s.phase).toBe('ride');
        expect(s.travelName).toBe(lm.name);
        const d = Math.hypot(s.ground[0] - lm.x, s.ground[1] - lm.y);
        console.log(id, 'arrived', s.ground, 'dist', Math.round(d));
        expect(d).toBeLessThan(260);
        const st = await page.evaluate(() => (window as any).__cozy.state);
        expect(Math.hypot(st.x - lm.x, st.y - lm.y)).toBeLessThan(260);
        const sc = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), s.eagle);
        expect(sc.x).toBeGreaterThan(0); expect(sc.x).toBeLessThan(vp.width); expect(sc.y).toBeGreaterThan(0); expect(sc.y).toBeLessThan(vp.height);
        if (id === 'bay') await page.screenshot({ path: `${SHOTS}/fast-travel-bay.png` });
      }
      // Back to normal zoom once landed.
      await page.waitForTimeout(800);
      expect(Math.abs((await zoomOf()) - z0)).toBeLessThan(z0 * 0.03);
      // After hovering a moment it goes back to touring on its own; a ground tap still lands.
      await expect.poll(async () => (await mount(page)).steering, { timeout: 40_000, intervals: [250] }).toBe(false);
      const s = await mount(page);
      const sc = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y + 120), s.ground);
      await page.evaluate(([x, y]) => (window as any).__cozy.mountTap(x, y), [s.ground[0], s.ground[1] + 120]);
      void sc;
      await expect.poll(async () => (await mount(page)).phase, { timeout: 40_000, intervals: [200] }).toBe("off");
      expect(await page.evaluate(() => (window as any).__vui.travelShown)).toBe(false);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
