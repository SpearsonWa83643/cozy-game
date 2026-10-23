import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// One-time "What's new" note. Forced on with ?whatsnew=1 (webdriver skips it otherwise).
const BASE = pathToFileURL(resolve('dist-single/index.html')).href;
const ready = (page: Page) => page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
const wn = (page: Page) => page.evaluate(() => (window as any).__whatsnew as { open: boolean; shown: number; version: string } | undefined);

test("what's new: after entry, shows once, closes, stays closed; none when empty", async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // 1) New player: entry screen first, note only after it closes.
  await page.goto(BASE + '?entry=1&whatsnew=1');
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await ready(page);
  await page.waitForSelector('#entry .e-skip', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('#whatsnew')).toHaveCount(0);
  await page.locator('#entry .e-skip').tap();
  await page.waitForSelector('#whatsnew .w-ok', { timeout: 10_000 });
  await expect(page.locator('#entry')).toHaveCount(0);
  await expect(page.locator('#whatsnew h2')).toContainText("What's new");
  await expect(page.locator('#whatsnew li')).toHaveCount(4);
  await expect(page.locator('#whatsnew li').first()).toContainText('fish tank');
  await expect(page.locator('#whatsnew li').nth(1)).toContainText('treasure cabinet');
  await expect(page.locator('#whatsnew li').nth(2)).toContainText('paper map');
  await expect(page.locator('#whatsnew li').nth(3)).toContainText('brand-new wardrobe');
  const ok = await page.locator('#whatsnew .w-ok').boundingBox();
  expect(ok!.height).toBeGreaterThanOrEqual(70);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/whatsnew-fall.png' });

  // Taps on the note must not reach game buttons underneath.
  await page.locator('#whatsnew li').first().tap();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => ({ vol: localStorage.getItem('cozy.vol'), menu: !!(window as any).__menu?.open }))).toEqual({ vol: null, menu: false });

  // Close with the big button: gone from the page, version remembered.
  await page.locator('#whatsnew .w-ok').tap();
  await expect.poll(() => wn(page).then((w) => w?.open), { timeout: 5_000 }).toBe(false);
  await expect(page.locator('#whatsnew')).toHaveCount(0, { timeout: 5_000 });
  const v = await page.evaluate(() => localStorage.getItem('cozy.whatsnew.seen'));
  expect(v).toBe((await wn(page))!.version);
  // Nothing left covering the game.
  const top = await page.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return e?.tagName; });
  expect(top).toBe('CANVAS');

  // 2) Reload (returning player, no entry screen): does not show again.
  await page.goto(BASE + '?whatsnew=1');
  await ready(page);
  await page.waitForTimeout(2500);
  await expect(page.locator('#whatsnew')).toHaveCount(0);
  expect((await wn(page))?.shown).toBe(0);

  // 3) Returning player who has not seen this version: shows right away (no entry screen).
  await page.evaluate(() => localStorage.removeItem('cozy.whatsnew.seen'));
  await page.goto(BASE + '?whatsnew=1');
  await ready(page);
  await page.waitForSelector('#whatsnew .w-ok', { timeout: 10_000 });
  // Tapping the dim area outside the card also closes it.
  await page.touchscreen.tap(20, 20);
  await expect(page.locator('#whatsnew')).toHaveCount(0, { timeout: 5_000 });

  // 4) No bullets: no note at all.
  await page.evaluate(() => localStorage.removeItem('cozy.whatsnew.seen'));
  await page.goto(BASE + '?whatsnew=empty');
  await ready(page);
  await page.waitForTimeout(2500);
  await expect(page.locator('#whatsnew')).toHaveCount(0);
  expect((await wn(page))?.shown).toBe(0);

  expect(errors).toEqual([]);
});
