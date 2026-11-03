import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 68: the world feels alive. Villagers and critters stroll the trails between regions, butterflies
// over the meadow and hills, soft clouds drift over with their shadows, each region has little sounds.
// Everything is pooled (a fixed number of objects) and hidden off-screen.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.ALIVE_SHOTS ?? '/tmp/wgl/shots';
const alive = (page: Page) => page.evaluate(() => (window as any).__cozy.alive());
const tp = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y]);

async function boot(page: Page) {
  await page.goto(FILE);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
}

test('alive: travellers on the trails, butterflies, clouds, region sounds (pooled + culled)', async ({ playwright: _pw }, info) => {
  test.setTimeout(900_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await boot(page);
      const s0 = await alive(page);
      expect(s0.walkers).toBe(12);
      // In the glade at the start, most far-off travellers are hidden (culled).
      expect(s0.walkersOnScreen).toBeLessThan(4);
      const objs = s0.objects;
      // Walk up to the meadow traveller: on screen, and actually strolling along the trail.
      const near = async (i: number) => {
        const [x, y] = (await alive(page)).walkerPos[i];
        await tp(page, x + 140, y + 40);
        await expect.poll(async () => (await alive(page)).walkerPos[i][3], { timeout: 60_000, intervals: [300] }).toBe(1);
      };
      await near(0);
      const a = (await alive(page)).walkerPos;
      await page.waitForTimeout(6000);
      const b = (await alive(page)).walkerPos;
      const moved = a.filter((p: any, i: number) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) > 2).length;
      expect(moved).toBeGreaterThanOrEqual(6);
      // Butterflies flutter over the meadow.
      await expect.poll(async () => (await alive(page)).flies, { timeout: 60_000, intervals: [500] }).toBeGreaterThan(0);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOTS}/alive-meadow.png` });
      // A cloud drifts over somewhere with its shadow, sooner or later.
      await expect.poll(async () => (await alive(page)).puffs, { timeout: 120_000, intervals: [1000] }).toBeGreaterThan(0);
      // Other trails: hills villager, the bay walker, the grove walker.
      for (const [i, id] of [[2, 'hills'], [4, 'bay'], [5, 'grove']] as const) {
        await near(i);
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${SHOTS}/alive-${id}.png` });
      }
      // Each region has its own little sounds (scheduled while you're there; audio may be locked here).
      for (const [id, x, y] of [['meadow', 6200, 760], ['hills', 6300, 2330], ['grove', 2200, 4150], ['bay', 6050, 3950]] as const) {
        await tp(page, x, y);
        await expect.poll(async () => (await page.evaluate(() => (window as any).__cozy.state)).area, { timeout: 60_000, intervals: [300] }).toBe(id);
        await expect.poll(async () => (await alive(page)).due[id] ?? 0, { timeout: 180_000, intervals: [1000] }).toBeGreaterThan(0);
      }
      // Pooled: nothing new gets made as you travel around.
      expect((await alive(page)).objects).toBe(objs);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  } finally { await browser.close(); }
});
