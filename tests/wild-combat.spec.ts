import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// The Wild Woods on iPad: trailhead, seeded generation, theme, Home button, exit portal.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const state = (page: Page) => cozy(page, 'state');
const wild = (page: Page) => cozy(page, 'wild()');
async function closeDialogs(page: Page) {
  for (let i = 0; i < 14 && (await state(page)).dialogOpen; i++) { await page.touchscreen.tap(590, 650); await page.waitForTimeout(700); }
}
const wildRect = (page: Page, k: string) => page.evaluate((k) => (window as any).__game.scene.getScene('wildui').rects[k], k);
const tapRect = async (page: Page, r: { x: number; y: number; w: number; h: number }) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('wild woods combat: bop, loot, hearts, home, wardrobe, theme', async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);
  await closeDialogs(page);

  // 1. Walk up to the trailhead and tap it.
  await page.evaluate(() => (window as any).__cozy.teleport(4080, 2800));
  await page.waitForTimeout(2000);
  await closeDialogs(page);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v8-00-trailhead.png` });
  for (let i = 0; i < 4 && !(await wild(page)).on && !(await wild(page)).inWild; i++) {
    const p = await page.evaluate(() => (window as any).__cozy.worldToScreen(4080, 2680));
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(2500);
    await closeDialogs(page);
  }
  await expect.poll(async () => (await wild(page)).on, { timeout: 60_000, intervals: [500] }).toBe(true);
  const w1 = await wild(page);
  // Diagnostics: remember why we ever left the woods / lost hearts (shown if a check below fails).
  await page.evaluate(() => { const w = (window as any).__game.scene.getScene('wild'); const log: string[] = ((window as any).__wildLog = []); const at = () => `${Math.round(w.feet.x)},${Math.round(w.feet.y)}`;
    w.events.on('leaving', (why: string) => log.push(`leaving:${why}@${at()}`)); w.events.on('hearts', (h: number) => log.push(`hearts:${h}@${at()}`)); });
  const wildLog = () => page.evaluate(() => ((window as any).__wildLog ?? []).join(' | '));
  expect(w1.props).toBeGreaterThan(80);
  expect(w1.clearings).toBeGreaterThanOrEqual(5);
  expect((await cozy(page, 'wildSave()')).visits).toBe(1);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v8-01-wild-classic.png` });

  // 2. Tap-to-walk moves you along.
  const start = w1.player;
  const tp = await page.evaluate(([x, y]) => (window as any).__cozy.wildToScreen(x, y), [start[0] + 160, start[1]]);
  await page.touchscreen.tap(tp.x, tp.y);
  await expect.poll(async () => (await wild(page)).player[0], { timeout: 30_000 }).toBeGreaterThan(start[0] + 60);

  // 3. Theme toggles live; stand near a spooky-cute monster for the picture.
  await cozy(page, "setTheme('halloween')");
  const mons = (await wild(page)).mons;
  expect(mons.length).toBeGreaterThan(3);
  const m0 = mons[mons.length - 1];
  await page.evaluate(([x, y]) => (window as any).__cozy.wildTeleport(x - 120, y + 20), [m0.x, m0.y]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v8-03-wild-combat.png` });

  // 4. Combat: tap a monster to walk over and bop it until it poofs into sparkles.
  const poof0 = (await wild(page)).poofs;
  for (let i = 0; i < 8 && (await wild(page)).poofs === poof0; i++) {
    const m = (await wild(page)).mons.sort((a: any, b: any) => Math.hypot(a.x - m0.x, a.y - m0.y) - Math.hypot(b.x - m0.x, b.y - m0.y))[0];
    const sp = await page.evaluate(([x, y]) => (window as any).__cozy.wildToScreen(x, y - 16), [m.x, m.y]);
    await page.touchscreen.tap(sp.x, sp.y);
    await page.waitForTimeout(1500);
  }
  await expect.poll(async () => (await wild(page)).poofs, { timeout: 30_000 }).toBeGreaterThan(poof0);
  // ...and the big Bop! button works too.
  const poof1 = (await wild(page)).poofs;
  for (let i = 0; i < 10 && (await wild(page)).poofs === poof1; i++) {
    const m = (await wild(page)).mons[0];
    await page.evaluate(([x, y]) => (window as any).__cozy.wildTeleport(x - 64, y), [m.x, m.y]);
    await tapRect(page, await wildRect(page, 'attack'));
    await page.waitForTimeout(700);
  }
  expect((await wild(page)).poofs).toBeGreaterThan(poof1);
  expect((await cozy(page, 'wildSave()')).poofs).toBeGreaterThanOrEqual(2);
  await cozy(page, "setTheme('spring')");

  // 4b. Get bumped once: a heart goes away, you get a little safe moment.
  expect((await wild(page)).on, 'still in the woods after bopping').toBe(true);
  await page.waitForTimeout(2600);
  const h0 = (await wild(page)).hearts;
  await page.evaluate(() => { const w = (window as any).__game.scene.getScene('wild'); const m = w.monsters.find((x: any) => x.alive) ?? w.monsters[0]; w.invulnT = 0; w.hurt(m); });
  await expect.poll(async () => (await wild(page)).hearts, { timeout: 10_000 }).toBe(h0 - 1);
  expect((await wild(page)).on).toBe(true);

  // 5a. Loot: walk over a drop, then open the wild treasure chest.
  // Hearts were checked above; keep wandering monsters from bumping us into a nap mid-loot (flaky at ~4fps).
  await page.evaluate(() => { (window as any).__game.scene.getScene('wild').invulnT = 1e9; });
  await expect.poll(async () => (await wild(page)).pickups.length + Object.values((await wild(page)).bag as Record<string, number>).reduce((a, b) => a + b, 0), { timeout: 30_000 }).toBeGreaterThan(0);
  for (let i = 0; i < 6; i++) {
    const p = (await wild(page)).pickups.find((q: any) => q.kind !== 'heart') ?? (await wild(page)).pickups[0];
    if (!p) break;
    await page.evaluate(([x, y]) => (window as any).__cozy.wildTeleport(x, y), [p.x, p.y]);
    await page.waitForTimeout(800);
  }
  const bag = (await wild(page)).bag;
  expect(bag.glowmoss + bag.starshard).toBeGreaterThan(0);
  expect((await wild(page)).on, `still in the woods before the chest: ${await wildLog()}`).toBe(true);
  const chest = (await wild(page)).chests[0];
  await page.evaluate(([x, y]) => (window as any).__cozy.wildTeleport(x, y + 90), [chest.x, chest.y]);
  await page.waitForTimeout(600);
  const cp = await page.evaluate(([x, y]) => (window as any).__cozy.wildToScreen(x, y - 20), [chest.x, chest.y]);
  await page.touchscreen.tap(cp.x, cp.y);
  for (let t = 0; t < 4 && !(await wild(page)).found?.length; t++) { await page.waitForTimeout(2500); if (!(await wild(page)).found?.length) await page.touchscreen.tap(cp.x, cp.y); }
  await expect.poll(async () => (await wild(page)).found, { timeout: 30_000, message: `chest loot (log: ${await wildLog()})` }).toContain('acorn_cap');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v8-03-loot-home.png` });
  const banked = bag.glowmoss + bag.starshard;

  // 5. The big Home button: back at the cottage.
  await tapRect(page, await wildRect(page, 'home'));
  await expect.poll(async () => (await wild(page)).on, { timeout: 30_000 }).toBe(false);
  await expect.poll(async () => (await state(page)).locked, { timeout: 30_000 }).toBe(false);
  await page.waitForTimeout(1500);
  // Finds came home: satchel counts + the Acorn Cap treasure (unlocks the hat in the wardrobe).
  const st = await state(page);
  expect((st.minor.glowmoss ?? 0) + (st.minor.starshard ?? 0)).toBeGreaterThanOrEqual(banked);
  expect(st.treasures).toContain('acorn_cap');
  expect(Object.values(await cozy(page, 'wildSave()').then((w: any) => w.loot) as Record<string, number>).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  // The Acorn Cap shows up unlocked in the wardrobe and can be worn.
  await closeDialogs(page);
  const sb = await page.evaluate(() => { const u = (window as any).__game.scene.getScene('ui'); return { x: u.bagC.x, y: u.bagC.y }; });
  await page.touchscreen.tap(sb.x, sb.y);
  await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(600);
  await tapRect(page, await page.evaluate(() => (window as any).__menu.rects['hat:acorn']));
  await expect.poll(async () => (await state(page)).look.hat, { timeout: 30_000 }).toBe('acorn');
  await tapRect(page, await page.evaluate(() => (window as any).__menu.rects['close']));
  await expect.poll(() => page.evaluate(() => (window as any).__game.registry.get('menuOpen')), { timeout: 30_000 }).toBe(false);

  // 6. Same seed, same woods; then walk out through the exit portal to the trailhead.
  await cozy(page, 'enterWild(4242)');
  await expect.poll(async () => (await wild(page)).on, { timeout: 60_000, intervals: [500] }).toBe(true);
  const a = await wild(page);
  await tapRect(page, await wildRect(page, 'home'));
  await expect.poll(async () => (await wild(page)).on, { timeout: 30_000 }).toBe(false);
  await page.waitForTimeout(1500);
  await cozy(page, 'enterWild(4242)');
  await expect.poll(async () => (await wild(page)).on, { timeout: 60_000, intervals: [500] }).toBe(true);
  const b = await wild(page);
  expect([b.props, b.ponds, b.exit]).toEqual([a.props, a.ponds, a.exit]);
  await page.evaluate(([x, y]) => (window as any).__cozy.wildTeleport(x, y + 60), b.exit);
  await page.evaluate(([x, y]) => (window as any).__cozy.wildTap(x, y - 10), b.exit);
  await expect.poll(async () => (await wild(page)).on, { timeout: 30_000 }).toBe(false);
  await expect.poll(async () => (await state(page)).locked, { timeout: 30_000 }).toBe(false);
  const fx = await page.evaluate(() => (window as any).__game.scene.getScene('world').feet.x);
  expect(Math.abs(fx - 4080)).toBeLessThan(200);

  // 7. Out of hearts: you gently wake up at home.
  await cozy(page, 'enterWild(99)');
  await expect.poll(async () => (await wild(page)).on, { timeout: 60_000, intervals: [500] }).toBe(true);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { const w = (window as any).__game.scene.getScene('wild'); w.invulnT = 0; w.hurt(w.monsters[0]); });
    await page.waitForTimeout(300);
  }
  await expect.poll(async () => (await wild(page)).on, { timeout: 30_000 }).toBe(false);
  await expect.poll(async () => (await state(page)).dialogOpen, { timeout: 30_000 }).toBe(true);
  await closeDialogs(page);
  const home = await page.evaluate(() => { const w = (window as any).__game.scene.getScene('world'); return [w.feet.x, w.feet.y]; });
  expect(Math.hypot(home[0] - 470, home[1] - 670)).toBeLessThan(60);
  expect(errors).toEqual([]);
});
