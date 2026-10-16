import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Theme default mounts: Halloween's Call Mount brings the pumpkin carriage, Classic's the eagle.
// A mount you pick yourself in the picker is kept (and marked) over the theme's default.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const mount = (page: Page) => cozy(page, 'mount()');
const tapRect = async (page: Page, k: string) => {
  const r = await page.evaluate((k) => (window as any).__vui.rects[k], k);
  await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
};
const land = async (page: Page) => {
  await page.evaluate(() => { const m = (window as any).__cozy.mount(); (window as any).__cozy.mountTap(m.ground[0] + 120, m.ground[1] + 80); });
  await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [300] }).toBe('off');
};

test('pumpkin carriage is the Halloween default mount; eagle in Classic; your pick is kept', async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 650); await page.waitForTimeout(600); }
  await page.evaluate(() => (window as any).__cozy.teleport(1500, 1500));
  await page.waitForTimeout(1500);

  // Halloween: Call Mount summons the pumpkin straight away (no picker).
  await cozy(page, "setTheme('halloween')");
  await page.waitForTimeout(6000);
  // Brookside in Halloween: no particle ever draws tree art (the floating-canopy bug).
  const ps: any[] = await cozy(page, 'particleFrames()');
  expect(ps.length).toBeGreaterThan(10);
  expect(ps.filter((p) => /^(h_)?tree|^pine|^birch|^apple|^stump/.test(p.frame) || p.frameTex !== p.tex || p.frame === '__BASE')).toEqual([]);
  expect((await cozy(page, 'state')).area).toBe('river');
  await page.screenshot({ path: 'screenshots/hd-ipad-v11-01-brookside-halloween-clean.png' });
  await tapRect(page, 'mount');
  await expect.poll(async () => (await mount(page)).id, { timeout: 10_000, intervals: [100] }).toBe('pumpkin');
  expect(await page.evaluate(() => !!(window as any).__vui.mountPicker)).toBe(false);
  await expect.poll(async () => (await mount(page)).phase, { timeout: 90_000, intervals: [200] }).toBe('ride');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/hd-ipad-v11-02-pumpkin-carriage-ride.png' });
  await land(page);

  // Classic: the bald eagle.
  await cozy(page, "setTheme('spring')");
  await page.waitForTimeout(1200);
  await expect.poll(async () => (await mount(page)).phase === 'off' && (await page.evaluate(() => (window as any).__game.scene.getScene('world').mount.canCall())), { timeout: 60_000, intervals: [300] }).toBe(true);
  await tapRect(page, 'mount');
  await expect.poll(async () => (await mount(page)).id, { timeout: 10_000, intervals: [100] }).toBe('eagle');
  await expect.poll(async () => (await mount(page)).phase, { timeout: 90_000, intervals: [200] }).toBe('ride');
  await land(page);

  // With a treasure mount the picker opens; pick the eagle in Halloween and it is remembered.
  await page.evaluate(() => (window as any).__cozy.giveTreasure('pterodactyl_egg'));
  await cozy(page, "setTheme('halloween')");
  await page.waitForTimeout(1200);
  await expect.poll(async () => page.evaluate(() => (window as any).__game.scene.getScene('world').mount.canCall()), { timeout: 60_000, intervals: [300] }).toBe(true);
  await tapRect(page, 'mount');
  await expect.poll(() => page.evaluate(() => !!(window as any).__vui.rects['mountPick:pumpkin']), { timeout: 10_000, intervals: [100] }).toBe(true);
  await tapRect(page, 'mountPick:eagle');
  await expect.poll(async () => (await mount(page)).id, { timeout: 10_000, intervals: [100] }).toBe('eagle');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2') ?? '{}').mountPick), { timeout: 10_000 }).toBe('eagle');
});
