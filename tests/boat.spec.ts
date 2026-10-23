import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.35 Boats slice 1: tap the moored rowboat to climb in, row by tapping the water (or dragging),
// stay on the water, tap the shore to hop out. Pond and lake.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.BOAT_SHOTS ?? '/workspace/cozy-game/screenshots';
const boat = (page: Page) => page.evaluate(() => (window as any).__cozy.boat());
const st = (page: Page) => page.evaluate(() => (window as any).__cozy.state);

async function boot(page: Page) {
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
}
/** A real touch tap on a world point. */
async function tapWorld(page: Page, x: number, y: number) {
  await page.waitForTimeout(300); // let the camera settle
  const p = await page.evaluate(([a, b]) => (window as any).__cozy.worldToScreen(a, b), [x, y]);
  await page.touchscreen.tap(p.x, p.y);
}

async function tryWater(page: Page, idx: number, shot: string | null, fishShot: string | null = null) {
  const b0 = (await boat(page)).boats[idx];
  // Stand on the bank next to the boat, then tap the boat.
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), b0.stand);
  await page.waitForTimeout(800);
  await tapWorld(page, b0.x, b0.y - 20);
  await expect.poll(async () => (await boat(page)).active, { timeout: 30_000, intervals: [250] }).toBe(true);
  const s1 = await st(page);
  expect(Math.hypot(s1.x - b0.x, s1.y - b0.y)).toBeLessThan(40);
  expect((await page.evaluate(() => (window as any).__cozy.mount())).canCall).toBe(false);
  // Row: tap a water point further out.
  const out = await page.evaluate(([i]) => (window as any).__cozy.boatProbe(i), [idx]);
  expect(out).not.toBeNull();
  await tapWorld(page, out[0], out[1]);
  await expect.poll(async () => { const s = await st(page); return Math.hypot(s.x - out[0], s.y - out[1]); }, { timeout: 40_000, intervals: [300] }).toBeLessThan(40);
  const s2 = await st(page);
  const onWater = await page.evaluate(([x, y]) => (window as any).__cozy.waterAt(x, y), [s2.x, s2.y]);
  expect(onWater).toBe(b0.water);
  // The boat carries you (once you've come to a stop; while moving it is drawn with the player sprite, a frame behind physics).
  await expect.poll(() => page.evaluate((i) => { const c = (window as any).__cozy; const b = c.boat().boats[i]; const s = c.state; return Math.hypot(b.x - s.x, b.y - s.y); }, idx), { timeout: 20_000, intervals: [300] }).toBeLessThan(4);
  if (shot) await page.screenshot({ path: `${SHOTS}/${shot}` });
  // Slice 2: tap your own boat to cast a line off the bow into open water.
  if (fishShot) {
    const bs = await boat(page);
    expect(bs.castSpot).not.toBeNull();
    expect(await page.evaluate(([x, y]) => (window as any).__cozy.waterAt(x, y), bs.castSpot)).toBe(b0.water);
    const rb = bs.boats[idx];
    await tapWorld(page, rb.x, rb.y - 20);
    await expect.poll(async () => (await st(page)).fishing, { timeout: 20_000, intervals: [250] }).toMatch(/cast|wait|bite/);
    await expect.poll(async () => (await st(page)).fishing, { timeout: 20_000, intervals: [250] }).toMatch(/wait|bite/);
    expect((await boat(page)).active).toBe(true);
    await page.screenshot({ path: `${SHOTS}/${fishShot}` });
    // Tap again to bring the line back in (or play out a bite) before rowing home.
    for (let k = 0; k < 40 && (await st(page)).fishing !== 'idle'; k++) { await tapWorld(page, b0.stand[0], b0.stand[1]); await page.waitForTimeout(400); }
    expect((await st(page)).fishing).toBe('idle');
    expect((await boat(page)).active).toBe(true);
  }
  // Tap a far land point (beyond the water): row to the edge and hop out on dry land.
  await tapWorld(page, b0.stand[0], b0.stand[1]);
  await expect.poll(async () => (await boat(page)).active, { timeout: 40_000, intervals: [300] }).toBe(false);
  await page.waitForTimeout(800);
  const s3 = await st(page);
  const wet = await page.evaluate(([x, y]) => (window as any).__cozy.waterAt(x, y), [s3.x, s3.y]);
  expect(wet).toBeNull();
  // The boat stayed in the water where you left it.
  const b3 = (await boat(page)).boats[idx];
  expect(await page.evaluate(([x, y]) => (window as any).__cozy.waterAt(x, y), [b3.x, b3.y])).toBe(b0.water);
}

test('boats: climb in, row on the pond and the lake, hop out on the shore', async ({ playwright: _pw }, info) => {
  test.setTimeout(600_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await boot(page);
      const b = await boat(page);
      console.log('boats', JSON.stringify(b.boats));
      expect(b.boats.map((x: any) => x.water)).toEqual(['pond', 'lake']);
      expect(b.active).toBe(false);
      await tryWater(page, 0, 'boat-pond.png', 'boat-fishing.png');
      await tryWater(page, 1, 'boat-lake.png');
      const end = await boat(page);
      expect(end.boards).toBe(2);
      expect(end.hops).toBe(2);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  } finally { await browser.close(); }
});
