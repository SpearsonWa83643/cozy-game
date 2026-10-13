import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Tap leaf/birch trees for wood: stock depletes after ~5 hits, then no more wood.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const village = (page: Page) => cozy(page, 'village()');
const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [x, y] as const) as Promise<{ x: number; y: number }>;
const tapWorld = async (page: Page, x: number, y: number) => { const p = await toScreen(page, x, y); await page.touchscreen.tap(p.x, p.y); };

test('harvest: tap leaf/birch tree for wood until stock empty', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);

  // Near the glade start — leaf trees ring the meadow.
  await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
  await page.waitForTimeout(800);

  const trees = await page.evaluate(() => (window as any).__cozy.woodTrees(905, 1330));
  expect(trees.length, 'need a wood tree near start').toBeGreaterThan(0);
  const t = trees[0] as [number, number, number, number];
  expect(t[3]).toBe(5);

  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x + 80, y + 40), [t[0], t[2]]);
  await page.waitForTimeout(1000);

  const wood0 = (await village(page)).res.wood as number;

  // Tap until wood increases (first successful harvest).
  let wood1 = wood0;
  for (let i = 0; i < 8 && wood1 <= wood0; i++) {
    await tapWorld(page, t[0], t[1]);
    await page.waitForTimeout(700);
    // Prefer direct world tap if screen tap missed (soft + path edge cases).
    await page.evaluate(([x, y]) => (window as any).__cozy.tapWorld(x, y), [t[0], t[1]]);
    await page.waitForTimeout(500);
    wood1 = (await village(page)).res.wood;
  }
  expect(wood1).toBeGreaterThan(wood0);

  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/harvest-wood-slice1.png` });

  // Drain remaining stock on this tree.
  const stockLeft = await page.evaluate(([x, y]) => {
    const list = (window as any).__cozy.woodTrees(x, y) as [number, number, number, number][];
    const hit = list.find((r) => r[0] === x);
    return hit ? hit[3] : 0;
  }, [t[0], t[2]]);
  for (let i = 0; i < stockLeft + 2; i++) {
    await page.evaluate(([x, y]) => (window as any).__cozy.tapWorld(x, y), [t[0], t[1]]);
    await page.waitForTimeout(350);
  }

  const afterDrain = await page.evaluate(([x, y]) => {
    const list = (window as any).__cozy.woodTrees(x, y) as [number, number, number, number][];
    const hit = list.find((r) => r[0] === x);
    return hit ? hit[3] : -1;
  }, [t[0], t[2]]);
  expect(afterDrain).toBe(0);

  const woodFull = (await village(page)).res.wood as number;
  // Extra taps on an empty tree must not grant more wood.
  for (let i = 0; i < 4; i++) {
    await page.evaluate(([x, y]) => (window as any).__cozy.tapWorld(x, y), [t[0], t[1]]);
    await page.waitForTimeout(350);
  }
  expect((await village(page)).res.wood).toBe(woodFull);
  // At most 5 wood from this one tree (start stock).
  expect(woodFull - wood0).toBeLessThanOrEqual(5);
  expect(woodFull - wood0).toBeGreaterThanOrEqual(1);

  expect(errors.filter((e) => !/AudioContext|favicon|Failed to load/i.test(e))).toEqual([]);
});
