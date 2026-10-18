import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Fall theme preview: warm autumn trees, drifting maple leaves, its own 'fall' soundscape and
// the Canada Goose as Fall's default mount. Switching back to Spring restores Spring's look/sound.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.FALL_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const mount = (page: Page) => cozy(page, 'mount()');
const tapRect = async (page: Page, k: string) => {
  const r = await page.evaluate((k) => (window as any).__vui.rects[k], k);
  await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
};

test('fall: autumn trees, maple leaves, own soundscape, goose default mount', async ({ page }) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'fall', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }

  // A saved 'fall' theme loads as Fall, with its own soundscape and leaf emitter.
  expect((await cozy(page, 'village()')).theme).toBe('fall');
  expect((await cozy(page, 'state')).soundscape).toBe('fall');
  const f = await cozy(page, 'fall()');
  expect(f.petal).toBe('p_maple');
  expect(f.autumn).toBeGreaterThan(10);

  // Preview shots: the glade meadow and the pond.
  const tp = (x: number, y: number) => page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y]);
  await tp(905, 1330);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SHOTS}/fall-preview-01.png` });
  await tp(1310, 1090);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SHOTS}/fall-preview-02.png` });

  // Call Mount in Fall brings the Canada Goose straight away (no picker), and you ride it.
  await tp(1500, 1500);
  await page.waitForTimeout(1500);
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('world').mount.canCall()), { timeout: 60_000, intervals: [300] }).toBe(true);
  await tapRect(page, 'mount');
  await expect.poll(async () => (await mount(page)).id, { timeout: 10_000, intervals: [100] }).toBe('goose');
  expect(await page.evaluate(() => !!(window as any).__vui.mountPicker)).toBe(false);
  await expect.poll(async () => (await mount(page)).phase, { timeout: 90_000, intervals: [200] }).toBe('ride');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/fall-goose-ride.png` });
  await page.evaluate(() => { const m = (window as any).__cozy.mount(); (window as any).__cozy.mountTap(m.ground[0] + 120, m.ground[1] + 80); });
  await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [300] }).toBe('off');

  // Back to Spring: Spring's soundscape and no autumn tints left.
  await cozy(page, "setTheme('spring')");
  await page.waitForTimeout(1200);
  expect((await cozy(page, 'state')).soundscape).toBe('spring');
  expect((await cozy(page, 'fall()')).autumn).toBe(0);
  await cozy(page, "setTheme('fall')");
  await page.waitForTimeout(1200);
  expect((await cozy(page, 'state')).soundscape).toBe('fall');
  expect((await cozy(page, 'fall()')).autumn).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});
