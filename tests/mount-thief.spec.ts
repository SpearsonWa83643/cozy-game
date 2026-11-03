import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 40: Mount Thief. The mask button calls a masked thief; 3 taps arrest it. If it gets away it hides
// a friend behind a puzzle (which resets); opening that puzzle's chest rescues the friend.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.THIEF_SHOTS ?? '/workspace/cozy-game/screenshots';
const thief = (page: Page) => page.evaluate(() => (window as any).__cozy.thief());
const dialogOpen = (page: Page) => page.evaluate(() => !!(window as any).__game.registry.get('dialogOpen'));

test('mount thief: button, arrest with 3 taps, escape hides a friend, rescue from the chest', async ({ playwright: _pw }, info) => {
  test.setTimeout(900_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: { trail: true, stones: true }, treasures: ['pterodactyl_egg', 'rainbow_horseshoe'], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
    });
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1500);
    expect((await thief(page)).blocked).toBeNull();

    // 1) Tap the mask button: a thief sneaks in. Tap it 3 times to arrest it.
    const btn = await page.evaluate(() => { const ui = (window as any).__game.scene.getScene('ui'); return { x: ui.thiefC.x, y: ui.thiefC.y, vis: ui.thiefC.visible }; });
    expect(btn.vis).toBe(true);
    await page.touchscreen.tap(btn.x, btn.y);
    await expect.poll(async () => (await thief(page)).state, { timeout: 20_000 }).toBe('sneak');
    await page.waitForTimeout(1400);
    for (let i = 0; i < 30 && (await thief(page)).state === 'sneak'; i++) {
      const s = (await thief(page)).screen;
      if (s) await page.touchscreen.tap(s.x, s.y);
      await page.waitForTimeout(250);
    }
    const t1 = await thief(page);
    expect(t1.state).toBe('caught');
    expect(t1.taps).toBe(3);
    expect(t1.giggles).toBe(2); // 46: a cheeky giggle after each of the first two taps
    expect(t1.stolen).toBeNull();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOTS}/thief-caught.png`, scale: 'css' });
    await expect.poll(async () => (await thief(page)).state, { timeout: 30_000 }).toBe('off');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2')!).minor.thief_caught), { timeout: 5_000 }).toBe(1);
    // 41: it leaves a thank-you snack of 2 berries.
    expect((await thief(page)).thanks).toBe(2);
    await expect.poll(() => page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cozy.save.v2')!); return [s.snacks, s.berries]; }), { timeout: 5_000 }).toEqual([2, 2]);

    // 2) Next time nobody taps: it escapes with a friend and hides it behind a solved puzzle.
    expect(await page.evaluate(() => (window as any).__cozy.startThief('raccoon', 1500, 1))).toBe(true);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/thief-sneak.png`, scale: 'css' });
    await expect.poll(async () => (await thief(page)).stolen, { timeout: 30_000 }).not.toBeNull();
    // 51: you see it carrying your friend off as it runs.
    const tc = await thief(page);
    expect(tc.state).toBe('flee');
    expect(tc.carrying).toEqual([tc.stolen[0].mount]);
    expect(tc.stolen.length).toBe(1);
    const st = tc.stolen[0];
    expect(['pterodactyl', 'unicorn']).toContain(st.mount);
    expect(['trail', 'stones']).toContain(st.puzzle);
    expect(st.kind).toBe('raccoon');
    await page.waitForTimeout(500);
    const sv = await page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2')!));
    expect(sv.stolen).toEqual([st]);
    expect(sv.puzzles[st.puzzle]).toBeUndefined();
    await page.screenshot({ path: `${SHOTS}/thief-paws.png`, scale: 'css' });
    await expect.poll(async () => (await thief(page)).state, { timeout: 20_000 }).toBe('off');
    expect((await thief(page)).paws, '43: paw prints on the escape trail').toBeGreaterThan(0);
    await expect.poll(() => dialogOpen(page), { timeout: 20_000 }).toBe(true);
    for (let i = 0; i < 8 && await dialogOpen(page); i++) { await page.touchscreen.tap(600, 500); await page.waitForTimeout(500); }
    expect(await dialogOpen(page)).toBe(false);
    const t2 = await thief(page);
    expect(t2.marker).toBe(true);
    expect(t2.carrying).toEqual([]);
    expect(t2.cells, '52: a cell at the hiding puzzle').toEqual([st.puzzle]);
    expect(t2.blocked).toContain('Rescue');

    // The stolen friend is missing from the stable, and its stall says where it's hidden.
    await page.evaluate(() => (window as any).__menu.show('stable'));
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(1000);
    const pets = await page.evaluate(() => (window as any).__menu.stablePets.map((p: any) => [p.id, p.on]));
    expect(await page.evaluate(() => (window as any).__menu.stableTitle)).toContain('Thieves caught: 1'); // 42
    expect(pets.find((p: any) => p[0] === st.mount)[1]).toBe(false);
    const r = await page.evaluate((id) => (window as any).__menu.rects[`stall:${id}`], st.mount);
    await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
    await expect.poll(() => page.evaluate(() => (window as any).__menu.hintText?.text ?? ''), { timeout: 20_000 }).toContain('Raccoon hid the');
    await page.evaluate(() => (window as any).__menu.close());
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 20_000 }).toBe(false);

    // 3) It survives a reload; opening that puzzle's chest rescues the friend.
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1500);
    const t3 = await thief(page);
    expect(t3.stolen).toEqual([st]);
    expect(t3.cells).toEqual([st.puzzle]);
    expect(t3.marker).toBe(true);
    expect(await page.evaluate((id) => (window as any).__cozy.openPuzzleChest(id), st.puzzle)).toBe(true);
    await expect.poll(async () => (await thief(page)).stolen, { timeout: 20_000 }).toBeNull();
    const t4 = await thief(page);
    expect(t4.rescued).toBe(1);
    expect(t4.marker).toBe(false);
    expect(t4.cells).toEqual([]);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2')!).stolen), { timeout: 5_000 }).toBeUndefined();
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});

