import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 37: every friend on one stable page (no paging/scrolling); seasonal friends are shown (no ???);
// riding a seasonal friend switches the game to its season.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.MP_SHOTS ?? '/workspace/cozy-game/screenshots';
const SEASONAL: Record<string, string> = { flamingo: 'summer', goose: 'fall', pumpkin: 'halloween', reindeer: 'christmas', snowy_owl: 'winter' };
const rect = (page: Page, k: string) => page.evaluate((k) => (window as any).__menu.rects[k], k);
const tapRect = async (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('mounts page: one page, seasonal shown, riding brings the season', async ({ playwright: _pw }, info) => {
  test.setTimeout(900_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
    });
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
    await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
    await page.evaluate(() => (window as any).__menu.show('stable'));
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(1200);
    const pets = await page.evaluate(() => (window as any).__menu.stablePets.map((p: any) => [p.id, p.on]));
    expect(pets.length).toBe(22);
    // Every stall fits on screen at once: no paging, no scrolling.
    const vp = page.viewportSize()!;
    for (const [id] of pets) {
      const r = await rect(page, `stall:${id}`);
      expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(vp.width); expect(r.y + r.h).toBeLessThanOrEqual(vp.height);
    }
    // Seasonal friends are shown in full colour with their names.
    for (const id of Object.keys(SEASONAL)) expect(pets.find((p: any) => p[0] === id)?.[1], `${id} shown`).toBe(true);
    expect(await page.evaluate(() => (window as any).__menu.badges)).toEqual(SEASONAL);
    await page.screenshot({ path: `${SHOTS}/mounts-page.png`, scale: 'css' });
    // Tap the Reindeer: it says riding brings Christmas; Ride! switches the theme and flies it in.
    await tapRect(page, await rect(page, 'stall:reindeer'));
    await expect.poll(() => page.evaluate(() => (window as any).__menu.hintText?.text ?? ''), { timeout: 20_000 }).toContain('Christmas');
    await expect.poll(() => page.evaluate(() => !!(window as any).__menu.rects['ride:reindeer']), { timeout: 20_000 }).toBe(true);
    await page.waitForTimeout(400);
    await tapRect(page, await rect(page, 'ride:reindeer'));
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 20_000 }).toBe(false);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2')!).theme), { timeout: 20_000 }).toBe('christmas');
    await expect.poll(() => page.evaluate(() => (window as any).__cozy.mount().phase), { timeout: 30_000 }).not.toBe('off');
    expect(await page.evaluate(() => (window as any).__game.scene.getScene('world').mount.def.id)).toBe('reindeer');
    expect(await page.evaluate(() => (window as any).__cozy.mount().seasonSwaps)).toBe(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2')!).mountPick)).toBe('reindeer');
    await expect.poll(() => page.evaluate(() => (window as any).__cozy.mount().phase), { timeout: 120_000, intervals: [300] }).toBe('ride');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/mounts-page-reindeer.png`, scale: 'css' });
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
