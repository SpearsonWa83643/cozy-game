import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// The Wild Woods on iPad: trailhead, seeded generation, theme, Home button, exit portal.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const state = (page: Page) => cozy(page, 'state');
const wild = (page: Page) => cozy(page, 'wild()');
async function closeDialogs(page: Page) {
  for (let i = 0; i < 14 && (await state(page)).dialogOpen; i++) { await page.touchscreen.tap(590, 650); await page.waitForTimeout(700); }
}
const wildRect = (page: Page, k: string) => page.evaluate((k) => (window as any).__game.scene.getScene('wildui').rects[k], k);
const tapRect = async (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('wild woods: enter, seeded generation, theme, home, portal', async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);
  await closeDialogs(page);

  // 1. Walk up to the trailhead and tap it.
  await page.evaluate(() => (window as any).__cozy.teleport(4080, 2800));
  await page.waitForTimeout(2000);
  await closeDialogs(page);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v8-00-trailhead.png` });
  for (let i = 0; i < 4 && !(await wild(page)).on && !(await wild(page)).inWild; i++) {
    const p = await page.evaluate(() => (window as any).__cozy.worldToScreen(4080, 2680));
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(2500);
    await closeDialogs(page);
  }
  await expect.poll(async () => (await wild(page)).on, { timeout: 60_000, intervals: [500] }).toBe(true);
  const w1 = await wild(page);
  expect(w1.props).toBeGreaterThan(80);
  expect(w1.clearings).toBeGreaterThanOrEqual(5);
  expect((await cozy(page, 'wildSave()')).visits).toBe(1);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v8-01-wild-classic.png` });

  // 2. Tap-to-walk moves you along.
  const start = w1.player;
  const tp = await page.evaluate(([x, y]) => (window as any).__cozy.wildToScreen(x, y), [start[0] + 160, start[1]]);
  await page.touchscreen.tap(tp.x, tp.y);
  await expect.poll(async () => (await wild(page)).player[0], { timeout: 30_000 }).toBeGreaterThan(start[0] + 60);

  // 3. Theme toggles live; stand near a spooky-cute monster for the picture.
  await cozy(page, "setTheme('halloween')");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v8-02-wild-halloween.png` });
  { // Particles in the Wild Woods (Halloween) never draw tree art or a frame from another atlas.
    const ps: any[] = await cozy(page, 'particleFrames()');
    expect(ps.filter((p) => /^(h_)?tree|^pine|^birch|^apple|^stump/.test(p.frame) || p.frameTex !== p.tex || p.frame === '__BASE')).toEqual([]);
  }

  await cozy(page, "setTheme('classic')");

  // 5. The big Home button: back at the cottage.
  await tapRect(page, await wildRect(page, 'home'));
  await expect.poll(async () => (await wild(page)).on, { timeout: 30_000 }).toBe(false);
  await expect.poll(async () => (await state(page)).locked, { timeout: 30_000 }).toBe(false);
  await page.waitForTimeout(1500);

  // 6. Same seed, same woods; then walk out through the exit portal to the trailhead.
  await cozy(page, 'enterWild(4242)');
  await expect.poll(async () => (await wild(page)).on, { timeout: 60_000, intervals: [500] }).toBe(true);
  const a = await wild(page);
  await tapRect(page, await wildRect(page, 'home'));
  await expect.poll(async () => (await wild(page)).on, { timeout: 30_000 }).toBe(false);
  await page.waitForTimeout(1500);
  await cozy(page, 'enterWild(4242)');
  await expect.poll(async () => (await wild(page)).on, { timeout: 60_000, intervals: [500] }).toBe(true);
  const b = await wild(page);
  expect([b.props, b.ponds, b.exit]).toEqual([a.props, a.ponds, a.exit]);
  await page.evaluate(([x, y]) => (window as any).__cozy.wildTeleport(x, y + 60), b.exit);
  await page.evaluate(([x, y]) => (window as any).__cozy.wildTap(x, y - 10), b.exit);
  await expect.poll(async () => (await wild(page)).on, { timeout: 30_000 }).toBe(false);
  await expect.poll(async () => (await state(page)).locked, { timeout: 30_000 }).toBe(false);
  const fx = await page.evaluate(() => (window as any).__game.scene.getScene('world').feet.x);
  expect(Math.abs(fx - 4080)).toBeLessThan(200);

  expect(errors).toEqual([]);
});
