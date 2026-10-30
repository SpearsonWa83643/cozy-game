import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 34: three new flying figurine friends (Tamale, H-E-Buddy, Chef Concha): stable stalls, picker tiles,
// riding with a hover/flap, a capped ride effect that respects reduced motion, and the Wild Woods lunchbox pool.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.FOOD_SHOTS ?? '/workspace/cozy-game/screenshots';
const NEW: [string, string, string][] = [['tamale', 'corn_husk', 'Tamale'], ['he_buddy', 'golden_bag', 'H-E-Buddy'], ['concha', 'chef_hat', 'Chef Concha']];
const OLD = ['pterodactyl_egg', 'cloud_puppy_tuft', 'rainbow_horseshoe', 'golden_honeycomb', 'glow_pearl', 'sugar_cube', 'toy_propeller', 'pumpkin_seed', 'cowboy_hat', 'chili_poncho', 'magic_tassel', 'duck_squeak', 'jelly_gem', 'berry_seed'];
const mount = (page: Page) => page.evaluate(() => (window as any).__cozy.mount());
const vrect = (page: Page, id: string) => page.evaluate((id) => (window as any).__vui.rects[id], id) as Promise<{ x: number; y: number; w: number; h: number }>;
const tapV = async (page: Page, id: string) => { const r = await vrect(page, id); await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2); };

async function boot(info: any, treasures: string[], reduced = false, theme = 'spring') {
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(([t, th]) => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: th, puzzles: {}, treasures: t, fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  }, [treasures, theme] as [string[], string]);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
  return { browser, page, errors };
}

