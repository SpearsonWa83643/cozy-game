import { test, expect, chromium, type Page, type BrowserContext } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 69: Thief Chase. When a thief runs off with a friend you get a big "Chase it!" offer; pick a friend
// to fly, steer by sliding a finger (iPad touch), bubble nets fly up by themselves. Nets that land fill
// the Catch meter; 4 and the thief is caught: friends home (no cells), thief in the Thief Jail.
// "Not now" (and running out of time) fall back to the hide-in-a-cell flow.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.CHASE_SHOTS ?? 'screenshots';
const SAVE = { v: 2, theme: 'spring', puzzles: { trail: true, stones: true }, treasures: ['pterodactyl_egg', 'rainbow_horseshoe'], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] };
const thief = (page: Page) => page.evaluate(() => (window as any).__cozy.thief());
const chase = (page: Page) => page.evaluate(() => (window as any).__chase ?? null);
const offer = (page: Page) => page.evaluate(() => ({ ...(window as any).__chaseOffer }));
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2')!));
const dialogOpen = (page: Page) => page.evaluate(() => !!(window as any).__game.registry.get('dialogOpen'));

async function boot(ctx: BrowserContext, save = SAVE) {
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('cozy.save.v2', JSON.stringify(s)); localStorage.setItem('cozy.whatsnew.seen', 'x'); }, save);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.evaluate(() => { localStorage.setItem('cozy.whatsnew.seen', 'x'); document.getElementById('whatsnew')?.remove(); });
  await page.waitForTimeout(1200);
  return { page, errors };
}
/** A real finger slide (CDP touch events, like an iPad): hold the finger there until the mount gets there.
 *  (The box renders with a software GPU at a few frames a second, so waits are polls, not fixed sleeps.) */
async function slide(page: Page, ctx: BrowserContext, from: [number, number], to: [number, number], until: (px: number) => boolean, steps = 12) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from[0], y: from[1] }] });
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from[0] + (to[0] - from[0]) * k, y: from[1] + (to[1] - from[1]) * k }] });
    await page.waitForTimeout(30);
  }
  await expect.poll(async () => until((await chase(page)).px), { timeout: 120_000 }).toBe(true);
  const mid = await chase(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  return mid;
}
async function tapCard(page: Page, id: string) {
  await expect.poll(async () => (await chase(page))?.card?.buttons ?? [], { timeout: 180_000 }).toContain(id);
  await page.waitForTimeout(400);
  const at = await page.evaluate((b) => (window as any).__chaseScene.buttonAt(b), id);
  expect(at).not.toBeNull();
  await page.touchscreen.tap(at.x, at.y);
}

