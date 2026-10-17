import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Spring theme (was Classic): a legacy save with theme 'classic' lands in Spring, Spring plays its
// own soundscape, and switching Halloween <-> Spring swaps soundscapes live.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.SPRING_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('spring: legacy classic save migrates to Spring with its own soundscape', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'classic', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 6 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(400); }

  expect((await cozy(page, 'village()')).theme).toBe('spring');
  expect((await cozy(page, 'state')).soundscape).toBe('spring');
  // Polish: no autumn-amber trees in Spring (tree4 -> fresh-green tree4s) and finer 5-petal blossoms.
  const sp = await cozy(page, 'spring()');
  expect(sp.frames.tree4 ?? 0).toBe(0);
  expect(sp.frames.tree4s ?? 0).toBeGreaterThan(0);
  expect(sp.blooms).toBeGreaterThan(20);
  expect(sp.bloomFrame).toBe('bloom');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SHOTS}/spring-legacy-save.png` });

  // Preview shots: the start meadow / glade and the pond, with blossoms + petals.
  const tp = (x: number, y: number) => page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y]);
  await tp(905, 1330);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SHOTS}/spring-preview-01.png` });
  await tp(1310, 1090); // pond's south shore
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SHOTS}/spring-preview-02.png` });

  await cozy(page, "setTheme('halloween')");
  await page.waitForTimeout(1000);
  expect((await cozy(page, 'state')).soundscape).toBe('halloween');
  // The legacy id still works as an alias and lands in Spring.
  await cozy(page, "setTheme('classic')");
  await page.waitForTimeout(1000);
  expect((await cozy(page, 'state')).soundscape).toBe('spring');
  expect((await cozy(page, 'village()')).theme).toBe('spring');
  // Back from Halloween, the fresh-green twin returns (Halloween swaps round trees for spooky ones).
  const sp2 = await cozy(page, 'spring()');
  expect(sp2.frames.tree4 ?? 0).toBe(0);
  expect(sp2.frames.tree4s ?? 0).toBeGreaterThan(0);
  expect(sp2.blooms).toBeGreaterThan(20);
  // Saved as 'spring' from now on.
  await page.waitForTimeout(600);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2') || '{}').theme);
  expect(stored).toBe('spring');
  expect(errors).toEqual([]);
});
