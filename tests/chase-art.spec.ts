import { test, expect, chromium, type Page, type BrowserContext } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

// 74 (Walker, Nov 3): the Thief Chase shows every mount from above (nose up the screen) with you riding
// it, each with its own way of flying, plus high-speed effects: speed lines, wind, near/far cloud
// parallax, a motion-blur trail, wing-tip and thief contrails, banking, and boosts (shake + zoom punch)
// that only move the world (the HUD has its own camera). Controls are unchanged.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.CHASE_SHOTS ?? 'screenshots';
const SAVE = { v: 2, theme: 'spring', puzzles: { trail: true, stones: true }, treasures: ['pterodactyl_egg', 'rainbow_horseshoe'], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [],
  look: { hat: 'straw', scarf: 'red', outfit: 'teal', back: 'backpack', feather: true, shells: false } };
const chase = (page: Page) => page.evaluate(() => (window as any).__chase ?? null);

async function boot(ctx: BrowserContext) {
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('cozy.save.v2', JSON.stringify(s)); localStorage.setItem('cozy.whatsnew.seen', 'x'); }, SAVE);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.evaluate(() => { localStorage.setItem('cozy.whatsnew.seen', 'x'); document.getElementById('whatsnew')?.remove(); });
  await page.waitForTimeout(1200);
  return { page, errors };
}

test('chase art: top-down mount + rider for every mount, high-speed effects', async ({ playwright: _pw }, info) => {
  test.setTimeout(1_800_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const { page, errors } = await boot(ctx);
    await page.evaluate(() => (window as any).__cozy.chaseTune({ timeS: 900 }));
    const r = await page.evaluate(() => (window as any).__cozy.startChase('fox', 'eagle'));
    expect(r.mount).toBe('eagle');
    await expect.poll(async () => (await chase(page))?.phase, { timeout: 180_000 }).toBe('play');
    let c = await chase(page);
    expect(c.top.art).toBe('topdown');
    expect(c.top.ids).toBe(23);
    expect(c.top.tex).toBe('td_eagle_straw_teal_red_backpack_1'); // your look rides along
    expect(c.top.wings).toBe(true);
    expect(c.fx.cams).toBe(2); // the HUD camera (shake/zoom only hit the world)
    expect(c.fx.streaks).toBe(16); expect(c.fx.wind).toBeGreaterThan(10); expect(c.fx.wisps).toBe(2); expect(c.fx.ghosts).toBe(3);
    // the launch is a boost (speed + shake + zoom punch)
    await expect.poll(async () => (await chase(page)).fx.boosts, { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
    await expect.poll(async () => (await chase(page)).fx.puffs, { timeout: 60_000 }).toBeGreaterThan(0);

    // Every mount's top-down art paints (one sheet, for review).
    const url: string = await page.evaluate(() => (window as any).__chaseScene.artSheet());
    writeFileSync(`${SHOTS}/chase-art-sheet.png`, Buffer.from(url.split(',')[1], 'base64'));
    const all = await page.evaluate(() => { const s = (window as any).__chaseScene; return (s.td && (window as any).__chase.top.ids) ? Object.keys(s.textures.list).filter((k: string) => /^td_[a-z_]+_straw_teal_red_backpack_1$/.test(k)).length : 0; });
    expect(all).toBe(23);

    // Banking: slide a finger right; the mount leans into the turn (and steering still works).
    const vp = page.viewportSize()!;
    const cdp = await ctx.newCDPSession(page);
    const y = vp.height * 0.8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: vp.width / 2, y }] });
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: vp.width / 2 + (vp.width * 0.35 * i) / 10, y }] }); await page.waitForTimeout(30); }
    await expect.poll(async () => (await chase(page)).fx.bank, { timeout: 60_000 }).toBeGreaterThan(0.15);
    await page.screenshot({ path: `${SHOTS}/chase-art-bank.png`, scale: 'css' });
    await expect.poll(async () => (await chase(page)).px, { timeout: 120_000 }).toBeGreaterThan(vp.width * 0.7);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();

    for (const id of ['eagle', 'unicorn', 'bumblebee', 'pterodactyl', 'airplane', 'teacup', 'reindeer', 'magic_carpet', 'sky_jelly', 'sushi']) {
      await page.evaluate((id) => { const s = (window as any).__chaseScene; s.scene.restart({ ...s.d, mountId: id, onEnd: () => {} }); }, id);
      await expect.poll(async () => { const k = await chase(page); return k?.on && k.mount === id && k.phase === 'play'; }, { timeout: 180_000 }).toBe(true);
      c = await chase(page);
      expect(c.top.tex.startsWith(`td_${id}_`)).toBe(true);
      const fly = c.top.fly;
      if (['eagle', 'unicorn', 'bumblebee', 'pterodactyl'].includes(id)) expect(c.top.wings).toBe(true);
      if (['teacup', 'reindeer', 'sushi'].includes(id)) { expect(fly).toBe('cape'); expect(c.top.cape).toBe(true); }
      if (id === 'airplane') expect(c.top.prop).toBe(true);
      if (id === 'magic_carpet') expect(fly).toBe('carpet');
      if (id === 'sky_jelly') expect(fly).toBe('jelly');
      await expect.poll(async () => (await chase(page)).fx.puffs, { timeout: 60_000 }).toBeGreaterThan(0);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOTS}/chase-art-${id}.png`, scale: 'css' });
    }
    // the boost on launch speeds everything up for a moment, then eases back
    await expect.poll(async () => (await chase(page)).fx.spd, { timeout: 60_000 }).toBeLessThan(1.1);
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
