import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// The bigger world: travel between areas, a new puzzle, fishing, cosmetics, creature taps.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const state = (page: Page) => cozy(page, 'state');
const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [x, y] as const) as Promise<{ x: number; y: number }>;
const teleport = async (page: Page, x: number, y: number, settle = 1200) => {
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y] as const);
  await page.waitForTimeout(settle);
};
const tapWorld = async (page: Page, x: number, y: number) => { const p = await toScreen(page, x, y); await page.touchscreen.tap(p.x, p.y); };
const menuRect = (page: Page, id: string) => page.evaluate((id) => (window as any).__menu.rects[id], id);
const tapRect = async (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
async function closeDialogs(page: Page) {
  for (let i = 0; i < 12 && (await state(page)).dialogOpen; i++) { await page.touchscreen.tap(590, 300); await page.waitForTimeout(500); }
}

test('bigger world: areas, puzzle, fishing, wardrobe, creatures', async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);

  // 1. Walk from the glade through the east gap into Brookside (tap-to-move with pathing).
  await teleport(page, 1900, 630);
  await tapWorld(page, 2115, 690);
  await expect.poll(async () => (await state(page)).area, { timeout: 240_000, intervals: [500] }).toBe('river');
  // ...and south along the river into the lake meadow.
  await teleport(page, 2150, 1550);
  await tapWorld(page, 2050, 1805);
  await expect.poll(async () => (await state(page)).area, { timeout: 240_000, intervals: [500] }).toBe('lake');

  // 2. Garden flower-pot puzzle (tap pots from a distance), then open the chest.
  await teleport(page, 245, 880);
  const pots = [{ x: 175, y: 760 }, { x: 220, y: 760 }, { x: 265, y: 760 }, { x: 310, y: 760 }];
  const target = [0, 1, 2, 3];
  for (let i = 0; i < 4; i++) {
    for (let guard = 0; guard < 8; guard++) {
      const cols = await cozy(page, 'pots()');
      if (cols[i] === target[i]) break;
      await tapWorld(page, pots[i].x, pots[i].y - 4);
      await expect.poll(async () => (await cozy(page, 'pots()'))[i], { timeout: 30_000, intervals: [200] }).not.toBe(cols[i]);
    }
  }
  await expect.poll(async () => (await state(page)).puzzles.pots, { timeout: 30_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('world').puzzles.potChest.revealed), { timeout: 60_000, intervals: [300] }).toBe(true);
  await page.waitForTimeout(1500);
  await tapWorld(page, 245, 818);
  await expect.poll(async () => (await state(page)).treasures, { timeout: 120_000, intervals: [500] }).toContain('flower_crown');
  await page.waitForTimeout(2500);
  await closeDialogs(page);

  // 3. Wardrobe: equip the flower crown.
  const bag = await page.evaluate(() => { const u = (window as any).__game.scene.getScene('ui'); return { x: u.bagC.x, y: u.bagC.y }; });
  await page.touchscreen.tap(bag.x, bag.y);
  await expect.poll(async () => (await state(page)) && page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(600);
  await tapRect(page, await menuRect(page, 'hat:crown'));
  await expect.poll(async () => (await state(page)).look.hat, { timeout: 30_000 }).toBe('crown');
  await tapRect(page, await menuRect(page, 'scarf:none'));
  await expect.poll(async () => (await state(page)).look.scarf, { timeout: 30_000 }).toBe('none');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v4-03-wardrobe.png` });
  await tapRect(page, await menuRect(page, 'tab:map'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v4-05-map.png` });
  await tapRect(page, await menuRect(page, 'close'));
  await expect.poll(() => page.evaluate(() => (window as any).__game.registry.get('menuOpen')), { timeout: 30_000 }).toBe(false);

  // 4. Fishing at the lake pier: cast, hook the bite, play the timing game until a catch.
  await teleport(page, 1250, 2270, 1500);
  const cdp = await page.context().newCDPSession(page);
  const touch = async (x: number, y: number, epochMs?: number) => {
    const ts = epochMs ? { timestamp: epochMs / 1000 } : {};
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 2, radiusX: 6, radiusY: 6, force: 1 }], ...ts });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], ...ts });
  };
  let shotTaken = false;
  for (let attempt = 0; attempt < 8 && (await cozy(page, 'fish()')).catches === 0; attempt++) {
    if ((await cozy(page, 'fish()')).state === 'idle') {
      // A friendly tip card can pop up on arrival; close it first (taps on the world wait while it is open).
      await closeDialogs(page);
      // A catch / got-away card from the last try can still be up; let it clear before casting again.
      await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('ui').cardOpen), { timeout: 30_000 }).toBeFalsy();
      await page.waitForTimeout(300);
      // On a slow (no-GPU) test box a single tap can be dropped; tap again if the line didn't go out.
      for (let t = 0; t < 4 && (await cozy(page, 'fish()')).state === 'idle'; t++) {
        await tapWorld(page, 1330, 2390);
        await page.waitForTimeout(2500);
      }
      await expect.poll(async () => (await cozy(page, 'fish()')).state, { timeout: 30_000, intervals: [150] }).not.toBe('idle');
    }
    await expect.poll(async () => (await cozy(page, 'fish()')).state, { timeout: 90_000, intervals: [150] }).toMatch(/bite|idle/);
    if ((await cozy(page, 'fish()')).state !== 'bite') continue;
    await touch(590, 300);
    await expect.poll(async () => (await cozy(page, 'fish()')).state, { timeout: 20_000, intervals: [100] }).toMatch(/reel|idle/);
    for (let k = 0; k < 20 && (await cozy(page, 'fish()')).state === 'reel'; k++) {
      if (!shotTaken) { await page.screenshot({ path: `${SHOTS}/hd-ipad-v4-02-fishing.png` }); shotTaken = true; }
      // The game judges a reel tap at the touch event's own timestamp, so stamp the tap at the moment
      // the marker crosses the green zone (exactly what a well-timed finger does).
      const at = await cozy(page, 'fishZoneEpoch(300)');
      if (at < 0) break;
      await page.waitForTimeout(Math.max(0, at - Date.now()));
      await touch(590, 300, at);
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1500);
  }
  expect((await cozy(page, 'fish()')).catches).toBeGreaterThan(0);
  expect((await state(page)).fish.length).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v4-02b-catch.png` });
  await cdp.detach();
  // Dismiss the catch card with a tap (it also fades on its own).
  if (await page.evaluate(() => (window as any).__game.scene.getScene('ui').cardOpen)) await page.touchscreen.tap(590, 300);
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('ui').cardOpen), { timeout: 30_000 }).toBe(false);
  await page.waitForTimeout(800);

  // 5. Tap creatures: crab on the shore, ducks + cat in the glade, rabbit in the orchard, deer + owl in the wood.
  const reactions0 = (await state(page)).reactions;
  const tapCritter = async (name: string, pick: (c: any) => [number, number] | null, off: [number, number]) => {
    const p0 = pick(await cozy(page, 'critters()'));
    expect(p0, name).toBeTruthy();
    await teleport(page, p0![0] + off[0], p0![1] + off[1], 1500);
    const before = (await state(page)).reactions;
    for (let tries = 0; tries < 4 && (await state(page)).reactions === before; tries++) {
      const p = pick(await cozy(page, 'critters()'));
      if (p) await tapWorld(page, p[0], p[1]);
      await page.waitForTimeout(1500);
    }
    await expect.poll(async () => (await state(page)).reactions, { timeout: 20_000, intervals: [200], message: name }).toBeGreaterThan(before);
    await page.waitForTimeout(700);
  };
  await tapCritter('crab', (c) => c.crabs[0], [150, 60]);
  await tapCritter('duck', (c) => c.ducks[0], [0, 160]);
  await tapCritter('cat', (c) => c.cat, [120, 60]);
  await tapCritter('rabbit', (c) => c.rabbits[c.rabbits.length - 1], [220, 80]);
  await tapCritter('owl', (c) => c.owl, [60, 120]);
  await tapCritter('deer', (c) => c.deer[0], [240, 60]);
  expect((await state(page)).reactions).toBeGreaterThanOrEqual(reactions0 + 6);

  // 6. Scenic shots of the new areas (wait for that area's title card).
  const scenic = async (x: number, y: number, title: string, file: string) => {
    await teleport(page, x, y, 500);
    await expect.poll(() => page.evaluate(() => { const u = (window as any).__game.scene.getScene('ui'); return u.toastText.text; }), { timeout: 60_000 }).toBe(title);
    await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('ui').toastC.alpha), { timeout: 30_000 }).toBeGreaterThan(0.9);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SHOTS}/${file}` });
  };
  await scenic(3480, 860, 'Mistbirch Wood', 'hd-ipad-v4-01-mistbirch.png');
  await scenic(3600, 2080, 'Windmill Orchard', 'hd-ipad-v4-04-orchard.png');
  await scenic(1180, 2080, 'Shellwater Shore', 'hd-ipad-v4-06-shore.png');

  const tiles = (await state(page)).tiles;
  expect(tiles).toBeLessThanOrEqual(24); // streamed ground stays bounded
  expect(errors).toEqual([]);
});