test('thief chase: offer, pick a friend, steer, nets hit, catch frees friends', async ({ playwright: _pw }, info) => {
  test.setTimeout(1_800_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const { page, errors } = await boot(ctx);
    expect(await page.evaluate(() => (window as any).__cozy.startThief('fox', 1500, 1))).toBe(true);
    // It runs off with a friend: the offer appears (the puzzle is NOT mixed up yet).
    await expect.poll(async () => (await offer(page)).open, { timeout: 240_000 }).toBe(true);
    const o = await offer(page);
    expect(o.step).toBe('ask');
    const st = (await thief(page)).stolen[0];
    expect(st.kind).toBe('fox');
    let sv = await saved(page);
    expect(sv.stolen).toEqual([st]);
    expect(sv.puzzles[st.puzzle]).toBe(true);
    expect((await thief(page)).chase.pending).toEqual([st.mount]);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/chase-offer.png`, scale: 'css' });
    await page.locator('#chase-offer .o-go').tap();
    // Pick a friend to fly: big tiles of the friends you still have (not the stolen one).
    await expect.poll(async () => (await offer(page)).step, { timeout: 60_000 }).toBe('pick');
    const tiles = (await offer(page)).tiles as string[];
    expect(tiles).not.toContain(st.mount);
    expect(tiles.length).toBe(2); // eagle (theme friend) + the other treasure friend
    await page.screenshot({ path: `${SHOTS}/chase-pick.png`, scale: 'css' });
    const fly = tiles.find((t) => t !== 'eagle')!;
    await page.locator(`#chase-offer .o-tile[data-mount="${fly}"]`).tap();
    await expect.poll(async () => (await chase(page))?.phase, { timeout: 180_000 }).toBe('play');
    let c = await chase(page);
    expect(c.mount).toBe(fly);
    expect(c.kind).toBe('fox');
    expect(c.taken).toEqual([st.mount]);
    expect(await page.evaluate(() => (window as any).__game.scene.isSleeping('world'))).toBe(true);

    // Steer: slide a finger right, then tap the left side.
    await page.evaluate(() => (window as any).__cozy.chaseTune({ autoMs: 1e9 })); // nets only on taps while we steer
    const vw = use.viewport.width, vh = use.viewport.height;
    const mid = await slide(page, ctx, [vw * 0.5, vh * 0.7], [vw * 0.85, vh * 0.7], (px) => px > vw * 0.75);
    expect(mid.px).toBeGreaterThan(vw * 0.75);
    await page.touchscreen.tap(vw * 0.15, vh * 0.7);
    await expect.poll(async () => (await chase(page)).px, { timeout: 120_000 }).toBeLessThan(vw * 0.3);
    c = await chase(page);
    expect(c.nets).toBeGreaterThanOrEqual(2); // a tap throws a net
    // Pause and keep going.
    await page.touchscreen.tap(c.pause.x, c.pause.y);
    await expect.poll(async () => (await chase(page)).paused, { timeout: 60_000 }).toBe(true);
    const t0 = (await chase(page)).t;
    await page.waitForTimeout(800);
    expect((await chase(page)).t).toBe(t0);
    await tapCard(page, 'resume');
    await expect.poll(async () => (await chase(page)).paused, { timeout: 60_000 }).toBe(false);

    // Nets: back on the gentle beat; follow the thief (autopilot stands in for a child's finger).
    await page.evaluate(() => { (window as any).__cozy.chaseTune({ autoMs: 850 }); (window as any).__cozy.chaseAuto(true); });
    await expect.poll(async () => (await chase(page)).hits, { timeout: 240_000 }).toBeGreaterThanOrEqual(2);
    await page.screenshot({ path: `${SHOTS}/chase-mid.png`, scale: 'css' });
    await expect.poll(async () => (await chase(page)).phase, { timeout: 480_000 }).toBe('caught');
    c = await chase(page);
    expect(c.hits).toBe(4);
    expect(c.t).toBeLessThan(50);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${SHOTS}/chase-catch.png`, scale: 'css' });
    await tapCard(page, 'home');
    await expect.poll(async () => (await page.evaluate(() => (window as any).__chaseLast?.result)), { timeout: 90_000 }).toBe('caught');
    await expect.poll(() => page.evaluate(() => (window as any).__game.scene.isActive('world')), { timeout: 90_000 }).toBe(true);
    // Friends are free (no cells), the puzzle is still solved, the fox is in the Thief Jail.
    const t = await thief(page);
    expect(t.stolen).toBeNull();
    expect(t.cells).toEqual([]);
    expect(t.chase.caught).toBe(1);
    sv = await saved(page);
    expect(sv.stolen).toBeUndefined();
    expect(sv.puzzles[st.puzzle]).toBe(true);
    expect(sv.jail.fox.n).toBe(1);
    expect(sv.minor.thief_caught).toBe(1);
    expect(await page.evaluate(() => (window as any).__game.scene.isActive('ui'))).toBe(true);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/chase-home.png`, scale: 'css' });
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});

test('thief chase: "Not now" hides the friend in a cell like before', async ({ playwright: _pw }, info) => {
  test.setTimeout(1_200_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const { page, errors } = await boot(ctx);
    expect(await page.evaluate(() => (window as any).__cozy.startThief('raccoon', 1500, 1))).toBe(true);
    await expect.poll(async () => (await offer(page)).open, { timeout: 240_000 }).toBe(true);
    const st = (await thief(page)).stolen[0];
    await page.locator('#chase-offer .o-no').tap();
    await expect.poll(() => dialogOpen(page), { timeout: 90_000 }).toBe(true);
    const t = await thief(page);
    expect(t.cells).toEqual([st.puzzle]);
    const sv = await saved(page);
    expect(sv.stolen).toEqual([st]);
    expect(sv.puzzles[st.puzzle]).toBeUndefined();
    expect(await page.evaluate(() => (window as any).__game.scene.isActive('chase'))).toBe(false);
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});

test('thief chase: time runs out, it hides your friend, a berry gift for trying', async ({ playwright: _pw }, info) => {
  test.setTimeout(1_200_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const { page, errors } = await boot(ctx, { ...SAVE, art: undefined } as any);
    await page.evaluate(() => (window as any).__cozy.chaseTune({ timeS: 6, autoMs: 1e9 }));
    const r = await page.evaluate(() => (window as any).__cozy.startChase('skunk', 'eagle'));
    expect(r.kind).toBe('skunk');
    expect(r.mount).toBe('eagle');
    await expect.poll(async () => (await chase(page))?.phase, { timeout: 180_000 }).toBe('play');
    await expect.poll(async () => (await chase(page)).phase, { timeout: 240_000 }).toBe('escaped');
    expect((await chase(page)).consolation).toBe(2);
    await expect.poll(async () => (await chase(page))?.card?.title, { timeout: 90_000 }).toBe('So close!');
    await page.screenshot({ path: `${SHOTS}/chase-so-close.png`, scale: 'css' });
    await tapCard(page, 'ok');
    await expect.poll(() => dialogOpen(page), { timeout: 120_000 }).toBe(true);
    const t = await thief(page);
    expect(t.cells).toEqual([r.puzzle]);
    const sv = await saved(page);
    expect(sv.stolen).toEqual([{ mount: r.taken, puzzle: r.puzzle, kind: 'skunk' }]);
    expect(sv.puzzles[r.puzzle]).toBeUndefined();
    expect(sv.berries).toBe(2);
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
