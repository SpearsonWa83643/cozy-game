import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Order 15: urgency colours on villager mood faces. Happy: no halo. So-so: amber halo.
// Needs care: pulsing coral halo. Seeds two friends via the save so the test is quick.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.MOOD_SHOTS ?? 'test-results';
const village = (page: Page) => page.evaluate(() => (window as any).__cozy.village());

test('mood faces: urgency halo colours follow needs', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    const vil = (id: number, name: string, kind: number) => ({ id, name, trait: 'Loves flowers', kind, job: null, food: 1, sleep: 1, fun: 1 });
    localStorage.setItem('cozy.save.v2', JSON.stringify({
      v: 2, theme: 'classic', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [],
      village: { res: { food: 3, wood: 8, stone: 4 }, buildings: [{ id: 1, type: 'home', gx: 2, gy: 1 }], villagers: [vil(2, 'Bea', 0), vil(3, 'Pip', 1)], nextId: 4, wanderer: 0, events: 0 },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => (window as any).__cozy.villageSpeed(0));
  const v0 = await village(page);
  expect(v0.villagers.length).toBe(2);
  const [a, b] = v0.villagers;
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y + 60), [a.x, a.y] as const);

  // Happy: no halo.
  await page.evaluate(([ia, ib]) => { (window as any).__cozy.setNeeds(ia, { food: 1, sleep: 1, fun: 1 }); (window as any).__cozy.setNeeds(ib, { food: 1, sleep: 1, fun: 1 }); }, [a.id, b.id] as const);
  await expect.poll(async () => (await village(page)).villagers.map((q: any) => q.urg), { timeout: 20_000 }).toEqual([0, 0]);
  expect((await village(page)).villagers.every((q: any) => q.ring === 0)).toBe(true);

  // One so-so (amber), one needs care now (coral pulse).
  await page.evaluate(([ia, ib]) => { (window as any).__cozy.setNeeds(ia, { food: 0.4 }); (window as any).__cozy.setNeeds(ib, { fun: 0.1 }); }, [a.id, b.id] as const);
  await expect.poll(async () => (await village(page)).villagers.map((q: any) => q.urg), { timeout: 20_000 }).toEqual([1, 2]);
  await expect.poll(async () => (await village(page)).villagers.map((q: any) => q.ring), { timeout: 20_000 }).toEqual([0xffc04d, 0xff6a5a]);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/mood-urgency-classic.png` });
  await page.evaluate(() => (window as any).__cozy.setTheme('halloween'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/mood-urgency-halloween.png` });
  await page.evaluate(() => (window as any).__cozy.setTheme('spring'));

  // Cared for: halo goes away.
  await page.evaluate(([ia, ib]) => { (window as any).__cozy.setNeeds(ia, { food: 1 }); (window as any).__cozy.setNeeds(ib, { fun: 1 }); }, [a.id, b.id] as const);
  await expect.poll(async () => (await village(page)).villagers.map((q: any) => q.urg), { timeout: 20_000 }).toEqual([0, 0]);
  expect(errors).toEqual([]);
});
