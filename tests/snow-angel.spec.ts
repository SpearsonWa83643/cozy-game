import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 30: in Winter / Christmas, tapping your hero starts with a snow angel (lie back, flap, fading angel
// shape), then the usual hop/twirl/hearts. Green themes keep hop/twirl/hearts and leave no angels.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const SPOTS: [number, number][] = [[470, 1820], [1600, 1500], [2200, 1700], [900, 1000], [2600, 2300]];

test('snow angel: tap the hero in winter for a snow angel that fades; none in spring', async ({ page }) => {
  test.setTimeout(480_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'winter', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }

  let ok = false;
  for (const [x, y] of SPOTS) {
    await cozy(page, `teleport(${x}, ${y})`); await page.waitForTimeout(500);
    if ((await cozy(page, 'joy()')).can) { ok = true; break; }
  }
  expect(ok).toBe(true);

  const tapHero = async () => {
    const s = await cozy(page, 'state');
    const p = await cozy(page, `worldToScreen(${s.x}, ${s.y - 30})`);
    await page.touchscreen.tap(p.x, p.y);
  };

  // First tap in the snow: a snow angel.
  const before = await cozy(page, 'state');
  await tapHero();
  await expect.poll(() => cozy(page, 'joy()').then((j) => j.kind), { timeout: 30_000, intervals: [50] }).toBe('angel');
  expect((await cozy(page, 'angels()')).made).toBe(1);
  // Lying back: the hero is squashed down.
  await expect.poll(() => cozy(page, 'joy()').then((j) => j.sx), { timeout: 30_000, intervals: [30] }).toBeGreaterThan(1.05);
  await expect.poll(() => cozy(page, 'angels()').then((a) => a.showing), { timeout: 30_000, intervals: [50] }).toBe(1);
  await expect.poll(() => cozy(page, 'joy()').then((j) => j.kind), { timeout: 60_000 }).toBe(null);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/snow-angel.png' });
  const after = await cozy(page, 'state');
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(4);
  const j = await cozy(page, 'joy()');
  expect(j.sx).toBe(1);
  expect(Math.abs(j.angle)).toBeLessThan(0.01);

  // Next tap: the usual hop.
  await tapHero();
  await expect.poll(() => cozy(page, 'joy()').then((j) => j.joys), { timeout: 30_000, intervals: [50] }).toBe(2);
  expect((await cozy(page, 'joy()')).kind).toBe('hop');
  await expect.poll(() => cozy(page, 'joy()').then((j) => j.kind), { timeout: 60_000 }).toBe(null);

  // The angel fades away on its own.
  await expect.poll(() => cozy(page, 'angels()').then((a) => a.alive), { timeout: 120_000 }).toBe(0);

  // Christmas: angels too. Then switching to Spring clears them, and Spring has no angels.
  await cozy(page, `setTheme('christmas')`); await page.waitForTimeout(500);
  await expect.poll(async () => { const k = (await cozy(page, 'joy()')).kind; if (!k) await tapHero(); return (await cozy(page, 'angels()')).made; }, { timeout: 60_000, intervals: [900] }).toBe(2);
  await expect.poll(() => cozy(page, 'angels()').then((a) => a.alive), { timeout: 30_000 }).toBe(1);
  await expect.poll(() => cozy(page, 'joy()').then((j) => j.kind), { timeout: 60_000 }).toBe(null);
  await cozy(page, `setTheme('spring')`); await page.waitForTimeout(500);
  expect((await cozy(page, 'angels()')).alive).toBe(0);
  for (let i = 0; i < 4; i++) {
    const n = (await cozy(page, 'joy()')).joys;
    await tapHero();
    await expect.poll(() => cozy(page, 'joy()').then((j) => j.joys), { timeout: 30_000, intervals: [50] }).toBe(n + 1);
    expect((await cozy(page, 'joy()')).kind).not.toBe('angel');
    await expect.poll(() => cozy(page, 'joy()').then((j) => j.kind), { timeout: 60_000 }).toBe(null);
  }
  expect((await cozy(page, 'angels()')).made).toBe(2);
  expect(errors).toEqual([]);
});
