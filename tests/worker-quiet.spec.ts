import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 58 (Walker, Nov 2): no "ding" bell when village workers deliver resources. The +N pop stays.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;

test('worker deliveries are quiet (no ding), resources still arrive', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({
      v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [],
      village: { res: { food: 5, wood: 8, stone: 4 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 1 }, { id: 2, type: 'garden', gx: 4, gy: 1 }, { id: 3, type: 'workshop', gx: 7, gy: 1 }],
        villagers: [{ id: 4, name: 'Bea', trait: 'Loves flowers', kind: 0, job: 2, food: 1, sleep: 1, fun: 1 }, { id: 5, name: 'Tom', trait: 'Loves flowers', kind: 1, job: 3, food: 1, sleep: 1, fun: 1 }], nextId: 6, wanderer: 0, events: 0 },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const c = (window as any).__cozy; c.villageCalm?.(); c.teleport(480, 1830); });
  // Count every bell-ish sound from now on.
  await page.evaluate(() => {
    const s = (window as any).__sfx, log: string[] = ((window as any).__sfxLog = []);
    for (const k of ['pickup', 'bell', 'bellNote', 'ting', 'chimes', 'sparkle', 'themeChime']) {
      const f = s[k]; if (typeof f !== 'function') continue;
      s[k] = function (...a: unknown[]) { log.push(k); return f.apply(this, a); };
    }
  });
  const p0 = (await page.evaluate(() => (window as any).__cozy.village())).produced;
  await page.evaluate(() => (window as any).__cozy.villageSpeed(12));
  await expect.poll(async () => (await page.evaluate(() => (window as any).__cozy.village())).produced, { timeout: 300_000, intervals: [1000] }).toBeGreaterThanOrEqual(p0 + 3);
  const log: string[] = await page.evaluate(() => (window as any).__sfxLog);
  expect(log.filter((k) => k === 'pickup' || k === 'ting' || k === 'bellNote' || k === 'chimes')).toEqual([]);
  expect(errors).toEqual([]);
});
