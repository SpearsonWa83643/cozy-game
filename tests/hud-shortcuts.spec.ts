import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 72 (Walker, Nov 3): HUD shortcuts straight to the Stable and the Thief Jail.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.SHOTS ?? 'screenshots';
const ui = (page: Page, expr: string) => page.evaluate(`(() => { const u = window.__game.scene.getScene('ui'); return ${expr}; })()`) as Promise<any>;
const menu = (page: Page, expr: string) => page.evaluate(`(() => { const m = window.__menu; return ${expr}; })()`) as Promise<any>;

test('HUD stable + jail shortcuts open their pages', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 8 && (await page.evaluate(() => (window as any).__cozy.state.dialogOpen)); i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(700); }

  const b = await ui(page, '({ s: { x: u.stableC.x, y: u.stableC.y, v: u.stableC.visible }, j: { x: u.jailC.x, y: u.jailC.y, v: u.jailC.visible }, t: { x: u.thiefC.x, y: u.thiefC.y } })');
  expect(b.s.v && b.j.v).toBe(true);
  // One row with the other round buttons, spaced so they don't overlap.
  expect(b.s.y).toBe(b.t.y); expect(b.j.y).toBe(b.t.y);
  expect(b.t.x - b.s.x).toBeGreaterThanOrEqual(56); expect(b.s.x - b.j.x).toBeGreaterThanOrEqual(56);
  await page.screenshot({ path: `${SHOTS}/hud-shortcuts.png` });

  await page.touchscreen.tap(b.s.x, b.s.y);
  await expect.poll(() => menu(page, 'm.open && m.tab'), { timeout: 60_000 }).toBe('stable');
  expect(await menu(page, 'm.stableView')).toBe('barn');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/hud-shortcuts-stable.png` });
  await menu(page, 'm.close()');
  await expect.poll(() => page.evaluate(() => (window as any).__game.registry.get('menuOpen')), { timeout: 30_000 }).toBe(false);
  await page.waitForTimeout(800);

  await page.touchscreen.tap(b.j.x, b.j.y);
  await expect.poll(() => menu(page, 'm.open && m.stableView'), { timeout: 60_000 }).toBe('jail');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/hud-shortcuts-jail.png` });
  await menu(page, 'm.close()');
  expect(errors).toEqual([]);
});
