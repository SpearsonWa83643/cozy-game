import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 50: Sushi Roll Buddy (Walker's figurine photo, Nov 2): unlocked by Tiny Chopsticks, shown in the stable,
// rides with its cape and rice/roe sprinkles under every art style and every motion.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.SUSHI_SHOTS ?? '/workspace/cozy-game/screenshots';
const mount = (page: Page) => page.evaluate(() => (window as any).__cozy.mount());

test('sushi roll buddy: stable, ride, every look and move', async ({ playwright: _pw }, info) => {
  test.setTimeout(900_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(FILE);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: ['chopsticks'], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
    });
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });

    // Textures exist in the atlas (body, wings, icon, treasure, cape).
    const tex = await page.evaluate(() => {
      const tm = (window as any).__game.textures;
      const has = (n: string) => tm.exists(n) || Object.keys(tm.list).some((k) => k !== '__MISSING' && tm.list[k].frames?.[n]);
      return ['sushi_body', 'sushi_wing', 'sushi_wing_far', 'i_sushi', 'ic_chopsticks'].map((n) => [n, has(n)]);
    });
    for (const [n, ok] of tex) expect(ok, n as string).toBe(true);

    // Stable: the new stall is there, awake and fully on screen.
    await page.evaluate(() => (window as any).__menu.show('stable'));
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(1500);
    const pets = await page.evaluate(() => (window as any).__menu.stablePets.map((p: any) => [p.id, p.on]));
    expect(pets.length).toBe(23);
    expect(pets.find((p: any) => p[0] === 'sushi')?.[1], 'sushi awake').toBe(true);
    const vp = page.viewportSize()!;
    const r = await page.evaluate(() => (window as any).__menu.rects['stall:sushi']);
    expect(r, 'stall').toBeTruthy();
    expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(vp.width); expect(r.y + r.h).toBeLessThanOrEqual(vp.height);
    await page.screenshot({ path: `${SHOTS}/sushi-stable.png` });
    await page.evaluate(() => (window as any).__menu.close());
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(false);

    // Ride it.
    await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
    await page.waitForTimeout(500);
    // The menu's close settles over a few (slow headless) frames, so retry the call until it takes.
    await expect.poll(async () => { await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } (window as any).__cozy.callMount('sushi'); }); return (await mount(page)).id; }, { timeout: 60_000, intervals: [1000] }).toBe('sushi');
    await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [200] }).toBe('ride');
    let m = await mount(page);
    expect(m.name).toBe('Sushi Roll Buddy');
    expect(m.riderOn).toBe(true);
    expect(m.fx).toBe('sushi');
    await expect.poll(async () => (await mount(page)).fxAlive, { timeout: 15_000, intervals: [250] }).toBeGreaterThan(0);

    // Every art style re-skins the sushi; every motion drives it.
    const artIds = ['classic', 'watercolor', 'cel', 'gouache', 'clay', 'ink', 'pixel'];
    for (const a of artIds) {
      await page.evaluate((a) => (window as any).__cozy.setLookArt(a), a);
      await expect.poll(async () => (await mount(page)).looks.art, { timeout: 20_000 }).toBe(a);
      m = await mount(page);
      expect(`${m.looks.tex}/${m.looks.frame}`, `tex under ${a}`).toContain('sushi');
      expect(m.phase).toBe('ride');
    }
    for (const mo of ['gentle', 'springy', 'dreamy', 'snappy', 'physics', 'playful', 'storm']) {
      await page.evaluate((mo) => (window as any).__cozy.setLookMotion(mo), mo);
      await expect.poll(async () => (await mount(page)).looks.motion, { timeout: 20_000 }).toBe(mo);
      expect((await mount(page)).phase).toBe('ride');
    }
    await page.evaluate(() => { (window as any).__cozy.setLookArt('classic'); (window as any).__cozy.setLookMotion('gentle'); });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SHOTS}/sushi-riding.png` });
    await page.evaluate(() => (window as any).__cozy.setLookMotion('auto'));
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
