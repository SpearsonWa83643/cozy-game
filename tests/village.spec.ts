import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Willow Village on iPad touch: invite a friend, build, assign a job, watch resources grow,
// and flip the theme both ways from the satchel.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const village = (page: Page) => cozy(page, 'village()');
const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [x, y] as const) as Promise<{ x: number; y: number }>;
const tapWorld = async (page: Page, x: number, y: number) => { const p = await toScreen(page, x, y); await page.touchscreen.tap(p.x, p.y); };
const vuiRect = (page: Page, id: string) => page.evaluate((id) => (window as any).__vui.rects[id], id);
const menuRect = (page: Page, id: string) => page.evaluate((id) => (window as any).__menu.rects[id], id);
const tapRect = async (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
const waitRect = async (page: Page, id: string, menu = false) => {
  await expect.poll(() => (menu ? menuRect(page, id) : vuiRect(page, id)), { timeout: 60_000, intervals: [250] }).toBeTruthy();
  return menu ? menuRect(page, id) : vuiRect(page, id);
};

/** A real one-finger drag (CDP touch events), slow enough for a low-FPS headless page. */
async function touchDrag(page: Page, from: { x: number; y: number }, to: () => Promise<{ x: number; y: number }>) {
  const cdp = await page.context().newCDPSession(page);
  const pt = (x: number, y: number) => [{ x, y, id: 7, radiusX: 8, radiusY: 8, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from.x, from.y) });
  await page.waitForTimeout(400);
  let end = await to();
  for (let i = 1; i <= 10; i++) {
    if (i % 3 === 0) end = await to();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(from.x + ((end.x - from.x) * i) / 10, from.y + ((end.y - from.y) * i) / 10) });
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(600);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('village: invite, build, assign a job, resources, theme toggle', async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);
  // Headless Chromium renders at a few FPS; run the village clock faster so the test is not hours long.
  await cozy(page, 'villageSpeed(6)');
  await page.evaluate(() => (window as any).__cozy.teleport(560, 1975));

  // 1. A friendly guest arrives. Tap them, then tap Invite.
  await expect.poll(async () => (await village(page)).guest, { timeout: 240_000, intervals: [500] }).toBeTruthy();
  for (let i = 0; i < 6 && !(await vuiRect(page, 'card:invite')); i++) {
    const g = (await village(page)).guest;
    await tapWorld(page, g.x, g.y);
    await page.waitForTimeout(1500);
  }
  await tapRect(page, await waitRect(page, 'card:invite'));
  await expect.poll(async () => (await village(page)).villagers.length, { timeout: 60_000 }).toBe(1);
  await page.waitForTimeout(800);

  // 2. Build mode: pick the garden, nudge the ghost to a spot, tap the green check.
  await tapRect(page, await vuiRect(page, 'build'));
  await expect.poll(async () => (await village(page)).building, { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(2500);
  await tapRect(page, await waitRect(page, 'tray:garden'));
  await expect.poll(async () => (await village(page)).ghost, { timeout: 30_000 }).toBeTruthy();
  await tapWorld(page, 130 + 64 * 4, 1600 + 64 * 2.5); // centre of cells (3..4, 2..3)
  await expect.poll(async () => (await village(page)).ghost?.gx, { timeout: 30_000 }).toBe(3);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v5-03-build-mode.png` });
  const chk = (await village(page)).ghost.check;
  await tapWorld(page, chk[0], chk[1]);
  await expect.poll(async () => (await village(page)).buildings.length, { timeout: 30_000 }).toBe(1);
  const afterBuild = (await village(page)).res;
  expect(afterBuild.wood).toBe(6); // garden costs 2 wood
  // Also build a home so the next guest has a bed.
  await tapRect(page, await waitRect(page, 'tray:home'));
  await expect.poll(async () => (await village(page)).ghost?.ok, { timeout: 30_000 }).toBe(true);
  const chk2 = (await village(page)).ghost.check;
  await tapWorld(page, chk2[0], chk2[1]);
  await expect.poll(async () => (await village(page)).buildings.length, { timeout: 30_000 }).toBe(2);
  await page.waitForTimeout(1200);
  await tapRect(page, await vuiRect(page, 'build')); // Done
  await expect.poll(async () => (await village(page)).building, { timeout: 30_000 }).toBe(false);
  await page.waitForTimeout(2500);

  const garden = (await village(page)).buildings.find((b: any) => b.type === 'garden');
  // 2b. An idle friend gets a job bubble. One tap takes the job; Undo puts it back.
  await expect.poll(async () => (await village(page)).villagers[0].bubble, { timeout: 120_000, intervals: [500] }).toBeTruthy();
  for (let i = 0; i < 5 && (await village(page)).villagers[0].job === null; i++) {
    const b = (await village(page)).villagers[0].bubble;
    if (!b) break;
    await tapWorld(page, b[0], b[1]);
    await page.waitForTimeout(1200);
  }
  await expect.poll(async () => (await village(page)).villagers[0].job, { timeout: 30_000 }).toBe(garden.id);
  await tapRect(page, await waitRect(page, 'undo'));
  await expect.poll(async () => (await village(page)).villagers[0].job, { timeout: 30_000 }).toBe(null);
  await page.waitForTimeout(800);

  // 3. Drag the villager onto the garden to make them the gardener.
  for (let attempt = 0; attempt < 4 && (await village(page)).villagers[0].job === null; attempt++) {
    const v = (await village(page)).villagers[0];
    const from = await toScreen(page, v.x, v.y);
    await touchDrag(page, from, () => toScreen(page, garden.x, garden.y));
    await page.waitForTimeout(1200);
  }
  await expect.poll(async () => (await village(page)).villagers[0].job, { timeout: 30_000 }).toBe(garden.id);

  // 4. They walk over and work; food goes up.
  const food0 = (await village(page)).res.food;
  await expect.poll(async () => (await village(page)).res.food, { timeout: 300_000, intervals: [1000] }).toBeGreaterThan(food0);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v5-01-village-classic.png` });

  // 5. Tap the villager for their card.
  for (let i = 0; i < 6 && !(await vuiRect(page, 'card')); i++) {
    const v = (await village(page)).villagers[0];
    await tapWorld(page, v.x, v.y);
    await page.waitForTimeout(1500);
  }
  await waitRect(page, 'card');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v5-04-villager-card.png` });
  await tapRect(page, await vuiRect(page, 'card:close'));
  await expect.poll(() => vuiRect(page, 'card'), { timeout: 30_000 }).toBeFalsy();
  await page.waitForTimeout(800);

  // 5b. A hungry friend shows an alert with a one-tap fix.
  await cozy(page, 'villageSpeed(1)');
  const vid = (await village(page)).villagers[0].id;
  const foodBefore = (await village(page)).res.food;
  await page.evaluate((id) => { (window as any).__cozy.setRes({ food: 0 }); (window as any).__cozy.setNeeds(id, { food: 0.05 }); }, vid);
  await expect.poll(async () => (await village(page)).alert?.id ?? null, { timeout: 60_000, intervals: [400] }).toBe(`food${vid}`);
  await tapRect(page, await waitRect(page, 'alert:fix'));
  await expect.poll(async () => (await village(page)).villagers[0].need.food, { timeout: 30_000 }).toBeGreaterThan(0.9);
  await page.evaluate((n) => (window as any).__cozy.setRes({ food: n }), foodBefore);
  // Out of wood and stone with no workshop: friends bring some, so building never gets stuck.
  await page.evaluate(() => (window as any).__cozy.setRes({ wood: 0, stone: 0 }));
  await expect.poll(async () => (await village(page)).alert?.id ?? null, { timeout: 60_000, intervals: [400] }).toBe('wood');
  await page.waitForTimeout(500);
  await tapRect(page, await waitRect(page, 'alert:fix'));
  await expect.poll(async () => (await village(page)).res.wood, { timeout: 30_000 }).toBeGreaterThanOrEqual(4);

  // 5c. Tap a fruit tree, pick up the fruit, then feed the cat: hearts, and it follows you.
  const cat0 = (await cozy(page, 'critters()')).cat;
  const trees = await page.evaluate(([x, y]) => (window as any).__cozy.fruitTrees(x, y), cat0);
  for (let i = 0; i < trees.length * 2 && (await cozy(page, 'state')).snacks < 1; i++) {
    const t = trees[i % trees.length];
    await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x + 70, y + 50), [t[0], t[2]]);
    await page.waitForTimeout(1500);
    await tapWorld(page, t[0], t[1]);
    await expect.poll(async () => (await cozy(page, 'pickups()')).filter((p: any) => p[2] === 'apple').length, { timeout: 8_000, intervals: [300] }).toBeGreaterThan(0).catch(() => {});
    await page.waitForTimeout(900);
    const ps = (await cozy(page, 'pickups()')).filter((p: any) => p[2] === 'apple');
    for (const p of ps) { await tapWorld(page, p[0], p[1] - 4); await page.waitForTimeout(700); }
    await page.waitForTimeout(1200);
  }
  expect((await cozy(page, 'state')).snacks).toBeGreaterThan(0);
  await waitRect(page, 'snacks');
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x - 110, y + 60), cat0);
  await page.waitForTimeout(1800);
  const fed0 = (await cozy(page, 'state')).fed;
  for (let i = 0; i < 4 && (await cozy(page, 'state')).fed === fed0; i++) {
    const c = (await cozy(page, 'critters()')).cat;
    await tapWorld(page, c[0], c[1]);
    await page.waitForTimeout(1500);
  }
  await expect.poll(async () => (await cozy(page, 'state')).fed, { timeout: 30_000 }).toBeGreaterThan(fed0);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v5-05-feeding.png` });
  await expect.poll(async () => (await cozy(page, 'state')).followers, { timeout: 20_000 }).toBeGreaterThan(0);
  await page.evaluate(() => (window as any).__cozy.teleport(560, 1975));
  await page.waitForTimeout(2500);

  // 6. Theme toggle from the satchel: Halloween, then back to Classic.
  const bag = await page.evaluate(() => { const u = (window as any).__game.scene.getScene('ui'); return { x: u.bagC.x, y: u.bagC.y }; });
  const pickTheme = async (id: string) => {
    for (let i = 0; i < 5 && (await village(page)).theme !== id; i++) {
      if (!(await page.evaluate(() => (window as any).__menu.open))) { await page.touchscreen.tap(bag.x, bag.y); await page.waitForTimeout(1500); }
      const r = await menuRect(page, `theme:${id}`);
      if (r) await tapRect(page, r);
      await page.waitForTimeout(1500);
    }
    await expect.poll(async () => (await village(page)).theme, { timeout: 30_000 }).toBe(id);
  };
  await pickTheme('halloween');
  await page.waitForTimeout(600);
  await tapRect(page, await menuRect(page, 'close'));
  await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(false);
  await page.waitForTimeout(9000); // let the ground repaint + cross-fade
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v5-02-village-halloween.png` });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2') || '{}').theme)).toBe('halloween');
  await pickTheme('classic');
  await tapRect(page, await menuRect(page, 'close'));

  // Progress survives a reload.
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  const after = await village(page);
  expect(after.villagers.length).toBe(1);
  expect(after.buildings.length).toBe(2);
  expect(after.theme).toBe('classic');
  expect(errors).toEqual([]);
});
