import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 33: garden pinwheels spin in the breeze; tap one (or walk past) for a fast whirl that settles.
// Faster on windy Fall days; hidden in the snowy themes.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

test('pinwheels: spin, whirl on tap and walk-past, windier in wind, hidden in snow', async ({ page }) => {
  test.setTimeout(480_000);
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

  const pw = await cozy(page, 'pinwheels()');
  expect(pw.list.length).toBeGreaterThanOrEqual(4);
  expect(pw.list.every((q: any) => q.visible && q.spin > 0.5 && q.boost === 0)).toBe(true);
  const base = pw.list[0].spin;

  // Stand next to one (not on it), then tap it: it whirls, the hero stays put.
  const p0 = pw.list[0];
  await cozy(page, `teleport(${p0.x + 110}, ${p0.y + 20})`);
  await page.waitForTimeout(800);
  const s = await cozy(page, 'state');
  const sp = await cozy(page, `worldToScreen(${p0.hx}, ${p0.hy})`);
  await page.touchscreen.tap(sp.x, sp.y);
  await expect.poll(() => cozy(page, 'pinwheels()').then((q) => q.taps), { timeout: 30_000, intervals: [50] }).toBe(1);
  expect((await cozy(page, 'pinwheels()')).list[0].boost).toBeGreaterThan(6);
  await expect.poll(() => cozy(page, 'pinwheels()').then((q) => q.list[0].spin), { timeout: 10_000, intervals: [50] }).toBeGreaterThan(base + 5);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'screenshots/pinwheels.png' });
  const s2 = await cozy(page, 'state');
  expect(Math.hypot(s2.x - s.x, s2.y - s.y)).toBeLessThan(4);
  // ...and slowly settles back to the breeze.
  await expect.poll(() => cozy(page, 'pinwheels()').then((q) => q.list[0].boost), { timeout: 90_000 }).toBe(0);

  // Walking right past gives it a whoosh.
  let whooshed = false;
  for (const q of pw.list.slice(1)) {
    for (const dy of [25, -25, 40]) {
      await cozy(page, `teleport(${q.x - 100}, ${q.y + dy})`);
      await page.waitForTimeout(500);
      const st = await cozy(page, 'state');
      if (Math.hypot(st.x - (q.x - 100), st.y - (q.y + dy)) > 10) continue;
      const before = (await cozy(page, 'pinwheels()')).whooshes;
      const t = await cozy(page, `worldToScreen(${q.x + 100}, ${q.y + dy})`);
      await page.touchscreen.tap(t.x, t.y);
      try {
        await expect.poll(() => cozy(page, 'pinwheels()').then((r) => r.whooshes), { timeout: 40_000, intervals: [50] }).toBeGreaterThan(before);
        whooshed = true;
        break;
      } catch { /* blocked; try another */ }
    }
    if (whooshed) break;
  }
  expect(whooshed).toBe(true);

  // Windy Fall day: everything spins faster.
  await cozy(page, `setTheme('fall')`); await page.waitForTimeout(500);
  await cozy(page, `villageEvent('rain')`);
  await expect.poll(() => cozy(page, 'pinwheels()').then((q) => q.windy), { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => {
    const calm = (await cozy(page, 'pinwheels()')).list.filter((q: any) => q.boost === 0);
    return calm.length > 0 && calm.every((q: any) => q.spin > 4);
  }, { timeout: 10_000, intervals: [100] }).toBe(true);
  await cozy(page, 'weatherLeft(0.3)');
  await page.waitForTimeout(1500);

  // Snowy looks: no pinwheels; back again after.
  await cozy(page, `setTheme('winter')`); await page.waitForTimeout(500);
  expect((await cozy(page, 'pinwheels()')).list.every((q: any) => !q.visible)).toBe(true);
  await cozy(page, `setTheme('summer')`); await page.waitForTimeout(500);
  expect((await cozy(page, 'pinwheels()')).list.every((q: any) => q.visible)).toBe(true);
  expect(errors).toEqual([]);
});