// 51-53 (Walker, Nov 2): the thief can carry off 2 (or 3) friends; each waits in its own cell behind
// a different puzzle; Call Mount names every hiding spot; tapping a solved puzzle's cell frees the friend.
test('mount thief: carries two friends, cells, call-mount hint, cell rescue, old-save migration', async ({ playwright: _pw }, info) => {
  test.setTimeout(900_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    // An old single-friend save (object, not a list) still loads, as a one-item list.
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: { trail: true }, treasures: ['pterodactyl_egg', 'rainbow_horseshoe', 'golden_honeycomb'], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [], stolen: { mount: 'unicorn', puzzle: 'stones', kind: 'fox' } }));
    });
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1500);
    const t0 = await thief(page);
    expect(t0.stolen).toEqual([{ mount: 'unicorn', puzzle: 'stones', kind: 'fox' }]);
    expect(t0.cells).toEqual(['stones']);
    expect(t0.blocked).toContain('Rescue the Unicorn');
    // Locked until its puzzle is solved; then a tap opens the cell and the friend comes home.
    expect(await page.evaluate(() => (window as any).__cozy.thiefCell('stones'))).toBe(false);
    expect((await thief(page)).stolen).not.toBeNull();
    expect(await page.evaluate(() => (window as any).__cozy.thiefCell('stones', true))).toBe(true);
    const tr = await thief(page);
    expect(tr.stolen).toBeNull();
    expect(tr.cells).toEqual([]);
    expect(tr.rescued).toBe(1);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2')!).stolen), { timeout: 5_000 }).toBeUndefined();
    await page.waitForTimeout(2500);

    // Two friends: the thief carries both, each hides behind a different puzzle with its own cell.
    expect(await page.evaluate(() => (window as any).__cozy.startThief('fox', 6000, 2))).toBe(true);
    await expect.poll(async () => (await thief(page)).carrying.length, { timeout: 90_000, intervals: [100] }).toBe(2);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/thief-carrying-two.png`, scale: 'css' });
    const tc = await thief(page);
    expect(tc.state).toBe('flee');
    expect(tc.stolen.length).toBe(2);
    expect(new Set(tc.stolen.map((x: any) => x.puzzle)).size).toBe(2);
    expect(new Set(tc.stolen.map((x: any) => x.mount)).size).toBe(2);
    expect([...tc.carrying].sort()).toEqual(tc.stolen.map((x: any) => x.mount).sort());
    for (const x of tc.stolen) expect(['pterodactyl', 'unicorn', 'bumblebee']).toContain(x.mount);
    await expect.poll(() => dialogOpen(page), { timeout: 120_000 }).toBe(true);
    for (let i = 0; i < 8 && await dialogOpen(page); i++) { await page.touchscreen.tap(600, 500); await page.waitForTimeout(500); }
    const t2 = await thief(page);
    expect(t2.carrying).toEqual([]);
    expect([...t2.cells].sort()).toEqual(tc.stolen.map((x: any) => x.puzzle).sort());
    expect(t2.blocked).toContain('Rescue your friends first!');
    const sv = await page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2')!));
    expect(sv.stolen.length).toBe(2);

    // Call Mount names every hiding spot.
    const mb = await page.evaluate(() => (window as any).__vui.rects.mount);
    await page.touchscreen.tap(mb.x + mb.w / 2, mb.y + mb.h / 2);
    await expect.poll(async () => (await thief(page)).callHint, { timeout: 20_000 }).toContain('hiding');
    const hint = (await thief(page)).callHint as string;
    const HID: Record<string, string> = { pots: 'flower pots', bells: 'singing bells', tiles: 'turning tiles', dig: 'digging spot', stones: 'stepping stones', trail: 'deer tracks' };
    for (const x of tc.stolen) expect(hint).toContain(HID[x.puzzle]);
    await page.evaluate(() => (window as any).__vui.closeMountPicker?.(true));
    await page.waitForTimeout(500);

    // A friend waiting in its cell (iPad screenshot), then rescue both.
    const p0 = tc.stolen[0].puzzle;
    const at = await page.evaluate((p) => (window as any).__cozy.thiefCellAt(p), p0);
    expect(at).toBeTruthy();
    await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x - 40, y + 90), [at.wx, at.wy]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SHOTS}/thief-cell.png`, scale: 'css' });
    for (const x of tc.stolen) expect(await page.evaluate((p) => (window as any).__cozy.thiefCell(p, true), x.puzzle)).toBe(true);
    const t3 = await thief(page);
    expect(t3.stolen).toBeNull();
    expect(t3.cells).toEqual([]);
    expect(t3.blocked).toBeNull();
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
