import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 89: pinecone tumble — tap rolls downhill, respawns, all themes.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.CONE_SHOTS ?? 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('pinecone tumble: idle, tap roll, respawn, stay in winter', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade', 'hills'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }

  const p0 = await cozy(page, 'pinecones()');
  expect(p0.shown).toBe(true);
  expect(p0.list.length).toBeGreaterThanOrEqual(4);

  await cozy(page, 'teleport(900, 900)');
  await expect.poll(async () => (await cozy(page, 'pinecones()')).list.every((c: any) => !c.on), { timeout: 20_000 }).toBe(true);

  const k = p0.list[0];
  await cozy(page, `teleport(${k.homeX + 80}, ${k.homeY + 60})`);
  await expect.poll(async () => (await cozy(page, 'pinecones()')).list[0].on, { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/pinecones-idle.png` });

  const taps0 = (await cozy(page, 'pinecones()')).taps;
  await cozy(page, 'coneTap(0)');
  await expect.poll(async () => (await cozy(page, 'pinecones()')).taps, { timeout: 10_000 }).toBe(taps0 + 1);
  await expect.poll(async () => {
    const s = await cozy(page, 'pinecones()');
    return s.tumbles > 0 && (s.list[0].tumbling || s.list[0].waiting || !s.list[0].on);
  }, { timeout: 10_000 }).toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/pinecones-tumble.png` });

  // Wait for respawn.
  await expect.poll(async () => {
    const c = (await cozy(page, 'pinecones()')).list[0];
    return c.on && !c.waiting && !c.tumbling;
  }, { timeout: 20_000 }).toBe(true);

  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await expect.poll(async () => (await cozy(page, 'pinecones()')).shown, { timeout: 15_000 }).toBe(true);
  expect(errors).toEqual([]);
});
