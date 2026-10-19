import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Order 18: deer-track footprint trail in east Mistbirch Wood. Prints light up one at a time as you
// walk on them (first one by real touch walking); the end spot sparkles, then a bonus chest appears.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.TRAIL_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const tr = (page: Page) => cozy(page, 'trail()');
const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [x, y] as const) as Promise<{ x: number; y: number }>;
const tapWorld = async (page: Page, x: number, y: number) => { const p = await toScreen(page, x, y); await page.touchscreen.tap(p.x, p.y); };
const tp = async (page: Page, x: number, y: number) => { await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y] as const); await page.waitForTimeout(450); };

test('footprint trail: follow the prints in order, chest at the end', async ({ page }) => {
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
  const t0 = await tr(page);
  expect(t0.step).toBe(0);
  const pts: [number, number][] = t0.pts;
  const n = pts.length;
  await tp(page, 3990, 1030);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/trail-01-start.png` });

  // 1. Real touch: tap the first glowing print and walk onto it.
  await tapWorld(page, pts[0][0], pts[0][1]);
  await expect.poll(async () => (await tr(page)).step, { timeout: 30_000, intervals: [250] }).toBe(1);

  // 2. Skipping ahead does nothing: only the next print counts.
  await tp(page, pts[3][0], pts[3][1]);
  expect((await tr(page)).step).toBe(1);

  // 3. Follow the rest in order; the end spot sparkles before the last step.
  for (let i = 1; i < n - 1; i++) {
    await tp(page, pts[i][0], pts[i][1]);
    await expect.poll(async () => (await tr(page)).step, { timeout: 10_000 }).toBe(i + 1);
  }
  expect((await tr(page)).glow).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/trail-02-sparkle.png` });
  await tp(page, pts[n - 1][0], pts[n - 1][1]);
  await expect.poll(async () => (await cozy(page, 'chests()')).trail, { timeout: 15_000 }).toBe(true);
  expect((await cozy(page, 'state')).puzzles.trail).toBe(true);

  // 4. Open the chest: the first time it gives the Fawn Bell (Fawn cloak).
  const wood0 = (await cozy(page, 'village()')).res.wood;
  await tp(page, pts[n - 1][0], pts[n - 1][1] + 50);
  await expect.poll(async () => (await cozy(page, 'state')).prompt, { timeout: 10_000 }).toBe('Open');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/trail-03-chest.png` });
  await tapWorld(page, pts[n - 1][0], pts[n - 1][1] - 20);
  await expect.poll(async () => (await tr(page)).opened, { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => (await cozy(page, 'state')).treasures, { timeout: 10_000 }).toContain('fawn_bell');
  expect((await cozy(page, 'village()')).res.wood).toBe(wood0);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${SHOTS}/trail-04-fawn-bell.png` });

  // 5. Stays solved after reload.
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  expect((await tr(page)).step).toBe(n);
  expect(errors).toEqual([]);
});
