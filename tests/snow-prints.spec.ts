import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 29: footprints in the snow (Winter / Christmas) that slowly fade; none in the green themes.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('snow prints: walking in winter leaves fading prints, none in spring', async ({ page }) => {
  test.setTimeout(480_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'winter', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
  expect((await cozy(page, 'prints()')).snowy).toBe(true);

  const walk = async (dx: number, during?: () => Promise<void>) => {
    const s = await cozy(page, 'state');
    const p = await cozy(page, `worldToScreen(${s.x + dx}, ${s.y})`);
    await page.touchscreen.tap(p.x, p.y);
    if (during) await during();
    await expect.poll(async () => { const t = await cozy(page, 'state'); return Math.abs(t.x - (s.x + dx)); }, { timeout: 90_000 }).toBeLessThan(30);
  };
  await cozy(page, 'teleport(700, 1000)');
  await page.waitForTimeout(600);
  await walk(220, async () => {
    await expect.poll(() => cozy(page, 'prints()').then((p) => p.made), { timeout: 60_000, intervals: [100] }).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: 'screenshots/snow-prints.png' });
  });
  const a = await cozy(page, 'prints()');
  expect(a.made).toBeGreaterThanOrEqual(3);
  expect(a.visible).toBeGreaterThan(0);
  expect(a.pool).toBeLessThanOrEqual(48);

  // They fade away on their own.
  await expect.poll(() => cozy(page, 'prints()').then((p) => p.visible), { timeout: 120_000 }).toBe(0);

  // Spring: no prints.
  await cozy(page, `setTheme('spring')`);
  await page.waitForTimeout(500);
  const before = (await cozy(page, 'prints()')).made;
  await cozy(page, 'teleport(700, 1000)');
  await page.waitForTimeout(600);
  await walk(220);
  const b = await cozy(page, 'prints()');
  expect(b.snowy).toBe(false);
  expect(b.made).toBe(before);
  expect(b.visible).toBe(0);
  expect(errors).toEqual([]);
});
