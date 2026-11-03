import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 64: the world is 4x bigger. Four new painted regions (Sunflower Meadow, Pinecone Hills, Glowcap Grove,
// Seashell Bay) join the old map by trails; every old site is still there, everything is walkable from
// the start, and the four 66-67 puzzle clearings stay open.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.WORLD_SHOTS ?? '/workspace/cozy-game/screenshots';
const HUBS: [string, number, number, string][] = [
  ['meadow', 6200, 760, 'Sunflower Meadow'], ['hills', 6300, 2330, 'Pinecone Hills'],
  ['grove', 2200, 4150, 'Glowcap Grove'], ['bay', 6050, 3950, 'Seashell Bay'],
];
const SITES: [number, number][] = [[5550, 1060], [7300, 3780], [2950, 4500], [7200, 2420]];
const OLD: [number, number][] = [[3500, 700], [3760, 1930], [1050, 2240], [4080, 2720], [2140, 1000]];

async function boot(page: Page) {
  await page.goto(FILE);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
}

test('world expansion: 4x map, four new regions linked by trails, puzzle clearings kept', async ({ playwright: _pw }, info) => {
  test.setTimeout(900_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (/atlas/.test(m.text())) console.log(m.text()); });
    try {
      await boot(page);
      const reach = (x: number, y: number) => page.evaluate(([x, y]) => (window as any).__cozy.reachable(x, y), [x, y]);
      // Walkable on foot from the start: every new hub, every reserved puzzle clearing, the old sites.
      for (const [id, x, y] of HUBS) expect(await reach(x, y), id).toBe(true);
      for (const [x, y] of SITES) expect(await reach(x, y), `site ${x},${y}`).toBe(true);
      for (const [x, y] of OLD) expect(await reach(x, y), `old ${x},${y}`).toBe(true);
      expect(await reach(8600, 5800)).toBe(true); // far south-east corner (on land)
      // Each region names itself when you arrive.
      for (const [id, x, y, name] of HUBS) {
        await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y]);
        await expect.poll(async () => (await page.evaluate(() => (window as any).__cozy.state)).area, { timeout: 60_000, intervals: [300] }).toBe(id);
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${SHOTS}/world-${id}.png` });
        console.log(id, name, JSON.stringify(await page.evaluate(() => { const s = (window as any).__cozy.state; return { x: s.x, y: s.y, fps: s.fps, tiles: s.tiles }; })));
      }
      // Down on the bay shore by the lighthouse.
      await page.evaluate(() => (window as any).__cozy.teleport(7180, 4230));
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${SHOTS}/world-bay-shore.png` });
      // The paper map shows the whole (4x) world.
      await page.evaluate(() => (window as any).__menu.show('map'));
      await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOTS}/world-map.png` });
      await page.evaluate(() => (window as any).__menu.close());
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  } finally { await browser.close(); }
});
