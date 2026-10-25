import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 12.8 Each room has a tappable prop with a cute reaction: fireplace, kettle, clock, lantern, net (+ a lantern in the garden).
const FILE = pathToFileURL(resolve(process.env.COZY_SINGLE ?? 'dist-single/index.html')).href;
const SHOTS = process.env.INTERIOR_SHOTS ?? 'screenshots';
const ROOMS: [string, string, string[]][] = [['home', 'Home', ['fire']], ['kitchen', 'Kitchen', ['kettle']], ['workshop', 'Workshop', ['clock']], ['garden', 'Garden', ['lantern']], ['fishhut', 'Fishing Hut', ['net', 'lantern']]];

test('tap the fireplace, kettle, clock, lantern and net', async ({ page }) => {
  test.setTimeout(300_000);
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
  let id = 1;
  for (const [type, name, props] of ROOMS) {
    await page.evaluate(([id, type, name]) => (window as any).__game.events.emit('interior', { id, type, name }), [id++, type, name] as const);
    await expect.poll(() => page.evaluate(() => (window as any).__interior.open), { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(1800);
    const rects = await page.evaluate(() => { const i = (window as any).__interior; return i.props.map((p: any, n: number) => ({ id: p.id, ...i.rects['prop' + n] })); });
    expect(rects.map((r: any) => r.id)).toEqual(props);
    for (const r of rects) {
      await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
      await page.waitForTimeout(450);
    }
    await page.screenshot({ path: `${SHOTS}/interior-props-${type}.png` });
    const log = await page.evaluate(() => (window as any).__interior.propLog.slice());
    expect(log).toEqual(props);
    await page.evaluate(() => (window as any).__interior.close());
    await expect.poll(() => page.evaluate(() => (window as any).__interior.open), { timeout: 10_000 }).toBe(false);
    await expect.poll(() => page.evaluate(() => (window as any).__game.registry.get('menuOpen')), { timeout: 8_000 }).toBeFalsy();
    await page.waitForTimeout(500);
  }
  expect(errors).toEqual([]);
});