test('food flyers: stable, picker, ride, fx', async ({ playwright: _pw }, info) => {
  test.setTimeout(900_000);
  const { browser, page, errors } = await boot(info, [...OLD, ...NEW.map((n) => n[1])]);
  try {
    // Art preview: the three bodies + wings and their treasures, painted big from the real textures.
    // The atlas source canvases are released after GPU upload, so paint the preview with a temporary
    // top-most Phaser scene (own camera, zoom 1) using the real atlas frames.
    await page.evaluate((ids) => {
      const game = (window as any).__game;
      const tm = game.textures;
      const keyOf = (name: string) => { for (const k of Object.keys(tm.list)) { if (k !== '__MISSING' && tm.list[k].frames?.[name]) return k; } return null; };
      const out: Record<string, boolean> = {};
      game.scene.add('foodPreview', {
        create(this: any) {
          const W = this.cameras.main.width, H = this.cameras.main.height;
          const bg = this.add.graphics(); bg.fillGradientStyle(0xbfe6ff, 0xbfe6ff, 0xe9f7d8, 0xe9f7d8, 1); bg.fillRect(0, 0, W, H);
          const put = (name: string, x: number, y: number, w: number) => {
            const k = keyOf(name); if (!k) return false;
            const im = this.add.image(x, y, k, name); im.setScale(w / im.width); return true;
          };
          const col = W / 3;
          ids.forEach(([body, wing, icon, tr]: string[], i: number) => {
            const cx = col * i + col / 2, cy = H * 0.36, bw = col * 0.82;
            put(`${wing}_far`, cx - bw * 0.05, cy - bw * 0.2, bw * 0.26);
            out[body] = put(body, cx, cy, bw);
            put(wing, cx + bw * 0.05, cy - bw * 0.2, bw * 0.26);
            out[icon] = put(icon, cx - col * 0.2, H * 0.78, col * 0.3);
            out[tr] = put(tr, cx + col * 0.2, H * 0.78, col * 0.3);
          });
          this.scene.bringToTop();
        },
      }, true);
      (window as any).__foodArt = out;
    }, [['tamale_body', 'tamale_wing', 'i_tamale', 'ic_corn_husk'], ['buddy_body', 'buddy_wing', 'i_buddy', 'ic_golden_bag'], ['concha_body', 'concha_wing', 'i_concha', 'ic_chef_hat']]);
    await page.waitForTimeout(800);
    const art = await page.evaluate(() => (window as any).__foodArt);
    for (const v of Object.values(art)) expect(v).toBe(true);
    await page.screenshot({ path: `${SHOTS}/food-flyers-art.png` });
    await page.evaluate(() => (window as any).__game.scene.remove('foodPreview'));
    await page.waitForTimeout(300);

    // Stable: 22 stalls, every friend awake, new stalls big and on screen.
    await page.evaluate(() => (window as any).__menu.show('stable'));
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(1200);
    const pets = await page.evaluate(() => (window as any).__menu.stablePets.map((p: any) => [p.id, p.on]));
    expect(pets.length).toBe(22);
    const vp = page.viewportSize()!;
    for (const [id] of NEW) {
      expect(pets.find((p: any) => p[0] === id)?.[1], `${id} awake`).toBe(true);
      const r = await page.evaluate((id) => (window as any).__menu.rects[`stall:${id}`], id);
      expect(r, `stall ${id}`).toBeTruthy();
      expect(r.w).toBeGreaterThanOrEqual(80); expect(r.h).toBeGreaterThanOrEqual(120);
      expect(r.y + r.h).toBeLessThanOrEqual(vp.height); expect(r.x + r.w).toBeLessThanOrEqual(vp.width);
    }
    await page.screenshot({ path: `${SHOTS}/food-flyers-stable.png` });
    const closeBtn = await page.evaluate(() => (window as any).__menu.rects.close);
    await page.touchscreen.tap(closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2);
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(false);

    // Picker: all 22 tiles fully on screen and big enough to tap.
    await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
    await page.waitForTimeout(500);
    await tapV(page, 'mount');
    await expect.poll(() => page.evaluate(() => !!(window as any).__vui.mountPicker), { timeout: 10_000, intervals: [100] }).toBe(true);
    for (const [id] of NEW) {
      const r = await vrect(page, `mountPick:${id}`);
      expect(r, `tile ${id}`).toBeTruthy();
      expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(vp.width); expect(r.y + r.h).toBeLessThanOrEqual(vp.height);
      expect(r.w).toBeGreaterThanOrEqual(100);
    }
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOTS}/food-flyers-picker.png` });

    // Ride each: it flies in, you ride high up with a flap/bob, its effect runs (capped) and stops after.
    for (const [i, [id, , name]] of NEW.entries()) {
      if (i === 0) await tapV(page, `mountPick:${id}`);
      else await page.evaluate((id) => (window as any).__cozy.callMount(id), id);
      await expect.poll(async () => (await mount(page)).id, { timeout: 10_000, intervals: [100] }).toBe(id);
      await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [200] }).toBe('ride');
      expect((await mount(page)).riderOn).toBe(true);
      expect((await mount(page)).name).toBe(name);
      await page.waitForTimeout(1400);
      const m = await mount(page);
      expect(m.alt, `${name} flies`).toBeGreaterThan(30);
      expect(m.fx, `${id} fx`).toBe(id);
      expect(m.fxOn, `${id} emitting`).toBe(true);
      expect(m.fxAlive, `${id} alive`).toBeGreaterThan(0);
      expect(m.fxAlive, `${id} capped`).toBeLessThanOrEqual(40);
      await page.screenshot({ path: `${SHOTS}/food-flyers-${id}-riding.png` });
      const before = m.ground;
      await page.evaluate(() => { const m = (window as any).__cozy.mount(); (window as any).__cozy.mountTap(m.ground[0] + 160, m.ground[1] + 40); });
      await page.waitForTimeout(1500);
      const mid = await mount(page);
      expect(Math.hypot(mid.ground[0] - before[0], mid.ground[1] - before[1]), `${id} steers`).toBeGreaterThan(20);
      await page.evaluate(() => { const m = (window as any).__cozy.mount(); (window as any).__cozy.mountTap(m.ground[0] + 100, m.ground[1] + 80); });
      await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [300] }).toBe('off');
      expect((await mount(page)).fxOn, `${id} stops`).toBe(false);
    }
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});

test('food flyers: reduced motion keeps the ride but skips the effect', async ({ playwright: _pw }, info) => {
  test.setTimeout(600_000);
  const { browser, page, errors } = await boot(info, NEW.map((n) => n[1]), true);
  try {
    await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
    await page.waitForTimeout(500);
    await page.evaluate(() => (window as any).__cozy.callMount('he_buddy'));
    await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [200] }).toBe('ride');
    await page.waitForTimeout(1200);
    const m = await mount(page);
    expect(m.id).toBe('he_buddy');
    expect(m.fxOn).toBe(false);
    expect(m.fxAlive).toBe(0);
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
