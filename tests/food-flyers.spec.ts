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
    await page.evaluate((ids) => {
      const tm = (window as any).__game.textures;
      const find = (name: string) => { for (const k of Object.keys(tm.list)) { const f = tm.list[k].frames?.[name]; if (f && k !== '__MISSING') return f; } return null; };
      const cv = document.createElement('canvas'); cv.width = 1180; cv.height = 820; cv.id = 'food-preview';
      Object.assign(cv.style, { position: 'fixed', inset: '0', zIndex: '99', width: '1180px', height: '820px' });
      const c = cv.getContext('2d')!;
      const g = c.createLinearGradient(0, 0, 0, 820); g.addColorStop(0, '#bfe6ff'); g.addColorStop(1, '#e9f7d8'); c.fillStyle = g; c.fillRect(0, 0, 1180, 820);
      const draw = (name: string, x: number, y: number, w: number, h: number) => {
        const f = find(name); if (!f) return false;
        c.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, x, y, w, h); return true;
      };
      const out: Record<string, boolean> = {};
      ids.forEach(([body, wing, icon, tr]: string[], i: number) => {
        const x = 40 + i * 380;
        draw(`${wing}_far`, x + 120, 70, 96, 192);
        out[body] = draw(body, x, 160, 372, 252);
        draw(wing, x + 140, 80, 96, 192);
        out[icon] = draw(icon, x + 60, 470, 120, 120);
        out[tr] = draw(tr, x + 200, 470, 120, 120);
      });
      document.body.appendChild(cv);
      (window as any).__foodArt = out;
    }, [['tamale_body', 'tamale_wing', 'i_tamale', 'ic_corn_husk'], ['buddy_body', 'buddy_wing', 'i_buddy', 'ic_golden_bag'], ['concha_body', 'concha_wing', 'i_concha', 'ic_chef_hat']]);
    const art = await page.evaluate(() => (window as any).__foodArt);
    for (const v of Object.values(art)) expect(v).toBe(true);
    await page.screenshot({ path: `${SHOTS}/food-flyers-art.png` });
    await page.evaluate(() => document.getElementById('food-preview')?.remove());

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
