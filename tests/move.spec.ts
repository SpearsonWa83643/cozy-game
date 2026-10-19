import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Order 19 slice 3: move and remove buildings. In build mode, tap a building to pick it up, tap a new
// spot, then the green check (free). From a building's card: Move, or Remove (asks "Sure?") which gives
// back everything it cost and frees its worker. A Home that friends need can't be removed.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.MOVE_SHOTS ?? 'test-results';
const village = (page: Page) => page.evaluate(() => (window as any).__cozy.village());
const vuiRect = (page: Page, id: string) => page.evaluate((id) => (window as any).__vui.rects[id], id);
const tapRect = async (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
const waitRect = async (page: Page, id: string) => {
  await page.waitForFunction((id) => !!(window as any).__vui.rects[id], id, { timeout: 10_000 });
  return vuiRect(page, id);
};
const tapAt = async (page: Page, wx: number, wy: number) => {
  const p = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [wx, wy] as const);
  await page.touchscreen.tap(p.x, p.y);
};

test('move and remove buildings (iPad touch)', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({
      v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: ['feed', 'pantry', 'nearbed'],
      village: { res: { food: 5, wood: 1, stone: 0 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 1 }, { id: 2, type: 'workshop', gx: 4, gy: 0 }, { id: 5, type: 'garden', gx: 7, gy: 0 }],
        villagers: [{ id: 3, name: 'Bea', trait: 'Loves flowers', kind: 0, job: 2, food: 1, sleep: 1, fun: 1 }, { id: 4, name: 'Mo', trait: 'Super speedy', kind: 1, job: null, food: 1, sleep: 1, fun: 1 },
          { id: 6, name: 'Fig', trait: 'Loves naps', kind: 2, job: null, food: 1, sleep: 1, fun: 1 }, { id: 7, name: 'Tuck', trait: 'Gives big hugs', kind: 3, job: null, food: 1, sleep: 1, fun: 1 }], nextId: 8, wanderer: 0, events: 0 },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.evaluate(() => (window as any).__cozy.villageSpeed(0));
  let v = await village(page);
  const ws = v.buildings.find((b: any) => b.id === 2);
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y + 160), [ws.x, ws.y] as const);
  await page.waitForTimeout(900);

  // 1. Build mode, then tap the workshop: it lifts (fades) and a ghost appears on it.
  await tapRect(page, await vuiRect(page, 'build'));
  await page.waitForFunction(() => (window as any).__cozy.village().building, null, { timeout: 5_000 });
  await page.waitForTimeout(700);
  v = await village(page);
  const ws2 = v.buildings.find((b: any) => b.id === 2);
  await tapAt(page, ws2.x, ws2.y);
  await page.waitForFunction(() => (window as any).__cozy.village().moving === 2, null, { timeout: 5_000 });
  v = await village(page);
  expect(v.ghost).toMatchObject({ gx: 4, gy: 0, ok: true });
  expect(v.buildings.find((b: any) => b.id === 2).alpha).toBeLessThan(0.5);

  // 2. Tap a free spot (below the workshop), then the green check: it moves, free of cost, and keeps its worker.
  const res0 = v.res;
  const cell = await page.evaluate(() => { const c = (window as any).__cozy.villageCell; return c ? c(4, 2) : null; });
  if (cell) await tapAt(page, cell[0], cell[1]);
  else await tapAt(page, ws2.x, ws2.y + 260);
  await page.waitForTimeout(400);
  v = await village(page);
  expect(v.ghost.ok).toBe(true);
  expect(v.ghost.gy).toBeGreaterThan(0);
  const target = { gx: v.ghost.gx, gy: v.ghost.gy };
  await tapAt(page, v.ghost.check[0], v.ghost.check[1]);
  await page.waitForFunction(() => (window as any).__cozy.village().moved === 1, null, { timeout: 5_000 });
  v = await village(page);
  const moved = v.buildings.find((b: any) => b.id === 2);
  expect(moved).toMatchObject({ gx: target.gx, gy: target.gy, worker: 3, alpha: 1 });
  expect(v.saved.find((b: any) => b[0] === 2)).toEqual([2, 'workshop', target.gx, target.gy]);
  expect(v.res).toEqual(res0);
  expect(v.moving).toBeNull();
  await page.screenshot({ path: `${SHOTS}/order19-move-built.png` });

  // 3. Cancel a move with the red cross: it stays where it was.
  v = await village(page);
  const gd = v.buildings.find((b: any) => b.id === 5);
  await tapAt(page, gd.x, gd.y);
  await page.waitForFunction(() => (window as any).__cozy.village().moving === 5, null, { timeout: 5_000 });
  const cross = await page.evaluate(() => { const g = (window as any).__cozy.villageGhostCross?.(); return g; });
  if (cross) await tapAt(page, cross[0], cross[1]);
  else await tapRect(page, await vuiRect(page, 'build')); // leaving build mode cancels too
  await page.waitForFunction(() => (window as any).__cozy.village().moving === null, null, { timeout: 5_000 });
  v = await village(page);
  expect(v.buildings.find((b: any) => b.id === 5)).toMatchObject({ gx: 7, gy: 0, alpha: 1 });
  if (v.building) { await tapRect(page, await vuiRect(page, 'build')); await page.waitForTimeout(500); }

  // 4. Out of build mode: tap the workshop for its card, Remove, then Sure?: wood + stone come back, Bea is free.
  v = await village(page);
  const m = v.buildings.find((b: any) => b.id === 2);
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y + 160), [m.x, m.y] as const);
  await page.waitForTimeout(700);
  await tapAt(page, m.x, m.y);
  await tapRect(page, await waitRect(page, 'card:remove'));
  await page.waitForTimeout(400);
  expect((await village(page)).removed).toBe(0); // first tap only asks
  await page.screenshot({ path: `${SHOTS}/order19-remove-sure.png` });
  await tapRect(page, await waitRect(page, 'card:remove'));
  await page.waitForFunction(() => (window as any).__cozy.village().removed === 1, null, { timeout: 5_000 });
  v = await village(page);
  expect(v.buildings.some((b: any) => b.id === 2)).toBe(false);
  expect(v.saved.some((b: any) => b[0] === 2)).toBe(false);
  expect(v.res.wood).toBe(res0.wood + 3);
  expect(v.res.stone).toBe(res0.stone + 1);
  expect(v.villagers.find((q: any) => q.id === 3).job).toBeNull();

  // 5. The only Home can't go: 4 friends need its 2 beds (+2 picnic beds).
  const home = v.buildings.find((b: any) => b.id === 1);
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y + 160), [home.x, home.y] as const);
  await page.waitForTimeout(700);
  await tapAt(page, home.x, home.y);
  await tapRect(page, await waitRect(page, 'card:remove'));
  await page.waitForTimeout(400);
  v = await village(page);
  expect(v.buildings.some((b: any) => b.id === 1)).toBe(true);
  expect(v.removed).toBe(1);

  // 6. The move survives a reload.
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  v = await village(page);
  expect(v.buildings.map((b: any) => b.id).sort()).toEqual([1, 5]);
  expect(errors).toEqual([]);
});
