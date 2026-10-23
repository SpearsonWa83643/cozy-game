import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Christmas slice 4: presents to pop, snowmen to wobble and lit trees whose lights twinkle, all tapped
// on the iPad touch screen. They only show in Christmas.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.XMAS_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('christmas props: tap presents, snowman and lit tree', async ({ page }) => {
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

    let c = await cozy(page, 'christmas()');
    expect(c.presents.length).toBeGreaterThanOrEqual(6);
    expect(c.snowmen.length).toBeGreaterThanOrEqual(2);
    expect(c.litTrees.length).toBeGreaterThanOrEqual(3);
    expect(c.bulbs).toBeGreaterThan(30);

    const tp = (x: number, y: number) => page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y]);
    const tapWorld = async ([x, y]: [number, number]) => {
      const s = await cozy(page, `worldToScreen(${x}, ${y})`);
      await page.touchscreen.tap(Math.round(s.x), Math.round(s.y));
      await page.waitForTimeout(500);
    };
    // Walk-free: stand near each prop and tap it.
    const near = async ([x, y]: [number, number]) => { await tp(x, y + 90); await page.waitForTimeout(1500); };
    await near(c.presents[0]); await tapWorld(c.presents[0]);
    await near(c.snowmen[0]); await tapWorld(c.snowmen[0]);
    await near(c.litTrees[0]); await tapWorld(c.litTrees[0]);
    c = await cozy(page, 'christmas()');
    expect(c.taps.presents).toBeGreaterThanOrEqual(1);
    expect(c.taps.snowman).toBeGreaterThanOrEqual(1);
    expect(c.taps.lights).toBeGreaterThanOrEqual(1);

    // Showcase shot near home: presents, a snowman and a lit tree.
    await tp(905, 1300);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${SHOTS}/christmas-props.png` });

    // Hidden outside Christmas, back on return.
    await cozy(page, "setTheme('spring')");
    await page.waitForTimeout(800);
    c = await cozy(page, 'christmas()');
    expect(c.presents.length + c.snowmen.length + c.litTrees.length + c.bulbs).toBe(0);
    await cozy(page, "setTheme('christmas')");
    await page.waitForTimeout(800);
    expect((await cozy(page, 'christmas()')).presents.length).toBeGreaterThanOrEqual(6);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});
