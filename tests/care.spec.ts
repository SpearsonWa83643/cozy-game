import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Order 17 (Gamer's "bring care close"): hungry / sleepy friends head to the NEAREST food spot / bed,
// a bobbing food or bed icon shows where they're going, a one-time tip suggests a Snack Crate when the
// walk to food is long, and the new Snack Crate's ghost starts right next to the homes.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.CARE_SHOTS ?? 'test-results';
const village = (page: Page) => page.evaluate(() => (window as any).__cozy.village());
const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [x, y] as const) as Promise<{ x: number; y: number }>;
const tapWorld = async (page: Page, x: number, y: number) => { const p = await toScreen(page, x, y); await page.touchscreen.tap(p.x, p.y); };
const vuiRect = (page: Page, id: string) => page.evaluate((id) => (window as any).__vui.rects[id], id);
const tapRect = async (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
const waitRect = async (page: Page, id: string) => {
  await expect.poll(() => vuiRect(page, id), { timeout: 60_000, intervals: [250] }).toBeTruthy();
  return vuiRect(page, id);
};

test('care hints: nearest food/bed, destination icon, Snack Crate near homes', async ({ page }) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({
      v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [],
      village: { res: { food: 5, wood: 8, stone: 4 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 1 }, { id: 2, type: 'kitchen', gx: 9, gy: 1 }],
        villagers: [{ id: 3, name: 'Bea', trait: 'Loves flowers', kind: 0, job: null, food: 1, sleep: 1, fun: 1 }], nextId: 4, wanderer: 0, events: 0 },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => (window as any).__cozy.teleport(480, 1830));
  const v0 = await village(page);
  const home = v0.buildings.find((b: any) => b.type === 'home');
  const kitchen = v0.buildings.find((b: any) => b.type === 'kitchen');
  const id = v0.villagers[0].id;
  await page.evaluate(([i, x, y]) => (window as any).__cozy.moveVillager(i, x, y), [id, home.x, home.y + 70] as const);

  // 1. Hungry, only a far kitchen: a food icon marks the kitchen and the Snack Crate tip shows once.
  await page.evaluate((i) => (window as any).__cozy.setNeeds(i, { food: 0.1 }), id);
  await expect.poll(async () => (await village(page)).villagers[0].mark?.icon ?? null, { timeout: 30_000 }).toBe('i_food');
  const m1 = (await village(page)).villagers[0].mark;
  expect(Math.abs(m1.x - kitchen.x)).toBeLessThan(60);
  expect((await village(page)).tips).toContain('pantry');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/care-01-food-hint.png` });

  // 2. Build a Snack Crate: its ghost starts right beside the home.
  await tapRect(page, await waitRect(page, 'build'));
  await expect.poll(async () => (await village(page)).building, { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(1500);
  await tapRect(page, await waitRect(page, 'tray:pantry'));
  await expect.poll(async () => (await village(page)).ghost?.ok ?? false, { timeout: 30_000 }).toBe(true);
  const g = (await village(page)).ghost;
  expect(g.gx).toBeLessThanOrEqual(2); // home covers cells 0..1, so the crate sits next to it
  await page.screenshot({ path: `${SHOTS}/care-02-crate-ghost.png` });
  await tapWorld(page, g.check[0], g.check[1]);
  await expect.poll(async () => (await village(page)).buildings.some((b: any) => b.type === 'pantry'), { timeout: 30_000 }).toBe(true);
  expect((await village(page)).res.wood).toBe(6);
  await tapRect(page, await vuiRect(page, 'build')); // Done
  await expect.poll(async () => (await village(page)).building, { timeout: 30_000 }).toBe(false);
  const crate = (await village(page)).buildings.find((b: any) => b.type === 'pantry');

  // 3. Back home and hungry again: now the nearest food spot is the crate.
  await page.evaluate(([i, x, y]) => { (window as any).__cozy.setNeeds(i, { food: 1 }); (window as any).__cozy.moveVillager(i, x, y); }, [id, home.x, home.y + 70] as const);
  await page.waitForTimeout(600);
  await page.evaluate((i) => (window as any).__cozy.setNeeds(i, { food: 0.1 }), id);
  await expect.poll(async () => (await village(page)).villagers[0].mark?.icon ?? null, { timeout: 30_000 }).toBe('i_food');
  expect(Math.abs((await village(page)).villagers[0].mark.x - crate.x)).toBeLessThan(40);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/care-03-crate-near-home.png` });

  // 4. Sleepy near the kitchen: a bed icon marks the (only) home, and goes away on arrival.
  await page.evaluate(([i, x, y]) => { (window as any).__cozy.setNeeds(i, { food: 1, sleep: 1 }); (window as any).__cozy.moveVillager(i, x, y); }, [id, kitchen.x, kitchen.y + 70] as const);
  await page.waitForTimeout(600);
  await page.evaluate((i) => (window as any).__cozy.setNeeds(i, { sleep: 0.05 }), id);
  await expect.poll(async () => (await village(page)).villagers[0].mark?.icon ?? null, { timeout: 30_000 }).toBe('i_sleep');
  expect(Math.abs((await village(page)).villagers[0].mark.x - home.x)).toBeLessThan(40);
  await page.evaluate(() => (window as any).__cozy.villageSpeed(6));
  await expect.poll(async () => (await village(page)).villagers[0].task, { timeout: 120_000, intervals: [500] }).toBe('sleep');
  expect((await village(page)).villagers[0].mark).toBeNull();
  expect(errors).toEqual([]);
});
