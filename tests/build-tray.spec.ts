import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 12.7 Build mode: zooms all the way out to the whole village, the build choices are a thin collapsible bar that
// never covers the buildable area, taps on it never place anything, and place / move / remove still work.
const FILE = pathToFileURL(resolve(process.env.COZY_SINGLE ?? 'dist-single/index.html')).href;
const SHOTS = process.env.BUILD_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const village = (page: Page) => cozy(page, 'village()');
const vui = (page: Page, id: string) => page.evaluate((id) => (window as any).__vui.rects[id], id);
const tap = (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
const tapId = async (page: Page, id: string) => {
  await expect.poll(() => vui(page, id), { timeout: 60_000, intervals: [250] }).toBeTruthy();
  await tap(page, await vui(page, id));
};
const tapWorld = async (page: Page, x: number, y: number) => {
  const p = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [x, y]) as { x: number; y: number };
  await page.touchscreen.tap(p.x, p.y);
};
const zoom = async (page: Page) => (await cozy(page, 'heroScreen()')).zoom as number;

test('build mode: zoomed out, thin tray, place / move / remove, restores the view', async ({ page }) => {
  test.setTimeout(500_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({
      v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: ['pantry', 'build', 'village', 'jobs', 'nearbed'],
      village: { res: { food: 20, wood: 30, stone: 30 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 0 }], villagers: [], nextId: 6, wanderer: 0, events: 0 },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.evaluate(() => (window as any).__cozy.teleport(470, 1820));
  await page.waitForTimeout(3000);
  
  await page.evaluate(() => (window as any).__cozy.teleport(560, 1975)); // out of the village cells
  await page.waitForTimeout(2500);
  const z0 = await zoom(page);
  await tapId(page, 'build');
  await expect.poll(async () => (await village(page)).building, { timeout: 30_000 }).toBe(true);
  await expect.poll(() => zoom(page), { timeout: 60_000, intervals: [500] }).toBeLessThan(z0 * 0.95);
  await expect.poll(() => vui(page, 'tray:bar'), { timeout: 30_000 }).toBeTruthy();
  await page.waitForTimeout(2500); // let the zoom/pan settle at low fps

  // Tray is thin (<20% of the screen) and the whole village sits above it, on screen.
  const vp = page.viewportSize()!;
  const bar = await vui(page, 'tray:bar');
  expect((bar.w * bar.h) / (vp.width * vp.height)).toBeLessThan(0.2);
  expect(bar.h).toBeLessThanOrEqual(110);
  const tl = await page.evaluate(() => (window as any).__cozy.worldToScreen(130, 1600));
  const br = await page.evaluate(() => (window as any).__cozy.worldToScreen(130 + 11 * 64, 1600 + 5 * 64));
  console.log('viewport', vp, 'bar', bar, 'village', tl, br, 'zoom', z0, '->', await zoom(page));
  expect(tl.x).toBeGreaterThanOrEqual(0); expect(tl.y).toBeGreaterThanOrEqual(0);
  expect(br.x).toBeLessThanOrEqual(vp.width); expect(br.y).toBeLessThanOrEqual(bar.y);
  for (const id of ['tray:home', 'tray:garden']) { const r = await vui(page, id); expect(r.w).toBeGreaterThanOrEqual(44); expect(r.h).toBeGreaterThanOrEqual(44); }
  await page.screenshot({ path: `${SHOTS}/build-mode-v2.png` });

  // Place a garden; a tap on the empty part of the tray must not move the ghost or place anything.
  await tapId(page, 'tray:garden');
  await expect.poll(async () => (await village(page)).ghost, { timeout: 30_000 }).toBeTruthy();
  const [cx, cy] = await cozy(page, 'villageCell(5, 2)');
  await tapWorld(page, cx, cy);
  await expect.poll(async () => (await village(page)).ghost?.gx, { timeout: 30_000 }).toBe(4);
  await page.touchscreen.tap(bar.x + 14, bar.y + bar.h - 5);
  await page.waitForTimeout(800);
  const g1 = await village(page);
  expect(g1.buildings.length).toBe(1); expect(g1.ghost.gx).toBe(4);
  await tapWorld(page, g1.ghost.check[0], g1.ghost.check[1]);
  await expect.poll(async () => (await village(page)).buildings.length, { timeout: 30_000 }).toBe(2);

  // Move it (tap a building in build mode picks it up).
  const gardenAt = async () => (await village(page)).buildings.find((b: any) => b.type === 'garden');
  let gb = await gardenAt();
  await tapWorld(page, gb.x, gb.y);
  const [mx, my] = await cozy(page, 'villageCell(8, 3)');
  await expect.poll(async () => (await village(page)).moving, { timeout: 30_000 }).not.toBeNull();
  await tapWorld(page, mx, my);
  await expect.poll(async () => (await village(page)).ghost?.gx, { timeout: 30_000 }).toBe(7);
  const g2 = await village(page);
  await tapWorld(page, g2.ghost.check[0], g2.ghost.check[1]);
  await expect.poll(async () => (await gardenAt())?.gx, { timeout: 30_000 }).toBe(7);
  // Collapse and expand the tray.
  await page.waitForTimeout(1500); // let the tray rebuild after the move settle
  await tapId(page, 'tray:toggle');
  await expect.poll(() => vui(page, 'tray:bar'), { timeout: 15_000 }).toBeFalsy();
  await tapId(page, 'tray:toggle');
  await expect.poll(() => vui(page, 'tray:bar'), { timeout: 15_000 }).toBeTruthy();

  // Done: zoom and follow come back.
  await tapId(page, 'build');
  await expect.poll(async () => (await village(page)).building, { timeout: 30_000 }).toBe(false);
  await expect.poll(() => zoom(page), { timeout: 60_000, intervals: [500] }).toBeGreaterThan(z0 * 0.97);
  expect(Math.abs((await zoom(page)) - z0) / z0).toBeLessThan(0.05);
  await expect.poll(async () => { const h = await cozy(page, 'heroScreen()'); return Math.hypot(h.x - h.cx, h.y - h.cy); }, { timeout: 60_000, intervals: [500] }).toBeLessThan(4);
  // Remove (building card, outside build mode) still works.
  await page.waitForTimeout(1500);
  gb = await gardenAt();
  await tapWorld(page, gb.x, gb.y);
  await tapId(page, 'card:remove');
  await page.waitForTimeout(500);
  await tapId(page, 'card:remove'); // "Sure?"
  await expect.poll(async () => (await village(page)).buildings.length, { timeout: 30_000 }).toBe(1);
  expect(errors).toEqual([]);
});
