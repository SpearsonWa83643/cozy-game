import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 143–146: little life 12 — bay koala, grove sloth (hidden in snow), lakeside capybara, snowy walrus (snowy themes only).
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

const KINDS: [string, number, string][] = [['koala', 1, 'koala'], ['sloth', 1, 'sloth'], ['capybara', 1, 'capybara']];

test('little life 12: koala, sloth, capybara react to taps; walrus only in snow, sloth hides in snow', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  await boot(page, errors);
  const check = async (k: string, min: number, shot: string) => {
    const s0 = await cozy(page, `life2('${k}')`);
    expect(s0.shown, k).toBe(true);
    expect(s0.list.length, k).toBeGreaterThanOrEqual(min);
    // Clear of the learning-puzzle sites.
    for (const q of s0.list) for (const [px, py] of [[5550, 1060], [7300, 3780], [2950, 4500], [7200, 2420]]) expect(Math.hypot(q.hx - px, q.hy - py), k).toBeGreaterThan(260);
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
  // The walrus stays hidden outside the snowy themes.
  expect((await cozy(page, "life2('walrus')")).shown).toBe(false);
  expect((await cozy(page, "life2('walrus')")).list.every((q: any) => !q.visible)).toBe(true);
  for (const [k, min, shot] of KINDS) await check(k, min, shot);
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await page.waitForTimeout(800);
  for (const k of ['koala', 'capybara']) expect((await cozy(page, `life2('${k}')`)).shown, k).toBe(true);
  // The sloth naps out of sight when it snows.
  expect((await cozy(page, "life2('sloth')")).shown).toBe(false);
  expect((await cozy(page, "life2('sloth')")).list.every((q: any) => !q.visible)).toBe(true);
  await check('walrus', 1, 'walrus');
  await page.evaluate(() => (window as any).__cozy.setTheme?.('spring'));
  await expect.poll(async () => (await cozy(page, "life2('walrus')")).shown, { timeout: 15_000 }).toBe(false);
  expect((await cozy(page, "life2('walrus')")).list.every((q: any) => !q.visible)).toBe(true);
  expect((await cozy(page, "life2('sloth')")).shown).toBe(true);
  expect(errors).toEqual([]);
});
