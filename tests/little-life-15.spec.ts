import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 155–158: glade music stones (notes + song, snow caps), drifting hot-air balloon (tap whoosh, theme stripes),
// flower skunk (hidden in snow), snowy arctic fox (snowy themes only).
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.POLISH_SHOTS ?? 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

async function boot(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade', 'river', 'forest', 'orchard', 'lake', 'village', 'meadow', 'grove', 'bay', 'hills'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
}

test('little life 15: music stones, hot-air balloon, flower skunk, snowy arctic fox', async ({ page }) => {
  test.setTimeout(500_000);
  const errors: string[] = [];
  await boot(page, errors);

  // ---- 155 music stones: real touch taps on each stone, then the song.
  const s0 = await cozy(page, 'stones()');
  console.log('stones at', s0.x, s0.y);
  expect(s0.stones.length).toBe(5);
  await cozy(page, 'teleport(7000, 5000)');
  await expect.poll(async () => (await cozy(page, 'stones()')).on, { timeout: 20_000 }).toBe(false);
  expect((await cozy(page, 'stones()')).stones.every((q: any) => !q.visible)).toBe(true);
  await cozy(page, `teleport(${s0.x}, ${s0.y + 130})`);
  await expect.poll(async () => (await cozy(page, 'stones()')).on, { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/stones-idle.png` });
  for (let i = 0; i < 5; i++) {
    const st = (await cozy(page, 'stones()')).stones[i];
    const scr = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y - 12), [st.x, st.y]);
    await page.touchscreen.tap(scr.x, scr.y);
    await expect.poll(async () => (await cozy(page, 'stones()')).taps, { timeout: 15_000 }).toBe(i + 1);
    if (i < 4) { expect((await cozy(page, 'stones()')).stones[i].bouncing).toBe(true); await page.waitForTimeout(250); }
  }
  // All five colors = a song.
  await expect.poll(async () => (await cozy(page, 'stones()')).songs, { timeout: 60_000 }).toBe(1);
  expect((await cozy(page, 'stones()')).singing).toBe(true);
  // No new taps while the song plays.
  expect(await cozy(page, 'stoneTap(0)')).toBe(false);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/stones-tap.png` });
  await expect.poll(async () => (await cozy(page, 'stones()')).singing, { timeout: 90_000 }).toBe(false);
  // Slow taps don't make a song.
  for (let i = 0; i < 3; i++) expect(await cozy(page, `stoneTap(${i})`)).toBe(true);
  expect((await cozy(page, 'stones()')).songs).toBe(1);

  // ---- 156 balloon: launches by itself on a timer, drifts, taps puff it up.
  // The game clock is slow in headless swiftshader, so check the timer ticks down rather than waiting for it.
  const b0 = await cozy(page, 'balloon()');
  expect(b0.pal).toBe('rainbow');
  if (!b0.flying) await expect.poll(async () => (await cozy(page, 'balloon()')).next, { timeout: 30_000 }).toBeLessThan(b0.next);
  // A pass starts just outside the view edge and drifts in.
  const bl = await cozy(page, 'balloonLaunch(true)');
  expect(bl.flying).toBe(true);
  await expect.poll(async () => (await cozy(page, 'balloon()')).x, { timeout: 30_000 }).toBeGreaterThan(bl.x + 5);
  // Put it in the middle of the screen and tap it with a real touch.
  const bx = s0.x + 220, by = s0.y + 100;
  await cozy(page, `balloonAt(${Math.round(bx)}, ${Math.round(by)})`);
  const x0 = (await cozy(page, 'balloon()')).x;
  await expect.poll(async () => (await cozy(page, 'balloon()')).x, { timeout: 30_000 }).toBeGreaterThan(x0 + 3); // it drifts
  await page.waitForTimeout(500);
  const bb = await cozy(page, 'balloon()');
  expect(bb.flying).toBe(true);
  expect(bb.visible).toBe(true);
  await page.screenshot({ path: `${SHOTS}/balloon-idle.png` });
  const bs = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [bb.x, bb.y]);
  await page.touchscreen.tap(bs.x, bs.y);
  await expect.poll(async () => (await cozy(page, 'balloon()')).taps, { timeout: 15_000 }).toBe(1);
  expect((await cozy(page, 'balloon()')).puffing).toBe(true);
  expect(await cozy(page, 'balloonTap()')).toBe(false); // one whoosh at a time
  await expect.poll(async () => (await cozy(page, 'balloon()')).key, { timeout: 15_000 }).toContain('_whoosh');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/balloon-tap.png` });

  // ---- 157 skunk + 158 arctic fox.
  const check = async (k: string, shot: string) => {
    const s = await cozy(page, `life2('${k}')`);
    console.log(k, 'at', s.list.map((q: any) => `${q.hx},${q.hy}`).join(' '));
    expect(s.list.length, k).toBe(1);
    const c = s.list[0];
    await cozy(page, `teleport(${c.hx - 110}, ${c.hy + 70})`);
    await expect.poll(async () => (await cozy(page, `life2('${k}')`)).list[0].on, { timeout: 20_000 }).toBe(true);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/${shot}-idle.png` });
    expect(await cozy(page, `life2Tap('${k}', 0)`)).toBe(true);
    expect(await cozy(page, `life2Tap('${k}', 0)`)).toBe(false);
    const s1 = await cozy(page, `life2('${k}')`);
    expect(s1.taps).toBe(1);
    expect(s1.list[0].busy).toBe(true);
    if (k === 'arcticfox') await expect.poll(async () => (await cozy(page, `life2('${k}')`)).list[0].tex, { timeout: 30_000 }).toBe('ll_afox_dive');
    await page.waitForTimeout(k === 'arcticfox' ? 200 : 500);
    await page.screenshot({ path: `${SHOTS}/${shot}-tap.png` });
    await expect.poll(async () => (await cozy(page, `life2('${k}')`)).list[0].busy, { timeout: 60_000 }).toBe(false);
  };
  expect((await cozy(page, "life2('arcticfox')")).shown).toBe(false);
  expect((await cozy(page, "life2('arcticfox')")).list.every((q: any) => !q.visible)).toBe(true);
  await check('skunk', 'skunk');

  // ---- snowy theme: stones get snow caps, the balloon goes red and green, skunk hides, fox comes out.
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await page.waitForTimeout(800);
  expect((await cozy(page, "life2('skunk')")).shown).toBe(false);
  expect((await cozy(page, "life2('skunk')")).list.every((q: any) => !q.visible)).toBe(true);
  expect((await cozy(page, 'balloon()')).pal).toBe('snowy');
  await check('arcticfox', 'arcticfox');
  await cozy(page, `teleport(${s0.x}, ${s0.y + 130})`);
  await expect.poll(async () => (await cozy(page, 'stones()')).on, { timeout: 20_000 }).toBe(true);
  expect((await cozy(page, 'stones()')).snow).toBe(true);
  expect((await cozy(page, 'stones()')).stones.every((q: any) => q.cap)).toBe(true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/stones-snow.png` });

  // ---- back to spring: fox hides again, skunk returns, caps off.
  await page.evaluate(() => (window as any).__cozy.setTheme?.('spring'));
  await expect.poll(async () => (await cozy(page, "life2('arcticfox')")).shown, { timeout: 15_000 }).toBe(false);
  expect((await cozy(page, "life2('arcticfox')")).list.every((q: any) => !q.visible)).toBe(true);
  expect((await cozy(page, "life2('skunk')")).shown).toBe(true);
  expect((await cozy(page, 'stones()')).stones.every((q: any) => !q.cap)).toBe(true);
  expect(errors).toEqual([]);
});
