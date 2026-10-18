import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Order 19 slice 1: feed fruit from your basket to village friends. With fruit, one tap on a hungry
// friend tosses a fruit (hearts, "Yum!"), fills them up and uses one fruit; a full friend just opens
// their card as before; an empty basket never feeds.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.FEED_SHOTS ?? 'test-results';
const village = (page: Page) => page.evaluate(() => (window as any).__cozy.village());
const state = (page: Page) => page.evaluate(() => (window as any).__cozy.state);
const vuiRect = (page: Page, id: string) => page.evaluate((id) => (window as any).__vui.rects[id], id);
const tapFriend = async (page: Page) => {
  // Friends drift a little; aim at where they are right now.
  const p = await page.evaluate(() => { const c = (window as any).__cozy; const q = c.village().villagers[0]; return c.worldToScreen(q.x, q.y); });
  await page.touchscreen.tap(p.x, p.y);
};

test('feed fruit to a hungry village friend with one tap', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({
      v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 2, tips: ['feed'],
      village: { res: { food: 0, wood: 8, stone: 4 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 1 }],
        villagers: [{ id: 3, name: 'Bea', trait: 'Loves flowers', kind: 0, job: null, food: 1, sleep: 1, fun: 0.6 }], nextId: 4, wanderer: 0, events: 0 },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  const home = (await village(page)).buildings[0];
  const id = (await village(page)).villagers[0].id;
  const [fx, fy] = [home.x + 40, home.y + 120];
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x + 120, y + 30), [fx, fy] as const);
  await page.evaluate(([i, x, y]) => { const c = (window as any).__cozy; c.moveVillager(i, x, y); c.setNeeds(i, { food: 0.2 }); }, [id, fx, fy] as const);
  await page.waitForTimeout(700);
  expect((await state(page)).snacks).toBe(2);

  // 1. One tap on the hungry friend: fruit flies over, she is full, one fruit used, no card.
  await tapFriend(page);
  await expect.poll(async () => (await village(page)).fruitFed, { timeout: 20_000, intervals: [100] }).toBe(1);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/feed-friend-ipad.png` });
  const v1 = await village(page);
  expect(v1.villagers[0].need.food).toBeGreaterThan(0.95);
  expect(v1.villagers[0].need.fun).toBeGreaterThan(0.6);
  expect((await state(page)).snacks).toBe(1);
  expect(await vuiRect(page, 'card')).toBeFalsy();

  // 2. A full friend: tapping opens her card as before and keeps the fruit.
  await page.waitForTimeout(2500);
  for (let i = 0; i < 4 && !(await vuiRect(page, 'card')); i++) { await tapFriend(page); await page.waitForTimeout(700); }
  expect(await vuiRect(page, 'card')).toBeTruthy();
  expect((await state(page)).snacks).toBe(1);
  expect((await village(page)).fruitFed).toBe(1);
  await page.touchscreen.tap(...(await vuiRect(page, 'card:close').then((r: any) => [r.x + r.w / 2, r.y + r.h / 2] as [number, number])));
  await expect.poll(() => vuiRect(page, 'card'), { timeout: 20_000 }).toBeFalsy();

  // 3. Hungry, no food in the village: the one-tap "Snack" alert uses basket fruit.
  await page.evaluate(([i, x, y]) => { const c = (window as any).__cozy; c.moveVillager(i, x, y); c.setNeeds(i, { food: 0.1 }); }, [id, fx, fy] as const);
  await expect.poll(() => vuiRect(page, 'alert:fix'), { timeout: 30_000, intervals: [250] }).toBeTruthy();
  const fix = await vuiRect(page, 'alert:fix');
  await page.touchscreen.tap(fix.x + fix.w / 2, fix.y + fix.h / 2);
  await expect.poll(async () => (await village(page)).villagers[0].need.food, { timeout: 20_000 }).toBeGreaterThan(0.95);
  expect((await state(page)).snacks).toBe(0);

  // 4. Empty basket: tapping a hungry friend opens the card and feeds nothing.
  await page.evaluate((i) => (window as any).__cozy.setNeeds(i, { food: 0.3 }), id);
  for (let i = 0; i < 4 && !(await vuiRect(page, 'card')); i++) { await tapFriend(page); await page.waitForTimeout(700); }
  expect(await vuiRect(page, 'card')).toBeTruthy();
  expect((await village(page)).fruitFed).toBe(1);
  expect(errors).toEqual([]);
});
