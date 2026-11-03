import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 36: friends that aren't naturally winged fly with a flowing cape; carpet and jellyfish fly wingless;
// birds (and the pegasus unicorn) keep their wings. Stable stalls show the capes too.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.CAPE_SHOTS ?? '/workspace/cozy-game/screenshots';
const ALL = ['pterodactyl_egg', 'cloud_puppy_tuft', 'rainbow_horseshoe', 'golden_honeycomb', 'glow_pearl', 'sugar_cube', 'toy_propeller', 'pumpkin_seed', 'cowboy_hat', 'chili_poncho', 'magic_tassel', 'duck_squeak', 'jelly_gem', 'berry_seed', 'corn_husk', 'golden_bag', 'chef_hat', 'chopsticks'];
const CAPED = ['cowboy_cookie', 'chili_poncho', 'tamale', 'he_buddy', 'concha', 'sushi', 'strawberry', 'pumpkin', 'cloud_puppy', 'reindeer', 'snail', 'teacup'];
const WINGED = ['eagle', 'pterodactyl', 'bumblebee', 'goose', 'snowy_owl', 'flamingo', 'unicorn', 'rubber_duck'];
const mount = (page: Page) => page.evaluate(() => (window as any).__cozy.mount());
/** Call a friend, retrying while Call Mount is still cooling down / settling. */
async function ride(page: Page, id: string) {
  await expect.poll(async () => page.evaluate((id) => { const c = (window as any).__cozy; if (c.mount().phase === 'off') c.callMount(id); return c.mount().phase; }, id), { timeout: 60_000, intervals: [500] }).not.toBe('off');
  await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [200] }).toBe('ride');
}

async function boot(info: any, reduced = false) {
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: t, fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  }, ALL);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
  return { browser, page, errors };
}

test('capes: caped, wingless and winged friends', async ({ playwright: _pw }, info) => {
  test.setTimeout(900_000);
  const { browser, page, errors } = await boot(info);
  try {
    // Stable: every caped friend's puppet has a visible cape behind it; wingless ones show no wings.
    await page.evaluate(() => (window as any).__menu.show('stable'));
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(1500);
    const pets = await page.evaluate(() => (window as any).__menu.stablePets.map((p: any) => ({ id: p.id, style: p.m.style ?? 'wings', far: p.wingFar.frame.name, farVis: p.wingFar.visible, wingVis: p.wing.visible })));
    for (const id of CAPED) { const p = pets.find((q: any) => q.id === id); expect(p?.style, id).toBe('cape'); expect(p.far, id).toMatch(/^cape\d$/); expect(p.farVis).toBe(true); }
    for (const id of ['magic_carpet', 'sky_jelly']) { const p = pets.find((q: any) => q.id === id); expect(p.style, id).toBe('none'); expect(p.farVis || p.wingVis, id).toBe(false); }
    for (const id of WINGED) expect(pets.find((q: any) => q.id === id)?.style, id).toBe('wings');
    await page.screenshot({ path: `${SHOTS}/capes-stable.png`, scale: 'css' });
    const closeBtn = await page.evaluate(() => (window as any).__menu.rects.close);
    await page.touchscreen.tap(closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2);
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(false);

    await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
    await page.waitForTimeout(500);
    // Ride the cookie: cape visible, ripples through frames, lifts once flying.
    await ride(page, 'cowboy_cookie');
    await page.waitForTimeout(1500);
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) { const m = await mount(page); seen.add(m.cape); expect(m.wingStyle).toBe('cape'); expect(m.capeVisible).toBe(true); await page.waitForTimeout(90); }
    expect(seen.size, 'cape ripples').toBeGreaterThan(1);
    await page.evaluate(() => { const c = (window as any).__game.scene.getScene('world').cameras.main; c.zoomTo?.(2.2, 300); });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOTS}/capes-riding.png`, scale: 'css' });
    await page.evaluate(() => { const c = (window as any).__game.scene.getScene('world').cameras.main; c.zoomTo?.(1, 200); });
    await page.evaluate(() => { const m = (window as any).__cozy.mount(); (window as any).__cozy.mountTap(m.ground[0] + 100, m.ground[1] + 80); });
    await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [300] }).toBe('off');

    // Carpet: no wings, no cape.
    await ride(page, 'magic_carpet');
    await page.waitForTimeout(800);
    const c = await mount(page);
    expect(c.wingStyle).toBe('none'); expect(c.wingVisible).toBe(false); expect(c.capeVisible).toBe(false);
    await page.evaluate(() => { const m = (window as any).__cozy.mount(); (window as any).__cozy.mountTap(m.ground[0] + 100, m.ground[1] + 80); });
    await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [300] }).toBe('off');

    // Eagle keeps its wings.
    await ride(page, 'eagle');
    const e = await mount(page);
    expect(e.wingStyle).toBe('wings'); expect(e.wingVisible).toBe(true); expect(e.cape).toBe('');
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});

test('capes: reduced motion holds a still cape', async ({ playwright: _pw }, info) => {
  test.setTimeout(600_000);
  const { browser, page, errors } = await boot(info, true);
  try {
    await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
    await page.waitForTimeout(500);
    await ride(page, 'tamale');
    await page.waitForTimeout(800);
    for (let i = 0; i < 4; i++) { expect((await mount(page)).cape).toBe('cape0'); await page.waitForTimeout(120); }
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
