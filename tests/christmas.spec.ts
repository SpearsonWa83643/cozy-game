import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Christmas theme preview (slice 1): snowy ground, frosted trees, falling snowflakes and its own
// 'christmas' soundscape. Switching back to Spring restores Spring's look and sound.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.XMAS_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('christmas: snowy look, frosted trees, snowflakes, own soundscape', async ({ page }) => {
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

    // A saved 'christmas' theme loads as Christmas, with its own soundscape and snow emitter.
    expect((await cozy(page, 'village()')).theme).toBe('christmas');
    expect((await cozy(page, 'state')).soundscape).toBe('christmas');
    const c = await cozy(page, 'christmas()');
    expect(c.petal).toBe('p_snow');
    expect(c.frosted).toBeGreaterThan(10);
    expect(c.caps).toBeGreaterThan(10);

    const tp = (x: number, y: number) => page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y]);
    await tp(905, 1330);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${SHOTS}/christmas-preview-01.png` });
    await tp(1310, 1090);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${SHOTS}/christmas-preview-02.png` });

    // Back to Spring and again to Christmas: look and sound follow live.
    await cozy(page, "setTheme('spring')");
    await page.waitForTimeout(1200);
    expect((await cozy(page, 'state')).soundscape).toBe('spring');
    expect((await cozy(page, 'christmas()')).frosted).toBe(0);
    expect((await cozy(page, 'christmas()')).caps).toBe(0);
    await cozy(page, "setTheme('christmas')");
    await page.waitForTimeout(1200);
    expect((await cozy(page, 'state')).soundscape).toBe('christmas');
    expect((await cozy(page, 'christmas()')).frosted).toBeGreaterThan(10);
    expect((await cozy(page, 'christmas()')).petal).toBe('p_snow');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});
