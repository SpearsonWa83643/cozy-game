import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 32: on Fall windy days the hero flies a kite; tap it for a loop-de-loop. Gone when the wind settles;
// no kite in Spring rain.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('kite: flies on windy fall days, tap for a loop, lands when the wind stops', async ({ page }) => {
  test.setTimeout(480_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'fall', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
  await cozy(page, 'teleport(900, 1000)');
  await page.waitForTimeout(500);
  expect((await cozy(page, 'kite()')).show).toBe(0);

  await cozy(page, `villageEvent('rain')`);
  await expect.poll(() => cozy(page, 'village()').then((v) => v.weather), { timeout: 30_000 }).toBe('wind');
  await expect.poll(() => cozy(page, 'kite()').then((k) => k.show), { timeout: 60_000 }).toBe(1);
  const s = await cozy(page, 'state');
  await page.waitForTimeout(1500);
  const k = await cozy(page, 'kite()');
  expect(k.y).toBeLessThan(s.y - 100); // up in the sky
  expect(k.x).toBeGreaterThan(s.x + 40); // downwind

  // Tap the kite: loop-de-loop, and the hero stays put.
  const p = await cozy(page, `worldToScreen(${k.x}, ${k.y + 8})`);
  await page.touchscreen.tap(p.x, p.y);
  await expect.poll(() => cozy(page, 'kite()').then((q) => q.loops), { timeout: 30_000, intervals: [50] }).toBe(1);
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'screenshots/kite.png' });
  await expect.poll(() => cozy(page, 'kite()').then((q) => q.looping), { timeout: 60_000 }).toBe(false);
  const s2 = await cozy(page, 'state');
  expect(Math.hypot(s2.x - s.x, s2.y - s.y)).toBeLessThan(4);

  // It follows the hero around.
  await cozy(page, `teleport(${s.x - 200}, ${s.y})`);
  await page.waitForTimeout(2500);
  const k2 = await cozy(page, 'kite()'), s3 = await cozy(page, 'state');
  expect(Math.abs(k2.x - (s3.x + 95))).toBeLessThan(80);

  // The wind settles: the kite floats away.
  await cozy(page, 'weatherLeft(0.3)');
  await expect.poll(() => cozy(page, 'kite()').then((q) => q.show), { timeout: 60_000 }).toBe(0);

  // Spring rain: no kite.
  await cozy(page, `setTheme('spring')`); await page.waitForTimeout(500);
  await cozy(page, `villageEvent('rain')`);
  await expect.poll(() => cozy(page, 'village()').then((v) => v.weather), { timeout: 30_000 }).toBe('rain');
  await page.waitForTimeout(2500);
  expect((await cozy(page, 'kite()')).show).toBe(0);
  expect(errors).toEqual([]);
});
