import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Puzzle reset stones on iPad: replay a solved puzzle, get a bonus instead of a second treasure.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const state = (page: Page) => cozy(page, 'state');
const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [x, y] as const) as Promise<{ x: number; y: number }>;
const teleport = async (page: Page, x: number, y: number, settle = 1500) => {
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y] as const);
  await page.waitForTimeout(settle);
};
const tapWorld = async (page: Page, x: number, y: number) => { const p = await toScreen(page, x, y); await page.touchscreen.tap(p.x, p.y); };
async function closeDialogs(page: Page) {
  for (let i = 0; i < 14 && (await state(page)).dialogOpen; i++) { await page.touchscreen.tap(590, 650); await page.waitForTimeout(700); }
}
const wood = async (page: Page) => (await cozy(page, 'village()')).res.wood;

async function solvePots(page: Page) {
  const pots = [175, 220, 265, 310];
  for (let i = 0; i < 4; i++) {
    for (let g = 0; g < 12; g++) {
      const cols = await cozy(page, 'pots()');
      if (cols[i] === i) break;
      await closeDialogs(page); // a welcome tip card can be open; world taps wait behind it
      await tapWorld(page, pots[i], 756);
      try { await expect.poll(async () => (await cozy(page, 'pots()'))[i], { timeout: 15_000, intervals: [200] }).not.toBe(cols[i]); } catch { /* retry the tap */ }
    }
  }
  await expect.poll(async () => (await cozy(page, 'chests()')).pots, { timeout: 60_000, intervals: [300] }).toBe(true);
  await page.waitForTimeout(1500);
}
async function tapStone(page: Page, id: string) {
  const s = (await cozy(page, 'resetStones()'))[id];
  const n0 = await page.evaluate(() => (window as any).__cozyResets ?? 0);
  await teleport(page, s.x, s.y + 60);
  for (let i = 0; i < 4; i++) {
    await closeDialogs(page);
    await tapWorld(page, s.x, s.y - 20);
    try { await page.waitForFunction((n) => ((window as any).__cozyResets ?? 0) > n, n0, { timeout: 15_000 }); return; } catch { await page.waitForTimeout(500); }
  }
  throw new Error('reset stone tap did not register: ' + id);
}

test('puzzle reset stones: replay without a second treasure', async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);

  // 1. Flower pots: solve, open the chest (Flower Crown).
  await teleport(page, 245, 880);
  await solvePots(page);
  await tapWorld(page, 245, 818);
  await expect.poll(async () => (await state(page)).treasures, { timeout: 120_000, intervals: [500] }).toContain('flower_crown');
  await page.waitForTimeout(2500);
  await closeDialogs(page);

  // 2. Tap the reset stone: pots scramble, chest hides, puzzle is open again.
  await tapStone(page, 'pots');
  await expect.poll(async () => (await state(page)).puzzles.pots ?? false, { timeout: 30_000 }).toBe(false);
  expect(await cozy(page, 'pots()')).toEqual([4, 2, 0, 1]);
  expect((await cozy(page, 'chests()')).pots).toBe(false);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v7-01-reset-stone.png` });

  // 3. Solve again: the chest gives a bonus, not a second crown.
  await teleport(page, 245, 880);
  await solvePots(page);
  const w0 = await wood(page);
  await tapWorld(page, 245, 818);
  await expect.poll(() => wood(page), { timeout: 60_000, intervals: [400] }).toBeGreaterThanOrEqual(w0 + 3);
  expect((await state(page)).treasures.filter((t: string) => t === 'flower_crown').length).toBe(1);
  await closeDialogs(page);

  // 4. Lanterns: solve, reset with the stone by the sign, solve again for a bonus.
  const L = await cozy(page, 'lanterns');
  const lightAll = async () => {
    for (const id of ['dawn', 'noon', 'dusk']) {
      const l = L.find((q: any) => q.id === id);
      await teleport(page, l.x, l.y + 50);
      for (let i = 0; i < 4 && !(await state(page)).litOrder.includes(id); i++) { await tapWorld(page, l.x, l.y - 30); await page.waitForTimeout(1500); }
    }
    await expect.poll(async () => (await state(page)).solved, { timeout: 30_000 }).toBe(true);
  };
  await lightAll();
  await expect.poll(async () => (await state(page)).gateOpen, { timeout: 120_000, intervals: [500] }).toBe(true);
  await expect.poll(async () => (await state(page)).locked, { timeout: 60_000 }).toBe(false);
  await tapStone(page, 'lanterns');
  await expect.poll(async () => (await state(page)).solved, { timeout: 30_000 }).toBe(false);
  expect((await state(page)).litOrder).toEqual([]);
  const w1 = await wood(page);
  await lightAll();
  await expect.poll(() => wood(page), { timeout: 60_000, intervals: [400] }).toBeGreaterThanOrEqual(w1 + 3);

  // 5. Moon tiles: turn one, then the stone puts them back.
  await teleport(page, 3500, 820);
  const t0 = await cozy(page, 'tiles()');
  await tapWorld(page, 3500 - 33, 700 - 33);
  await expect.poll(async () => (await cozy(page, 'tiles()'))[0], { timeout: 30_000 }).not.toBe(t0[0]);
  await tapStone(page, 'tiles');
  await expect.poll(() => cozy(page, 'tiles()'), { timeout: 30_000 }).toEqual([1, 2, 3, 1]);
  expect(errors).toEqual([]);
});
