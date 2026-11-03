import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 71: the HUD stays clean. The lantern sigils only show while the first puzzle is in play (near the lanterns);
// stuff, who needs a home and the season live on a painted notice board by the village, and tapping the board
// opens a big picture panel with one-tap fixes and the season buttons (the old leaf button).
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.BOARD_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
type R = { x: number; y: number; w: number; h: number };
const tapRect = (page: Page, r: R) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('HUD board: sigils only near the puzzle, needs and seasons on the village board', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cozy.whatsnew.seen', 'x'); });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
  await cozy(page, "setTheme('spring')");

  // 1. Fresh start by the dusk lantern: the sigils are up. No resource bar or snack counter on the HUD.
  await expect.poll(async () => (await cozy(page, 'hudInfo()')).sigils, { timeout: 15_000 }).toBe(true);
  let hi = await cozy(page, 'hudInfo()');
  expect(hi.resBar).toBe(false);
  expect(hi.snacks).toBe(false);

  // 2. Down at the village (far from the lanterns): the sigils tuck away.
  await cozy(page, 'villageCalm()');
  await cozy(page, 'teleport(960, 1790)');
  await expect.poll(async () => (await cozy(page, 'hudInfo()')).sigils, { timeout: 15_000 }).toBe(false);

  // 3. A visitor with no bed: "needs a home" goes on the board (with a "!"), not on the HUD.
  await page.evaluate(() => { const v = (window as any).__game.scene.getScene('world').village; v.beds = () => 0; v.wanderTimer = 0.01; });
  await expect.poll(async () => (await cozy(page, 'board()')).needs.map((n: any) => n.id), { timeout: 60_000, intervals: [400] }).toContain('home');
  expect((await cozy(page, 'board()')).mark).toBe(true);
  expect((await cozy(page, 'hudInfo()')).alert).toBe(null);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/hud-board-village.png` });

  // 4. Tap the board in the world: the panel opens, with big tiles and buttons.
  const s = (await cozy(page, 'board()')).screen;
  await page.touchscreen.tap(s[0], s[1]);
  await expect.poll(async () => (await cozy(page, 'board()')).open, { timeout: 10_000 }).toBe(true);
  await page.waitForTimeout(500);
  let b = await cozy(page, 'board()');
  for (const k of ['food', 'wood', 'stone', 'apple', 'berry']) expect(b.rects[`board:res:${k}`].w).toBeGreaterThanOrEqual(80);
  for (const k of ['spring', 'summer', 'fall', 'halloween', 'christmas', 'winter']) expect(b.rects[`board:season:${k}`].w).toBeGreaterThanOrEqual(64);
  expect(b.rects['board:fix:home'].h).toBeGreaterThanOrEqual(44);
  expect(b.rects['board:close'].w).toBeGreaterThanOrEqual(56);
  await page.screenshot({ path: `${SHOTS}/hud-board-open.png` });

  // 5. Pick Fall from the Season row: the theme switches and the panel stays open (redrawn in place).
  await tapRect(page, b.rects['board:season:fall']);
  await expect.poll(async () => (await cozy(page, 'themeHud()')).current, { timeout: 10_000 }).toBe('fall');
  expect((await cozy(page, 'board()')).open).toBe(true);

  // 6. Close with X; reopen; tapping outside closes it without walking.
  await tapRect(page, (await cozy(page, 'board()')).rects['board:close']);
  await expect.poll(async () => (await cozy(page, 'board()')).open, { timeout: 10_000 }).toBe(false);
  await cozy(page, 'openBoard()');
  await expect.poll(async () => (await cozy(page, 'board()')).open, { timeout: 10_000 }).toBe(true);
  await page.waitForTimeout(400);
  const s0 = await cozy(page, 'state');
  await page.touchscreen.tap(100, 760);
  await expect.poll(async () => (await cozy(page, 'board()')).open, { timeout: 10_000 }).toBe(false);
  await page.waitForTimeout(800);
  const s1 = await cozy(page, 'state');
  expect(Math.hypot(s1.x - s0.x, s1.y - s0.y)).toBeLessThan(4);

  // 7. The home fix: the panel closes and build mode opens.
  await cozy(page, 'openBoard()');
  await page.waitForTimeout(500);
  b = await cozy(page, 'board()');
  await tapRect(page, b.rects['board:fix:home']);
  await expect.poll(async () => (await cozy(page, 'board()')).open, { timeout: 10_000 }).toBe(false);
  await expect.poll(async () => (await cozy(page, 'village()')).building, { timeout: 10_000 }).toBe(true);
  expect(errors).toEqual([]);
});
