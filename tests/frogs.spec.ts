import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 83: pond frogs on lily pads — bob, tap to hop+croak+splash, hop between pads, hidden in snow.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.FROG_SHOTS ?? 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('pond frogs: idle, tap hop croak, hop pads, hidden in winter', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }

  const f0 = await cozy(page, 'frogs()');
  expect(f0.shown).toBe(true);
  expect(f0.list.length).toBeGreaterThanOrEqual(3);
  expect(f0.pads.length).toBeGreaterThanOrEqual(3);
  // Culled while far away.
  expect(f0.list.every((f: any) => !f.on)).toBe(true);

  // Stand by the pond near frog 0.
  const k = f0.list[0];
  await cozy(page, `teleport(${k.x + 90}, ${k.y + 110})`);
  await expect.poll(async () => (await cozy(page, 'frogs()')).list[0].on, { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/frogs-idle.png` });

  // Real touch tap: hop + croak.
  const hops0 = (await cozy(page, 'frogs()')).hops;
  const f1 = (await cozy(page, 'frogs()')).list[0];
  const sp = await cozy(page, `worldToScreen(${f1.x}, ${f1.y - 14})`);
  await page.touchscreen.tap(sp.x, sp.y);
  await expect.poll(async () => (await cozy(page, 'frogs()')).taps, { timeout: 20_000, intervals: [50] }).toBe(1);
  await expect.poll(async () => (await cozy(page, 'frogs()')).hops, { timeout: 10_000, intervals: [50] }).toBeGreaterThan(hops0);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/frogs-hop.png` });

  // Settle, then wait for an idle hop (or force via frogTap on another).
  await expect.poll(async () => (await cozy(page, 'frogs()')).list[0].hopping, { timeout: 15_000, intervals: [100] }).toBe(false);
  const hops1 = (await cozy(page, 'frogs()')).hops;
  await cozy(page, 'frogTap(1)');
  await expect.poll(async () => (await cozy(page, 'frogs()')).hops, { timeout: 10_000 }).toBeGreaterThan(hops1);

  // Hidden in snow.
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await expect.poll(async () => (await cozy(page, 'frogs()')).shown, { timeout: 15_000 }).toBe(false);
  expect((await cozy(page, 'frogs()')).list.every((f: any) => !f.on)).toBe(true);
  expect(errors).toEqual([]);
});
