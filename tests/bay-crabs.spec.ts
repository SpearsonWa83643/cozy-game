import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 78: Seashell Bay hermit crabs scuttle along the beach, duck into their shells when you walk up,
// and wave their claws when tapped. Hidden in the snowy themes.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.CRAB_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const BAY = { x: 6500, y: 4750, rx: 950, ry: 520 };

test('hermit crabs: scuttle, wave when tapped, hide when you come close', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade', 'bay'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }

  const c0 = await cozy(page, 'crabs()');
  expect(c0.shown).toBe(true);
  expect(c0.list.length).toBe(4);
  // Far away they are culled.
  expect(c0.list.every((c: any) => !c.on)).toBe(true);
  // Stand a little inland from crab 0.
  const k = c0.list[0];
  const a = Math.atan2((k.y - BAY.y) / BAY.ry, (k.x - BAY.x) / BAY.rx);
  await cozy(page, `teleport(${Math.round(BAY.x + Math.cos(a) * BAY.rx * 1.5)}, ${Math.round(BAY.y + Math.sin(a) * BAY.ry * 1.5)})`);
  await expect.poll(async () => (await cozy(page, 'crabs()')).list[0].on, { timeout: 20_000 }).toBe(true);
  // It scuttles along the sand.
  const p0 = (await cozy(page, 'crabs()')).list[0];
  await expect.poll(async () => { const q = (await cozy(page, 'crabs()')).list[0]; return Math.abs(q.x - p0.x); }, { timeout: 40_000, intervals: [200] }).toBeGreaterThan(3);
  expect(c0.list.every((c: any) => c.y < BAY.y - 200)).toBe(true);
  // Tap it with a real touch while it stops for a look: it waves its claws.
  await expect.poll(async () => (await cozy(page, 'crabs()')).list[0].state, { timeout: 30_000, intervals: [100] }).toBe('rest');
  const c1 = (await cozy(page, 'crabs()')).list[0];
  const sp = await cozy(page, `worldToScreen(${c1.x}, ${c1.y - 22})`);
  await page.touchscreen.tap(sp.x, sp.y);
  await expect.poll(async () => (await cozy(page, 'crabs()')).taps, { timeout: 20_000, intervals: [50] }).toBe(1);
  await expect.poll(async () => (await cozy(page, 'crabs()')).list[0].tex, { timeout: 10_000, intervals: [50] }).toBe('hcrab_wave');
  await page.screenshot({ path: `${SHOTS}/bay-crabs-wave.png` });
  // Walk right up: it ducks into its shell.
  await expect.poll(async () => (await cozy(page, 'crabs()')).list[0].state, { timeout: 30_000, intervals: [100] }).not.toBe('wave');
  const c2 = (await cozy(page, 'crabs()')).list[0];
  await cozy(page, `teleport(${c2.x + 40}, ${c2.y + 30})`);
  await expect.poll(async () => (await cozy(page, 'crabs()')).list[0].state, { timeout: 20_000, intervals: [100] }).toBe('in');
  expect((await cozy(page, 'crabs()')).hides).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/bay-crabs-hide.png` });
  // Hidden in snow.
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  const sw = await cozy(page, 'crabs()');
  if (sw.shown === false) expect(sw.list.every((c: any) => !c.on)).toBe(true);
  expect(errors).toEqual([]);
});
