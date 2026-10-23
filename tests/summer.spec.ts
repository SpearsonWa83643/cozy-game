import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Theme: Summer (slice 1). Lush deep-green meadow, sandy paths, dandelion fluff, sunny butterflies,
// its own 'summer' soundscape, teal UI, a sun button in the HUD picker and the menu. No snow,
// presents or snowmen. Switching away and back follows live.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.SUMMER_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
type R = { x: number; y: number; w: number; h: number };
const tapRect = (page: Page, r: R) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('summer: sunny look, own soundscape, picker', async ({ page }) => {
  test.setTimeout(300_000);
  try {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'summer', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
    });
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1200);
    for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }

    expect((await cozy(page, 'village()')).theme).toBe('summer');
    expect((await cozy(page, 'state')).soundscape).toBe('summer');
    let c = await cozy(page, 'christmas()');
    expect(c.petal).toBe('petal');
    expect(c.frosted).toBe(0);
    expect(c.snowTufts).toBe(0);
    expect(c.snowmen.length).toBe(0);
    expect(c.presents.length).toBe(0);

    await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${SHOTS}/summer.png` });

    // HUD picker: tap the theme button, the other five fan out; Winter switches live and back.
    let h = await cozy(page, 'themeHud()');
    expect(h.current).toBe('summer');
    await tapRect(page, h.rects.btn);
    await expect.poll(async () => (await cozy(page, 'themeHud()')).open, { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(600);
    h = await cozy(page, 'themeHud()');
    expect(Object.keys(h.rects).filter((k) => k !== 'btn').sort()).toEqual(['christmas', 'fall', 'halloween', 'spring', 'winter']);
    await page.screenshot({ path: `${SHOTS}/summer-picker.png` });
    await tapRect(page, h.rects.btn);
    await expect.poll(async () => (await cozy(page, 'themeHud()')).open, { timeout: 10_000 }).toBe(false);
    await cozy(page, "setTheme('winter')");
    await page.waitForTimeout(1200);
    expect((await cozy(page, 'state')).soundscape).toBe('winter');
    expect((await cozy(page, 'christmas()')).frosted).toBeGreaterThan(10);
    await cozy(page, "setTheme('summer')");
    await page.waitForTimeout(1200);
    c = await cozy(page, 'christmas()');
    expect(c.frosted).toBe(0);
    expect(c.snowmen.length).toBe(0);
    expect((await cozy(page, 'state')).soundscape).toBe('summer');

    // The menu has all six theme buttons, clear of the tabs and inside the panel.
    const bag = await page.evaluate(() => { const u = (window as any).__game.scene.getScene('ui'); return { x: u.bagC.x, y: u.bagC.y }; });
    await page.touchscreen.tap(bag.x, bag.y);
    await expect.poll(() => page.evaluate(() => (window as any).__menu?.open), { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(800);
    const rects = await page.evaluate(() => (window as any).__menu.rects);
    for (const id of ['spring', 'summer', 'fall', 'halloween', 'christmas', 'winter']) expect(rects[`theme:${id}`]).toBeTruthy();
    const tabs = Object.keys(rects).filter((k) => k.startsWith('tab:')).map((k) => rects[k] as R);
    const lastTab = tabs.reduce((a, b) => (a.x > b.x ? a : b));
    expect(lastTab.x + lastTab.w).toBeLessThanOrEqual(rects['theme:spring'].x + 1);
    expect(rects['theme:winter'].x + rects['theme:winter'].w).toBeLessThanOrEqual(rects.close.x + 1);
    await page.screenshot({ path: `${SHOTS}/summer-menu.png` });
    await tapRect(page, rects.close);
    await expect.poll(() => page.evaluate(() => (window as any).__menu?.open), { timeout: 10_000 }).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});
