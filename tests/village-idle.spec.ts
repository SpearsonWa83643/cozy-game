import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 25: idle villagers now and then stretch, yawn or wave (tiny visual-only tween, no needs/tasks change).
const FILE = pathToFileURL(resolve(process.env.COZY_SINGLE ?? 'dist-single/index.html')).href;
const village = (page: Page) => page.evaluate(() => (window as any).__cozy.village()) as Promise<any>;
const friend = (id: number, name: string, kind: number) => ({ id, name, trait: 'Always humming', kind, job: null, food: 1, sleep: 1, fun: 1 });

test('village idle: friends fidget when calm, needs untouched', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(([a, b, c]) => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({
      v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: ['pantry', 'build', 'village', 'jobs', 'nearbed'],
      village: { res: { food: 5, wood: 0, stone: 0 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 0 }, { id: 2, type: 'home', gx: 3, gy: 0 }],
        villagers: [a, b, c], nextId: 6, wanderer: 0, events: 0 },
    }));
  }, [friend(3, 'Pip', 0), friend(4, 'Moss', 1), friend(5, 'Bun', 2)]);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const c = (window as any).__cozy; c.villageCalm(); c.teleport(470, 1820); });
  const v0 = await village(page);
  expect(v0.villagers.length).toBe(3);
  expect(v0.fidgets).toBe(0);

  // Quiet at first, then (nudged) someone stretches / yawns / waves.
  await page.evaluate(() => (window as any).__cozy.villageFidget());
  await expect.poll(() => village(page).then((v) => v.fidgets), { timeout: 60_000, intervals: [250] }).toBeGreaterThan(0);
  await expect.poll(() => village(page).then((v) => v.fidgeting), { timeout: 20_000, intervals: [50] }).toBeGreaterThan(0);
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'screenshots/village-idle.png' });
  // They settle again, and the little tween leaves the sprite at its normal scale / angle.
  await expect.poll(() => village(page).then((v) => v.fidgeting), { timeout: 30_000 }).toBe(0);
  await page.waitForTimeout(500);
  const upright = await page.evaluate(() => (window as any).__game.scene.getScene('world').village.villagers.filter((q: any) => !q.fidget && q.task === 'idle').every((q: any) => Math.abs(q.img.angle) < 0.01));
  expect(upright).toBe(true);
  // Needs untouched by fidgeting.
  for (const q of (await village(page)).villagers) expect(q.need.fun).toBeGreaterThan(0.6);
  expect(errors).toEqual([]);
});
