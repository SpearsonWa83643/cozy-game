import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 26: tap your own hero for a happy hop / twirl / hearts (they take turns). Visual only: no walking off.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const SPOTS: [number, number][] = [[470, 1820], [1600, 1500], [2200, 1700], [900, 1000], [2600, 2300]];

test('hero joy: tap the hero for hop, twirl, hearts; hero stays put', async ({ page }) => {
  test.setTimeout(420_000);
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

  // Find an open spot (no door / sign right next to the hero).
  let ok = false;
  for (const [x, y] of SPOTS) {
    await cozy(page, `teleport(${x}, ${y})`); await page.waitForTimeout(500);
    if ((await cozy(page, 'joy()')).can) { ok = true; break; }
  }
  expect(ok).toBe(true);
  expect((await cozy(page, 'joy()')).joys).toBe(0);

  const tapHero = async () => {
    const s = await cozy(page, 'state');
    const p = await cozy(page, `worldToScreen(${s.x}, ${s.y - 30})`);
    await page.touchscreen.tap(p.x, p.y);
  };
  const seen: string[] = [];
  for (let i = 0; i < 3; i++) {
    const before = await cozy(page, 'state');
    await tapHero();
    await expect.poll(() => cozy(page, 'joy()').then((j) => j.joys), { timeout: 30_000, intervals: [50] }).toBe(i + 1);
    await page.waitForTimeout(100);
    const mid = await cozy(page, 'joy()');
    seen.push(mid.kind);
    if (i === 0) {
      // Mid-hop: the sprite is off the ground.
      await expect.poll(() => cozy(page, 'joy()').then((j) => j.dy), { timeout: 30_000, intervals: [30] }).toBeGreaterThan(4);
      await page.screenshot({ path: 'screenshots/hero-joy.png' });
    }
    await expect.poll(() => cozy(page, 'joy()').then((j) => j.kind), { timeout: 60_000 }).toBe(null);
    const after = await cozy(page, 'state');
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(4); // tapping yourself doesn't walk
    const j = await cozy(page, 'joy()');
    expect(Math.abs(j.angle)).toBeLessThan(0.01);
    expect(j.sx).toBe(1);
  }
  expect(seen).toEqual(['hop', 'twirl', 'hearts']);

  // Tapping a bit away from the hero still walks there as before.
  const s0 = await cozy(page, 'state');
  const far = await cozy(page, `worldToScreen(${s0.x + 160}, ${s0.y})`);
  await page.touchscreen.tap(far.x, far.y);
  await expect.poll(() => cozy(page, 'state').then((s1) => Math.hypot(s1.x - s0.x, s1.y - s0.y)), { timeout: 60_000 }).toBeGreaterThan(40);
  expect((await cozy(page, 'joy()')).joys).toBe(3);
  expect(errors).toEqual([]);
});
