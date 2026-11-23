import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 159–162: little life 16 — hills/meadow baby rhino and riverbank platypus (hidden in snow), Fairy Grove toucan, snowy cardinals (snowy themes only).
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.POLISH_SHOTS ?? 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

async function boot(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade', 'river', 'forest', 'orchard', 'lake', 'village', 'meadow', 'grove', 'bay', 'hills'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
}

const KINDS: [string, number, string][] = [['rhino', 1, 'rhino'], ['toucan', 1, 'toucan'], ['platypus', 1, 'platypus']];

test('little life 16: rhino, toucan, platypus react to taps; cardinals only in snow, rhino and platypus hide in snow', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  await boot(page, errors);
  const check = async (k: string, min: number, shot: string) => {
    const s0 = await cozy(page, `life2('${k}')`);
    expect(s0.shown, k).toBe(true);
    expect(s0.list.length, k).toBeGreaterThanOrEqual(min);
    // Clear of the learning-puzzle sites.
    for (const q of s0.list) for (const [px, py] of [[5550, 1060], [7300, 3780], [2950, 4500], [7200, 2420]]) expect(Math.hypot(q.hx - px, q.hy - py), k).toBeGreaterThan(260);
    console.log(k, 'at', s0.list.map((q: any) => `${q.hx},${q.hy}`).join(' '));
    // Spaced out from every other little-life critter.
    const all = await page.evaluate(() => (window as any).__cozy.lifeAll?.() ?? null);
    if (all) for (const q of s0.list) for (const o of all) if (o.kind !== k) expect(Math.hypot(q.hx - o.hx, q.hy - o.hy), `${k} vs ${o.kind}`).toBeGreaterThan(200);
    const c = s0.list[0];
    await cozy(page, `teleport(${c.hx}, ${c.hy + 170})`);
    await expect.poll(async () => (await cozy(page, `life2('${k}')`)).list[0].on, { timeout: 20_000 }).toBe(true);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/${shot}-idle.png` });
    expect(await cozy(page, `life2Tap('${k}', 0)`)).toBe(true);
    // A second tap mid-reaction is ignored.
    expect(await cozy(page, `life2Tap('${k}', 0)`)).toBe(false);
    const s1 = await cozy(page, `life2('${k}')`);
    expect(s1.taps).toBe(1);
    expect(s1.list[0].busy).toBe(true);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/${shot}-tap.png` });
    await expect.poll(async () => (await cozy(page, `life2('${k}')`)).list[0].busy, { timeout: 60_000 }).toBe(false);
  };
  // The polar bear cub stays hidden outside the snowy themes.
  expect((await cozy(page, "life2('cardinal')")).shown).toBe(false);
  expect((await cozy(page, "life2('cardinal')")).list.every((q: any) => !q.visible)).toBe(true);
  for (const [k, min, shot] of KINDS) await check(k, min, shot);
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await page.waitForTimeout(800);
  expect((await cozy(page, "life2('toucan')")).shown).toBe(true);
  // The rhino and platypus stay out of sight when it snows.
  for (const k of ['rhino', 'platypus']) {
    expect((await cozy(page, `life2('${k}')`)).shown, k).toBe(false);
    expect((await cozy(page, `life2('${k}')`)).list.every((q: any) => !q.visible), k).toBe(true);
  }
  // The two cardinals sit side by side.
  const cl = (await cozy(page, "life2('cardinal')")).list;
  expect(Math.hypot(cl[0].hx - cl[1].hx, cl[0].hy - cl[1].hy)).toBeLessThan(80);
  expect(Math.hypot(cl[0].hx - cl[1].hx, cl[0].hy - cl[1].hy)).toBeGreaterThan(40);
  await check('cardinal', 2, 'cardinal');
  await page.evaluate(() => (window as any).__cozy.setTheme?.('spring'));
  await expect.poll(async () => (await cozy(page, "life2('cardinal')")).shown, { timeout: 15_000 }).toBe(false);
  expect((await cozy(page, "life2('cardinal')")).list.every((q: any) => !q.visible)).toBe(true);
  for (const k of ['rhino', 'platypus']) expect((await cozy(page, `life2('${k}')`)).shown, k).toBe(true);
  expect(errors).toEqual([]);
});
