import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 13: each new fun mount has its own tiny ride effect (capped particles) that only runs while riding.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const NEW: [string, string][] = [
  ['cowboy_cookie', 'cowboy_hat'], ['chili_poncho', 'chili_poncho'], ['magic_carpet', 'magic_tassel'],
  ['rubber_duck', 'duck_squeak'], ['sky_jelly', 'jelly_gem'], ['strawberry', 'berry_seed'],
];
const mount = (page: Page) => page.evaluate(() => (window as any).__cozy.mount());

test('new mounts: ride effect on while riding, off after, capped', async ({ playwright: _pw }, info) => {
  test.setTimeout(900_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate((t) => {
      localStorage.clear();
      localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: t, fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
    }, NEW.map((n) => n[1]));
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
    await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
    await page.waitForTimeout(500);
    for (const [id] of NEW) {
      await page.evaluate((id) => (window as any).__cozy.callMount(id), id);
      await expect.poll(async () => (await mount(page)).id, { timeout: 10_000, intervals: [100] }).toBe(id);
      await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [200] }).toBe('ride');
      await page.waitForTimeout(1400);
      const m = await mount(page);
      expect(m.fx, `${id} fx`).toBe(id);
      expect(m.fxOn, `${id} emitting`).toBe(true);
      expect(m.fxAlive, `${id} alive`).toBeGreaterThan(0);
      expect(m.fxAlive, `${id} capped`).toBeLessThanOrEqual(40);
      await page.screenshot({ path: `screenshots/mount-fx-${id}.png` });
      await page.evaluate(() => { const m = (window as any).__cozy.mount(); (window as any).__cozy.mountTap(m.ground[0] + 100, m.ground[1] + 80); });
      await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [300] }).toBe('off');
      expect((await mount(page)).fxOn, `${id} stops`).toBe(false);
    }
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
