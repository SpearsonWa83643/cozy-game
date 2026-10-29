import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 31: rainy days (Spring rain, Summer sun shower) fill little puddles by the paths; walking through one
// splashes; after the rain they dry up. Windy Fall days make no puddles.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('puddles: fill in the rain, splash when walked through, dry up after; none on windy days', async ({ page }) => {
  test.setTimeout(600_000);
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

  const p0 = await cozy(page, 'puddles()');
  expect(p0.list.length).toBeGreaterThanOrEqual(6);
  expect(p0.list.every((q: any) => !q.visible && q.level === 0)).toBe(true);

  // Rain: puddles fill.
  await cozy(page, `villageEvent('rain')`);
  await expect.poll(() => cozy(page, 'puddles()').then((p) => p.wet), { timeout: 30_000 }).toBe(true);
  await expect.poll(() => cozy(page, 'puddles()').then((p) => p.list.filter((q: any) => q.level >= 0.99).length), { timeout: 120_000 }).toBe(p0.list.length);

  // Walk through one: splash. Try puddles until one has clear ground on both sides.
  let splashed = false;
  for (const q of p0.list) {
    await cozy(page, `teleport(${q.x - 90}, ${q.y})`);
    await page.waitForTimeout(500);
    const s = await cozy(page, 'state');
    if (Math.hypot(s.x - (q.x - 90), s.y - q.y) > 10) continue;
    const before = (await cozy(page, 'puddles()')).splashes;
    const t = await cozy(page, `worldToScreen(${q.x + 90}, ${q.y})`);
    await page.touchscreen.tap(t.x, t.y);
    try {
      await expect.poll(() => cozy(page, 'puddles()').then((p) => p.splashes), { timeout: 40_000, intervals: [50] }).toBeGreaterThan(before);
      await page.waitForTimeout(120);
      await page.screenshot({ path: 'screenshots/puddles.png' });
      splashed = true;
      break;
    } catch { /* blocked path; try the next puddle */ }
  }
  expect(splashed).toBe(true);

  // Rain stops: rainbow toast as before, and the puddles dry up.
  await cozy(page, 'setPuddleDry(3)');
  await cozy(page, 'weatherLeft(0.3)');
  await expect.poll(() => cozy(page, 'puddles()').then((p) => p.wet), { timeout: 30_000 }).toBe(false);
  await expect.poll(() => cozy(page, 'puddles()').then((p) => p.list.filter((q: any) => q.visible).length), { timeout: 60_000 }).toBe(0);

  // Fall windy day: no puddles.
  await cozy(page, `setTheme('fall')`); await page.waitForTimeout(500);
  await cozy(page, `villageEvent('rain')`);
  await expect.poll(() => cozy(page, 'village()').then((v) => v.weather), { timeout: 30_000 }).toBe('wind');
  await page.waitForTimeout(3000);
  const f = await cozy(page, 'puddles()');
  expect(f.wet).toBe(false);
  expect(f.list.filter((q: any) => q.visible).length).toBe(0);
  await cozy(page, 'weatherLeft(0.3)');

  // Summer sun shower fills them too.
  await cozy(page, `setTheme('summer')`); await page.waitForTimeout(1500);
  await cozy(page, `villageEvent('rain')`);
  await expect.poll(() => cozy(page, 'puddles()').then((p) => p.list.filter((q: any) => q.visible).length), { timeout: 60_000 }).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
