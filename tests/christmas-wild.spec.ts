import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Christmas slice 5: the Wild Woods in Christmas are snowy too: snow ground, white clearings, icy ponds,
// frosted trees and gentle snowfall. Spring brings the green woods back.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.XMAS_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const wild = (page: Page) => cozy(page, 'wild()');

test('christmas wild woods: snowy ground and snowfall', async ({ page }) => {
  test.setTimeout(300_000);
  try {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'christmas', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
    });
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1200);
    for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
    await cozy(page, 'enterWild(4242)');
    await expect.poll(async () => (await wild(page)).on, { timeout: 60_000, intervals: [500] }).toBe(true);
    await page.waitForTimeout(5000);
    let w = await wild(page);
    expect(w.ground).toBe('wg_snow');
    expect(w.snowing).toBe(true);
    await page.screenshot({ path: `${SHOTS}/christmas-wild.png` });
    const ps: any[] = await cozy(page, 'particleFrames()');
    expect(ps.filter((p) => p.frameTex !== p.tex || p.frame === '__BASE')).toEqual([]);
    await cozy(page, "setTheme('spring')");
    await page.waitForTimeout(1000);
    w = await wild(page);
    expect(w.ground).toBe('wg_classic');
    expect(w.snowing).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});
