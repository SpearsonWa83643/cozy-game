import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 28: dandelion clocks in the glade: tap to blow the seeds away, they grow back, hidden in snowy themes.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('dandelions: tap to blow seeds, regrow, hidden in winter', async ({ page }) => {
  test.setTimeout(480_000);
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

  const d0 = await cozy(page, 'dandelions()');
  expect(d0.puffs.length).toBeGreaterThanOrEqual(5);
  expect(d0.puffs.every((p: any) => p.full && p.visible)).toBe(true);
  expect(d0.puffs.every((p: any) => p.x < 2000 && p.y < 1500)).toBe(true);

  // Stand next to one and tap its fluffy head.
  const p = d0.puffs[0];
  await cozy(page, `setDandelionRegrowMs(15000)`);
  await cozy(page, `teleport(${p.x - 70}, ${p.y + 10})`);
  await page.waitForTimeout(800);
  const before = await cozy(page, 'state');
  const s = await cozy(page, `worldToScreen(${p.x}, ${p.y - 34})`);
  await page.touchscreen.tap(s.x, s.y);
  await expect.poll(() => cozy(page, 'dandelions()').then((d) => d.blown), { timeout: 30_000, intervals: [50] }).toBe(1);
  const d1 = await cozy(page, 'dandelions()');
  expect(d1.puffs[0].full).toBe(false);
  expect(d1.seeds).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/dandelions.png' });
  const after = await cozy(page, 'state');
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(4); // tap doesn't walk the hero

  // Tapping the bare stem is just a wiggle (no second seed cloud).
  await page.touchscreen.tap(s.x, s.y);
  await page.waitForTimeout(600);
  expect((await cozy(page, 'dandelions()')).blown).toBe(1);

  // It grows a new head.
  await expect.poll(() => cozy(page, 'dandelions()').then((d) => d.puffs[0].full), { timeout: 120_000 }).toBe(true);

  // Winter hides them; spring brings them back.
  await cozy(page, `setTheme('winter')`);
  await expect.poll(() => cozy(page, 'dandelions()').then((d) => d.puffs.some((q: any) => q.visible)), { timeout: 30_000 }).toBe(false);
  await cozy(page, `setTheme('spring')`);
  await expect.poll(() => cozy(page, 'dandelions()').then((d) => d.puffs.every((q: any) => q.visible)), { timeout: 30_000 }).toBe(true);
  expect(errors).toEqual([]);
});
