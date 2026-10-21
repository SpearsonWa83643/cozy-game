import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Christmas slice 2: the Reindeer is Christmas's default mount. Call Mount (touch) in Christmas
// brings the reindeer straight away (no picker), you ride it, and a tap on the ground drops you off.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.XMAS_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const mount = (page: Page) => cozy(page, 'mount()');
const tapRect = async (page: Page, k: string) => {
  const r = await page.evaluate((k) => (window as any).__vui.rects[k], k);
  await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
};

test('christmas: reindeer is the default mount', async ({ page }) => {
  test.setTimeout(360_000);
  try {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'christmas', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
    });
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1200);
    for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
    expect((await cozy(page, 'village()')).theme).toBe('christmas');

    const tp = (x: number, y: number) => page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y]);
    await tp(1500, 1500);
    await page.waitForTimeout(1500);
    await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('world').mount.canCall()), { timeout: 60_000, intervals: [300] }).toBe(true);
    await tapRect(page, 'mount');
    await expect.poll(async () => (await mount(page)).id, { timeout: 10_000, intervals: [100] }).toBe('reindeer');
    expect(await page.evaluate(() => !!(window as any).__vui.mountPicker)).toBe(false);
    await expect.poll(async () => (await mount(page)).phase, { timeout: 90_000, intervals: [200] }).toBe('ride');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/christmas-reindeer-ride.png` });
    await page.evaluate(() => { const m = (window as any).__cozy.mount(); (window as any).__cozy.mountTap(m.ground[0] + 120, m.ground[1] + 80); });
    await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [300] }).toBe('off');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});
