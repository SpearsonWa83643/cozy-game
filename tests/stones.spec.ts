import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Order 18: pressure stones in Mistbirch Wood. Step on the numbered stones 1, 2, 3, 4 (real touch
// walking for the first one). A wrong stone pops them all back up; all four reveal a bonus chest.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.STONE_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const ps = (page: Page) => cozy(page, 'pstones()');
const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [x, y] as const) as Promise<{ x: number; y: number }>;
const tapWorld = async (page: Page, x: number, y: number) => { const p = await toScreen(page, x, y); await page.touchscreen.tap(p.x, p.y); };
const tp = async (page: Page, x: number, y: number) => { await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y] as const); await page.waitForTimeout(450); };

test('pressure stones: 1-2-3-4, wrong stone resets, chest appears', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: ['rusty_key'], fish: {}, minor: {}, visited: ['glade', 'river', 'forest'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  const s0 = await ps(page);
  expect(s0.next).toBe(1);
  expect(s0.stones.length).toBe(4);
  const by = (n: number) => s0.stones.find((s: any) => s[2] === n) as [number, number, number, boolean];
  const off = [2915, 1000] as const; // between the stones and the chest spot
  await tp(page, off[0], off[1]);
  await page.screenshot({ path: `${SHOTS}/stones-01-start.png` });

  // 1. Real touch: tap stone 1 and walk onto it.
  const [x1, y1] = by(1);
  await tapWorld(page, x1, y1);
  await expect.poll(async () => (await ps(page)).next, { timeout: 30_000, intervals: [250] }).toBe(2);

  // 2. Wrong stone (3 before 2): all pop back up.
  await tp(page, off[0], off[1]);
  await tp(page, by(3)[0], by(3)[1]);
  await expect.poll(async () => (await ps(page)).next, { timeout: 10_000 }).toBe(1);
  expect((await ps(page)).stones.every((s: any) => !s[3])).toBe(true);

  // 3. Right order: 1, 2, 3, 4.
  for (const n of [1, 2, 3, 4]) {
    await tp(page, off[0], off[1]);
    await tp(page, by(n)[0], by(n)[1]);
    await expect.poll(async () => (await ps(page)).next, { timeout: 10_000 }).toBe(n + 1);
  }
  await expect.poll(async () => (await cozy(page, 'chests()')).stones, { timeout: 15_000 }).toBe(true);
  expect((await cozy(page, 'state')).puzzles.stones).toBe(true);
  await tp(page, off[0], off[1] - 20);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/stones-02-solved.png` });

  // 4. Open the chest: the first time it gives the Sky Pebble (Sky scarf).
  const wood0 = (await cozy(page, 'village()')).res.wood;
  const [cx, cy] = s0.chest;
  await tp(page, cx, cy + 40);
  await expect.poll(async () => (await cozy(page, 'state')).prompt, { timeout: 10_000 }).toBe('Open');
  await tapWorld(page, cx, cy - 25);
  await expect.poll(async () => (await ps(page)).opened, { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => (await cozy(page, 'state')).treasures, { timeout: 10_000 }).toContain('sky_pebble');
  expect((await cozy(page, 'village()')).res.wood).toBe(wood0);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${SHOTS}/stones-03-sky-pebble.png` });

  // 5. Solved stays solved after reload.
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  expect((await ps(page)).next).toBe(5);
  expect((await ps(page)).stones.every((s: any) => s[3])).toBe(true);
  expect(errors).toEqual([]);
});
