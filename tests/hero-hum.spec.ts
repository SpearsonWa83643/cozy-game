import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 27: stand still for a while and your hero hums: little music notes float up; walking stops it.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('hero hum: notes float up when idle, stop when walking', async ({ page }) => {
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
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
  await cozy(page, 'teleport(470, 1820)');
  await page.waitForTimeout(400);

  // Not humming right away.
  const h0 = await cozy(page, 'hum()');
  expect(h0.humming).toBe(false);
  expect(h0.notes).toBe(0);

  // After the idle wait (skipped here), notes float up one after another.
  await cozy(page, 'humNow()');
  await expect.poll(() => cozy(page, 'hum()').then((h) => h.notes), { timeout: 60_000, intervals: [100] }).toBeGreaterThanOrEqual(2);
  expect((await cozy(page, 'hum()')).live).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/hero-hum.png' });

  // Walk away (real touch tap): the hum stops and the notes fade out.
  const s0 = await cozy(page, 'state');
  const far = await cozy(page, `worldToScreen(${s0.x + 200}, ${s0.y})`);
  await page.touchscreen.tap(far.x, far.y);
  await expect.poll(() => cozy(page, 'hum()').then((h) => h.humming), { timeout: 30_000, intervals: [100] }).toBe(false);
  const n1 = (await cozy(page, 'hum()')).notes;
  await expect.poll(() => cozy(page, 'hum()').then((h) => h.live), { timeout: 90_000 }).toBe(0);
  // While walking, no new notes.
  expect((await cozy(page, 'hum()')).notes).toBeLessThanOrEqual(n1 + 1);
  expect(errors).toEqual([]);
});
