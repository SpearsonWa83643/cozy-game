import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 11.95: seasonal props far outside the camera view are not drawn (cameraFilter, so `visible` and taps
// are untouched) and their per-frame animation is skipped. Theme change / moving the camera re-checks.
const FILE = pathToFileURL(resolve(process.env.COZY_SINGLE ?? 'dist-single/index.html')).href;
const SHOTS = process.env.CULL_SHOTS ?? '/workspace/cozy-game/screenshots';
const perf = (page: Page) => page.evaluate(() => (window as any).__cozy.seasonPerf()) as Promise<any>;
/** Props the camera skips that are on screen (should be none), and filtered props that lost `visible` (none). */
const audit = (page: Page) => page.evaluate(() => {
  const w = (window as any).__game.scene.getScene('world'); const d = w.dresser; const cam = w.cameras.main; const v = cam.worldView;
  const lists = [d.props, d.fallProps, d.summerProps, d.xmasProps, d.snowmen, d.snowballs];
  let onScreenFiltered = 0, filtered = 0, filteredHidden = 0;
  const seen = new Set();
  for (const l of lists) for (const img of l) {
    if (seen.has(img)) continue; seen.add(img);
    if (!(img.cameraFilter & cam.id)) continue;
    filtered++;
    if (!img.visible) filteredHidden++;
    if (v.contains(img.x, img.y - img.displayHeight * 0.5)) onScreenFiltered++;
  }
  return { onScreenFiltered, filtered, filteredHidden };
});

test('off-screen seasonal props are culled and skip animation', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.text().startsWith('[cull]')) console.log(m.text()); });
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'halloween', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: ['pantry', 'build', 'village', 'jobs'] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);

  // Halloween has the most seasonal props: most are off screen.
  let p = await perf(page);
  expect(p.cullOn).toBe(true);
  expect(p.props).toBeGreaterThan(20);
  expect(p.culled).toBeGreaterThan(p.props / 3);
  expect(p.culled).toBeLessThan(p.props);
  expect(p.skipped).toBeGreaterThan(0);
  let a = await audit(page);
  expect(a.onScreenFiltered).toBe(0);
  expect(a.filteredHidden).toBe(0);
  expect(a.filtered).toBe(p.culled);
  await page.screenshot({ path: `${SHOTS}/cull-halloween.png` });

  // Headless measurement: the dresser's per-frame work with culling on vs off.
  const off = await page.evaluate(() => (window as any).__cozy.seasonBench(400, false));
  const on = await page.evaluate(() => (window as any).__cozy.seasonBench(400, true));
  await page.evaluate(([a, b]) => console.log(`[cull] dresser update ms: off ${a.toFixed(4)} on ${b.toFixed(4)}`), [off, on]);
  expect(on).toBeLessThan(off * 1.25 + 0.02);

  // Turning culling off draws everything again; on again re-culls.
  await page.evaluate(() => (window as any).__cozy.seasonCull(false));
  await expect.poll(() => perf(page).then((q) => q.culled)).toBe(0);
  expect((await audit(page)).filtered).toBe(0);
  await page.evaluate(() => (window as any).__cozy.seasonCull(true));
  await expect.poll(() => perf(page).then((q) => q.culled)).toBeGreaterThan(0);

  // Moving the camera somewhere else re-checks: what is on screen there is drawn.
  const before = await audit(page);
  await page.evaluate(() => (window as any).__cozy.teleport(470, 1820));
  await page.waitForTimeout(1500);
  a = await audit(page);
  expect(a.onScreenFiltered).toBe(0);
  expect(a.filteredHidden).toBe(0);
  expect(before.filtered).toBeGreaterThan(0);
  await page.screenshot({ path: `${SHOTS}/cull-halloween-village.png` });

  // Other themes cull their own props; Spring has none and leaves nothing filtered.
  for (const id of ['christmas', 'winter', 'fall', 'summer']) {
    await page.evaluate((t) => (window as any).__cozy.setTheme(t), id);
    await page.waitForTimeout(800);
    p = await perf(page);
    expect(p.props, id).toBeGreaterThan(0);
    a = await audit(page);
    expect(a.onScreenFiltered, id).toBe(0);
    expect(a.filtered, id).toBe(p.culled);
  }
  await page.evaluate(() => (window as any).__cozy.setTheme('spring'));
  await page.waitForTimeout(800);
  p = await perf(page);
  expect(p.props).toBe(0);
  expect((await audit(page)).filtered).toBe(0);
  expect(errors).toEqual([]);
});
