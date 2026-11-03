import { test, expect, chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 63 (dev preview): the applied Looks & Moves art style restyles the whole screen with a per-style post-process.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.STYLE_SHOTS ?? resolve('screenshots');
const STYLES: [string, number][] = [['classic', 0], ['cel', 1], ['watercolor', 2], ['ink', 3], ['pixel', 4], ['gouache', 5], ['clay', 6]];

test('whole-game style: each applied art style restyles the glade', async ({ playwright: _pw }, info) => {
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
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as any).__screenStyle.attached)).toContain('world');
    for (const [id, mode] of STYLES) {
      await page.evaluate((id) => (window as any).__cozy.setLookArt(id), id);
      await page.waitForTimeout(900);
      expect(await page.evaluate(() => (window as any).__screenStyle.mode), id).toBe(mode);
      await page.screenshot({ path: `${SHOTS}/style-glade-${id}.png`, scale: 'css' });
    }
    // Saved: a reload keeps the applied look.
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => (window as any).__screenStyle.mode)).toBe(6);
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
