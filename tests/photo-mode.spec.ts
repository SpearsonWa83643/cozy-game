import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 23: camera button -> HUD hides for the grab -> polaroid preview -> Save (local download) / Close.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const ui = (page: Page, expr: string) => page.evaluate(`(() => { const u = window.__game.scene.getScene('ui'); return ${expr}; })()`) as Promise<any>;

test('photo mode: snapshot, preview, save download, close', async ({ page }) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await page.evaluate(() => (window as any).__cozy.state.dialogOpen)); i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }

  // Tap the camera button.
  const pos = await ui(page, '({ x: u.camC.x, y: u.camC.y })');
  const before = await page.evaluate(() => (window as any).__cozy.state);
  await page.touchscreen.tap(pos.x, pos.y);
  await page.waitForFunction(() => (window as any).__game.scene.getScene('ui').photo.open, null, { timeout: 15_000 });
  await page.waitForTimeout(600);
  // HUD is back after the grab, and the picture has real pixels.
  expect(await page.evaluate(() => (window as any).__game.scene.isVisible('ui'))).toBe(true);
  const size = await ui(page, "(() => { const k = u.photo.key; const t = u.textures.get(k).getSourceImage(); return { w: t.width, h: t.height }; })()");
  expect(size.w).toBeGreaterThan(300);
  await page.screenshot({ path: 'screenshots/photo-mode.png' });
  // The hero didn't walk off while the preview was up.
  const mid = await page.evaluate(() => (window as any).__cozy.state);
  expect(Math.abs(mid.x - before.x) + Math.abs(mid.y - before.y)).toBeLessThan(6);

  // Save = a local .png download.
  const rs = await ui(page, 'u.photo.rects');
  const dl = page.waitForEvent('download', { timeout: 15_000 });
  await page.touchscreen.tap(rs.save.x + rs.save.w / 2, rs.save.y + rs.save.h / 2);
  const d = await dl;
  expect(d.suggestedFilename()).toMatch(/^willowmere-glade-\d{8}-\d{6}\.png$/);
  expect(await ui(page, 'u.photo.saved')).toBe(1);

  // Close.
  await page.touchscreen.tap(rs.close.x + rs.close.w / 2, rs.close.y + rs.close.h / 2);
  await page.waitForTimeout(500);
  expect(await ui(page, 'u.photo.open')).toBe(false);
  expect(errors).toEqual([]);
});
