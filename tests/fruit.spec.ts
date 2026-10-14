import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Fruit trees hold a small stock of fruit: tapping drops them one at a time, an empty tree shows
// no fruit and just rustles, and the fruit grow back over time (timer shortened via the debug hook).
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = 'screenshots';
type FT = [number, number, number, number, number]; // x, tapY, baseY, stock, fruitShowing
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const treeAt = (page: Page, x: number, y: number) => page.evaluate(([x, y]) =>
  ((window as any).__cozy.fruitTrees(x, y) as FT[]).find((r) => r[0] === x && r[2] === y) ?? null, [x, y] as const) as Promise<FT | null>;
const apples = async (page: Page) => (await cozy(page, 'pickups()')).filter((p: any) => p[2] === 'apple') as [number, number, string][];

test('fruit trees deplete, show no fruit, then regrow', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  // Keep fruit from growing back while we check the empty tree (the box is slow).
  await cozy(page, 'setFruitRegrowMs(600000)');

  // Orchard: rows of apple/pear trees. Pick a tree with a neighbour beside it on the same row.
  const near = (await page.evaluate(() => (window as any).__cozy.fruitTrees(3100, 2420))) as FT[];
  let a: FT | undefined, b: FT | undefined;
  for (const t of near) {
    const n = near.find((o) => o !== t && Math.abs(o[2] - t[2]) < 40 && Math.abs(o[0] - t[0]) > 120 && Math.abs(o[0] - t[0]) < 240);
    if (n) { a = t[0] < n[0] ? t : n; b = t[0] < n[0] ? n : t; break; }
  }
  expect(a && b, 'need two neighbouring fruit trees').toBeTruthy();
  const [ax, , ay] = a!, [bx, , by] = b!;
  expect(a![3]).toBe(4);

  // Stand just in front of the left tree.
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x + 60, y + 60), [ax, ay]);
  await page.waitForFunction(([x, y]) => ((window as any).__cozy.fruitTrees(x, y) as FT[]).some((r) => r[0] === x && r[2] === y && r[4] === 4), [ax, ay], { timeout: 60_000 });

  // Tap it until it is empty: each fruit-giving tap drops exactly one fruit.
  const pick0 = (await apples(page)).length;
  for (let i = 0; i < 20 && (await treeAt(page, ax, ay))![3] > 0; i++) {
    const before = (await treeAt(page, ax, ay))![3];
    await page.evaluate(([x, y]) => (window as any).__cozy.tapWorld(x, y), [a![0], a![1]]);
    await page.waitForFunction(([x, y, n]) => ((window as any).__cozy.fruitTrees(x, y) as FT[]).some((r) => r[0] === x && r[2] === y && r[3] < n), [ax, ay, before], { timeout: 4_000 }).catch(() => {});
  }
  const empty = (await treeAt(page, ax, ay))!;
  expect(empty[3]).toBe(0);
  expect(empty[4], 'no fruit left in the canopy').toBe(0);
  await expect.poll(async () => (await apples(page)).length - pick0 + (await cozy(page, 'state')).snacks, { timeout: 20_000 }).toBe(4);
  expect((await treeAt(page, bx, by))![3], 'neighbour untouched').toBe(4);

  // An empty tree just rustles: no more fruit.
  const n0 = (await apples(page)).length, s0 = (await cozy(page, 'state')).snacks;
  for (let i = 0; i < 3; i++) {
    await page.evaluate(([x, y]) => (window as any).__cozy.tapWorld(x, y), [a![0], a![1]]);
    await page.waitForTimeout(900);
  }
  expect((await apples(page)).length).toBe(n0);
  expect((await cozy(page, 'state')).snacks).toBe(s0);

  // Pick up the fallen fruit: they still go into the basket for feeding animals.
  for (const p of await apples(page)) { await page.evaluate(([x, y]) => (window as any).__cozy.tapWorld(x, y - 4), [p[0], p[1]]); await page.waitForTimeout(500); }
  await expect.poll(async () => (await cozy(page, 'state')).snacks, { timeout: 30_000 }).toBeGreaterThanOrEqual(4);

  // Screenshot: the empty tree (left) next to a full one (right).
  // Stand between the two trunks (out from behind any canopy, so nothing fades).
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y - 22), [(ax + bx) / 2, (ay + by) / 2]);
  await page.waitForFunction(([x, y]) => ((window as any).__cozy.fruitTrees(x, y) as FT[]).some((r) => r[0] === x && r[2] === y && r[4] === 4), [bx, by], { timeout: 60_000 });
  await page.waitForTimeout(4500); // let the pickup toast fade
  await page.screenshot({ path: `${SHOTS}/fruit-deplete.png` });

  // Halloween: same stock, fruit still hang on the themed tree.
  await cozy(page, "setTheme('halloween')");
  await page.waitForTimeout(2500);
  expect((await treeAt(page, ax, ay))![4]).toBe(0);
  expect((await treeAt(page, bx, by))![4]).toBe(4);
  await page.screenshot({ path: `${SHOTS}/fruit-deplete-halloween.png` });
  await cozy(page, "setTheme('classic')");

  // Regrow (shortened timer): one fruit at a time until the tree is full again.
  await cozy(page, 'setFruitRegrowMs(2500)');
  await page.waitForFunction(([x, y]) => ((window as any).__cozy.fruitTrees(x, y) as FT[]).some((r) => r[0] === x && r[2] === y && r[3] >= 1 && r[3] < 4), [ax, ay], { timeout: 60_000 });
  await page.waitForFunction(([x, y]) => ((window as any).__cozy.fruitTrees(x, y) as FT[]).some((r) => r[0] === x && r[2] === y && r[3] === 4 && r[4] === 4), [ax, ay], { timeout: 120_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/fruit-regrown.png` });

  // A regrown tree gives fruit again.
  const n1 = (await apples(page)).length + (await cozy(page, 'state')).snacks;
  await page.evaluate(([x, y]) => (window as any).__cozy.tapWorld(x, y), [a![0], a![1]]);
  await page.waitForFunction(([x, y]) => ((window as any).__cozy.fruitTrees(x, y) as FT[]).some((r) => r[0] === x && r[2] === y && r[3] === 3), [ax, ay], { timeout: 10_000 });
  await expect.poll(async () => (await apples(page)).length + (await cozy(page, 'state')).snacks, { timeout: 10_000 }).toBeGreaterThan(n1);

  expect(errors.filter((e) => !/AudioContext|favicon|Failed to load/i.test(e))).toEqual([]);
});
