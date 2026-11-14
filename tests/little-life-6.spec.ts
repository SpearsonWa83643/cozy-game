import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 119–122: little life 6 — lighthouse puffins, orchard puppies, lake path chipmunks, forest bear cub.
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

const KINDS: [string, number, string, boolean][] = [
  ['puffin', 2, 'puffins', false], ['puppy', 2, 'puppies', false], ['chipmunk', 2, 'chipmunks', true], ['bearcub', 1, 'bearcub', true],
];

test('little life 6: puffins, puppies, chipmunks, bear cub react to taps; snowy hiding', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  await boot(page, errors);
  for (const [k, min, shot] of KINDS) {
    const s0 = await cozy(page, `life2('${k}')`);
    expect(s0.shown, k).toBe(true);
    expect(s0.list.length, k).toBeGreaterThanOrEqual(min);
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
  }
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  for (const [k, , , hides] of KINDS) {
    if (hides) {
      await expect.poll(async () => (await cozy(page, `life2('${k}')`)).shown, { timeout: 15_000 }).toBe(false);
      expect((await cozy(page, `life2('${k}')`)).list.every((q: any) => !q.visible)).toBe(true);
    } else expect((await cozy(page, `life2('${k}')`)).shown).toBe(true);
  }
  expect(errors).toEqual([]);
});
