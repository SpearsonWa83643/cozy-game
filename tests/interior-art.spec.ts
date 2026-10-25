import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 12.6 Every interior has its own look: one screenshot per room (home, kitchen, workshop, garden, fishing hut).
const FILE = pathToFileURL(resolve(process.env.COZY_SINGLE ?? 'dist-single/index.html')).href;
const SHOTS = process.env.INTERIOR_SHOTS ?? 'screenshots';
const ROOMS: [string, string, string][] = [['home', 'Home', 'home'], ['kitchen', 'Kitchen', 'kitchen'], ['workshop', 'Workshop', 'workshop'], ['garden', 'Garden', 'garden'], ['fishhut', 'Fishing Hut', 'fishing-hut']];

test('each interior paints its own room, with the same exit spots', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({
      v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: ['feed', 'pantry', 'nearbed'],
      village: { res: { food: 5, wood: 3, stone: 1 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 0 }, { id: 2, type: 'kitchen', gx: 3, gy: 0 }, { id: 3, type: 'workshop', gx: 6, gy: 0 }, { id: 4, type: 'garden', gx: 0, gy: 3 }, { id: 5, type: 'fishhut', gx: 3, gy: 3 }],
        villagers: [], nextId: 9, wanderer: 0, events: 0 },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.evaluate(() => (window as any).__cozy.villageSpeed(0));
  const doors: string[] = [];
  let id = 1;
  for (const [type, name, slug] of ROOMS) {
    await page.evaluate(([id, type, name]) => (window as any).__game.events.emit('interior', { id, type, name }), [id++, type, name] as const);
    await expect.poll(() => page.evaluate(() => (window as any).__interior.open), { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(2500); // fade-in + animations
    const info = await page.evaluate(() => { const i = (window as any).__interior; return { btype: i.btype, art: !!i.art, door: i.rects.door, close: i.rects.close, w: i.w, h: i.h, items: i.items.length }; });
    expect(info.btype).toBe(type); expect(info.art).toBe(true); expect(info.items).toBeGreaterThan(3);
    expect(info.close.x + info.close.w).toBeLessThanOrEqual(info.w); expect(info.close.y).toBeGreaterThanOrEqual(0);
    doors.push(`${Math.round(info.door.x)},${Math.round(info.door.w)}`);
    await page.screenshot({ path: `${SHOTS}/interior-${slug}-v2.png` });
    await page.evaluate(() => (window as any).__interior.close());
    await expect.poll(() => page.evaluate(() => (window as any).__interior.open), { timeout: 10_000 }).toBe(false);
    await expect.poll(() => page.evaluate(() => (window as any).__game.registry.get('menuOpen')), { timeout: 8_000 }).toBeFalsy();
    await page.waitForTimeout(500);
  }
  expect(new Set(doors).size).toBe(1); // exit door sits in the same spot in every room
  expect(errors).toEqual([]);
});
