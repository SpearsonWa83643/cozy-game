import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Theme: Winter (slice 1). Deep snow, frosted + snow-capped trees, frosty tufts, thick snowfall,
// snowmen (no presents or Christmas lights), its own 'winter' soundscape, icy-blue UI, picker
// button in the HUD and the menu, and snowy Wild Woods. Switching away and back follows live.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.WINTER_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
type R = { x: number; y: number; w: number; h: number };
const tapRect = (page: Page, r: R) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('winter: snowy look, snowmen only, own soundscape, picker', async ({ page }) => {
  test.setTimeout(300_000);
  try {
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

    expect((await cozy(page, 'village()')).theme).toBe('winter');
    expect((await cozy(page, 'state')).soundscape).toBe('winter');
    let c = await cozy(page, 'christmas()');
    expect(c.petal).toBe('p_snow');
    expect(c.frosted).toBeGreaterThan(10);
    expect(c.caps).toBeGreaterThan(10);
    expect(c.snowTufts).toBe(c.tufts);
    expect(c.snowmen.length).toBeGreaterThan(0);
    expect(c.presents.length).toBe(0);
    expect(c.litTrees.length).toBe(0);
    expect(c.bulbs).toBe(0);

    await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${SHOTS}/winter.png` });
    // A snowman wobbles when tapped.
    const [sx, sy] = c.snowmen[0];
    await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y + 90), [sx, sy]);
    await page.waitForTimeout(2500);
    const sc = await cozy(page, `worldToScreen(${sx}, ${sy})`);
    await page.touchscreen.tap(Math.round(sc.x), Math.round(sc.y));
    await expect.poll(async () => (await cozy(page, 'christmas()')).taps.snowman, { timeout: 5_000 }).toBe(1);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/winter-snowman.png` });

    // HUD picker offers the other four themes; Spring switches look and sound live.
    await cozy(page, "setTheme('spring')");
    await page.waitForTimeout(1200);
    expect((await cozy(page, 'state')).soundscape).toBe('spring');
    c = await cozy(page, 'christmas()');
    expect(c.frosted).toBe(0);
    expect(c.snowmen.length).toBe(0);
    // Christmas shows the presents again; Winter hides them.
    await cozy(page, "setTheme('christmas')");
    await page.waitForTimeout(1200);
    expect((await cozy(page, 'christmas()')).presents.length).toBeGreaterThan(0);
    await cozy(page, "setTheme('winter')");
    await page.waitForTimeout(1200);
    c = await cozy(page, 'christmas()');
    expect(c.presents.length).toBe(0);
    expect(c.snowmen.length).toBeGreaterThan(0);
    expect((await cozy(page, 'state')).soundscape).toBe('winter');

    // The menu has a Winter theme button, clear of the tabs.
    const bag = await page.evaluate(() => { const u = (window as any).__game.scene.getScene('ui'); return { x: u.bagC.x, y: u.bagC.y }; });
    await page.touchscreen.tap(bag.x, bag.y);
    await expect.poll(() => page.evaluate(() => (window as any).__menu?.open), { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(800);
    const rects = await page.evaluate(() => (window as any).__menu.rects);
    expect(rects['theme:winter']).toBeTruthy();
    const tabs = Object.keys(rects).filter((k) => k.startsWith('tab:')).map((k) => rects[k] as R);
    const lastTab = tabs.reduce((a, b) => (a.x > b.x ? a : b));
    expect(lastTab.x + lastTab.w).toBeLessThanOrEqual(rects['theme:spring'].x + 1);
    await page.screenshot({ path: `${SHOTS}/winter-menu.png` });
    await tapRect(page, rects.close);
    await expect.poll(() => page.evaluate(() => (window as any).__menu?.open), { timeout: 10_000 }).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});
