import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Order 19 slice 2: berry bushes. Tap a bush (touch) and a berry cluster hops off; pick it up and it
// goes in the basket as berries. An empty bush just rustles; berries grow back. Berries feed friends
// (and animals) like fruit, and the hungry alert's one-tap Snack uses them too.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.BERRY_SHOTS ?? 'test-results';
type BB = [number, number, number, number, number]; // x, tapY, baseY, stock, berriesShowing
const village = (page: Page) => page.evaluate(() => (window as any).__cozy.village());
const state = (page: Page) => page.evaluate(() => (window as any).__cozy.state);
const vuiRect = (page: Page, id: string) => page.evaluate((id) => (window as any).__vui.rects[id], id);
const bush = (page: Page, x: number, y: number) => page.evaluate(([x, y]) =>
  ((window as any).__cozy.berryBushes(x, y) as BB[]).find((r) => r[0] === x && r[2] === y) ?? null, [x, y] as const) as Promise<BB | null>;
const tapAt = async (page: Page, wx: number, wy: number) => {
  const p = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [wx, wy] as const);
  await page.touchscreen.tap(p.x, p.y);
};
const berryPickups = async (page: Page) =>
  ((await page.evaluate(() => (window as any).__cozy.pickups())) as [number, number, string][]).filter((p) => p[2] === 'berry');

test('berry bushes: pick, regrow, and feed berries like fruit', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({
      v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: ['feed'],
      village: { res: { food: 0, wood: 8, stone: 4 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 1 }],
        villagers: [{ id: 3, name: 'Bea', trait: 'Loves flowers', kind: 0, job: null, food: 1, sleep: 1, fun: 0.6 }], nextId: 4, wanderer: 0, events: 0 },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.evaluate(() => (window as any).__cozy.setFruitRegrowMs(600000));
  await page.waitForTimeout(800);

  // Three berry bushes in the glade, each full.
  const all = (await page.evaluate(() => (window as any).__cozy.berryBushes(0, 0))) as BB[];
  expect(all.length).toBe(3);
  for (const b of all) expect(b[3]).toBe(3);
  const [bx, ty, by] = all[0];
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x + 80, y + 50), [bx, by] as const);
  await page.waitForFunction(([x, y]) => ((window as any).__cozy.berryBushes(x, y) as BB[]).some((r) => r[0] === x && r[2] === y && r[4] === 3), [bx, by], { timeout: 60_000 });

  // 1. Touch-tap the bush until it is empty: one berry cluster per tap.
  for (let i = 0; i < 12 && (await bush(page, bx, by))![3] > 0; i++) {
    const before = (await bush(page, bx, by))![3];
    await tapAt(page, bx, ty);
    await page.waitForFunction(([x, y, n]) => ((window as any).__cozy.berryBushes(x, y) as BB[]).some((r) => r[0] === x && r[2] === y && r[3] < n), [bx, by, before], { timeout: 4_000 }).catch(() => {});
  }
  const empty = (await bush(page, bx, by))!;
  expect(empty[3]).toBe(0);
  expect(empty[4], 'no berries left on the bush').toBe(0);

  // 2. Pick them up (touch): they go in the basket as berries.
  await page.waitForTimeout(700);
  for (let i = 0; i < 10 && (await state(page)).berries < 3; i++) {
    const ps = await berryPickups(page);
    if (!ps.length) { await page.waitForTimeout(400); continue; }
    await tapAt(page, ps[0][0], ps[0][1] - 14);
    await page.waitForTimeout(600);
  }
  let s = await state(page);
  expect(s.berries).toBe(3);
  expect(s.snacks).toBe(3);
  expect(await vuiRect(page, 'snacks')).toBeTruthy();

  // 3. An empty bush just rustles.
  await tapAt(page, bx, ty);
  await page.waitForTimeout(900);
  expect((await bush(page, bx, by))![3]).toBe(0);
  expect((await state(page)).berries).toBe(3);

  // 4. Berries grow back (timer shortened through the hook).
  await page.evaluate(() => (window as any).__cozy.setFruitRegrowMs(300));
  await page.waitForFunction(([x, y]) => ((window as any).__cozy.berryBushes(x, y) as BB[]).some((r) => r[0] === x && r[2] === y && r[3] === 3 && r[4] === 3), [bx, by], { timeout: 30_000 });
  await page.evaluate(() => (window as any).__cozy.setFruitRegrowMs(600000));

  // 5. A hungry friend: one tap tosses a berry and fills her up.
  const id = (await village(page)).villagers[0].id;
  const [fx, fy] = [bx + 200, by + 60];
  await page.evaluate(([i, x, y]) => { const c = (window as any).__cozy; c.moveVillager(i, x, y); c.setNeeds(i, { food: 0.2 }); }, [id, fx, fy] as const);
  await page.waitForTimeout(700);
  const q = (await village(page)).villagers[0];
  await tapAt(page, q.x, q.y);
  await expect.poll(async () => (await village(page)).fruitFed, { timeout: 20_000, intervals: [100] }).toBe(1);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/berries-ipad.png` });
  expect((await village(page)).villagers[0].need.food).toBeGreaterThan(0.95);
  s = await state(page);
  expect(s.berries).toBe(2);
  expect(s.snacks).toBe(2);
  expect(s.berriesFed).toBe(1);

  // 6. Hungry with no village food: the one-tap Snack fix uses a berry.
  await page.waitForTimeout(2500);
  await page.evaluate(([i, x, y]) => { const c = (window as any).__cozy; c.moveVillager(i, x, y); c.setNeeds(i, { food: 0.1 }); }, [id, fx, fy] as const);
  await expect.poll(() => vuiRect(page, 'alert:fix'), { timeout: 30_000, intervals: [250] }).toBeTruthy();
  const fix = await vuiRect(page, 'alert:fix');
  await page.touchscreen.tap(fix.x + fix.w / 2, fix.y + fix.h / 2);
  await expect.poll(async () => (await village(page)).villagers[0].need.food, { timeout: 20_000 }).toBeGreaterThan(0.95);
  s = await state(page);
  expect(s.berries).toBe(1);
  expect(s.snacks).toBe(1);
  expect(errors).toEqual([]);
});
