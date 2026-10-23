import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.3 Mount fast travel: while riding, big landmark buttons fly you to Home, Village, Pond,
// Brookside, Mistbirch Wood and the Wild Woods trailhead. Places you haven't found on foot are locked.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.FT_SHOTS ?? '/workspace/cozy-game/screenshots';
const mount = (page: Page) => page.evaluate(() => (window as any).__cozy.mount());
const IDS = ['home', 'village', 'pond', 'brookside', 'mistbirch', 'wild'];

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
  test.setTimeout(600_000);
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
      await expect.poll(() => page.evaluate(() => (window as any).__vui.travelShown), { timeout: 10_000 }).toBe(true);
      const locks = await page.evaluate(() => Object.fromEntries((window as any).__vui.travelBtns.map((b: any) => [b.lm.id, b.locked])));
      console.log('fresh locks', JSON.stringify(locks));
      expect(Object.values(locks).every((v) => v === false)).toBe(true);
      // Every button is on screen, big enough for a finger, and they don't overlap.
      const rects = await page.evaluate((ids) => ids.map((k: string) => (window as any).__vui.rects['travel:' + k]), IDS);
      const vp = page.viewportSize()!;
      for (const r of rects) { expect(r.w).toBeGreaterThanOrEqual(60); expect(r.x + r.w).toBeLessThanOrEqual(vp.width); expect(r.y).toBeGreaterThan(80); expect(r.y + r.h).toBeLessThan(vp.height - 120); }
      for (let i = 1; i < rects.length; i++) expect(rects[i].y).toBeGreaterThanOrEqual(rects[i - 1].y + rects[i - 1].h - 4);
      // A locked one (somewhere you can't walk to) wiggles and doesn't fly.
      await page.evaluate(() => { const v = (window as any).__vui; v.travelBtns.find((b: any) => b.lm.id === 'mistbirch').locked = true; v.travelState = ''; });
      await page.waitForTimeout(200);
      const before = (await mount(page)).travels;
      await tapRect(page, 'travel:mistbirch');
      await page.waitForTimeout(400);
      expect((await mount(page)).travels).toBe(before);
      await page.screenshot({ path: `${SHOTS}/fast-travel-buttons.png` });

      // 2) Fly to each landmark in turn.
      await page.evaluate(() => { const v = (window as any).__vui; v.travelBtns.find((b: any) => b.lm.id === 'mistbirch').locked = false; v.travelState = ''; });
      const lms = await page.evaluate(() => (window as any).__vui.travelBtns.map((b: any) => ({ id: b.lm.id, name: b.lm.name, x: b.lm.x, y: b.lm.y })));
      let shotMid = false;
      for (const lm of lms) {
        const n0 = (await mount(page)).arrivals;
        await tapRect(page, 'travel:' + lm.id);
        await expect.poll(async () => (await mount(page)).phase, { timeout: 5_000, intervals: [100] }).toBe('travel');
        if (!shotMid && lm.id === 'brookside') {
          await page.waitForTimeout(900);
          const s = await mount(page);
          expect(s.alt).toBeGreaterThan(80); // up high on the way
          await page.screenshot({ path: `${SHOTS}/fast-travel-flying.png` });
          shotMid = true;
        }
        await expect.poll(async () => (await mount(page)).arrivals, { timeout: 30_000, intervals: [150] }).toBe(n0 + 1).catch(async (e) => {
          console.log('stuck', JSON.stringify(await mount(page)), JSON.stringify(await page.evaluate(() => (window as any).__cozy.state)));
          throw e;
        });
        const s = await mount(page);
        expect(s.phase).toBe('ride');
        expect(s.travelName).toBe(lm.name);
        const d = Math.hypot(s.ground[0] - lm.x, s.ground[1] - lm.y);
        console.log(lm.id, 'arrived', s.ground, 'dist', Math.round(d));
        expect(d).toBeLessThan(260);
        // Player rides along; the camera keeps the mount on screen.
        const st = await page.evaluate(() => (window as any).__cozy.state);
        expect(Math.hypot(st.x - lm.x, st.y - lm.y)).toBeLessThan(260);
        const sc = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), s.eagle);
        expect(sc.x).toBeGreaterThan(0); expect(sc.x).toBeLessThan(vp.width); expect(sc.y).toBeGreaterThan(0); expect(sc.y).toBeLessThan(vp.height);
        if (lm.id === 'pond') await page.screenshot({ path: `${SHOTS}/fast-travel-pond.png` });
      }
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
