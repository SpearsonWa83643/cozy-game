import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 66: letter-easel spelling sites for young kids. Tap the easel, then tap (or drag) big letter tiles
// to spell the pictured word. A wrong tile wiggles home and the right one glows + its ghost shows.
// Three words fill three stars and pop a chest with a treasure (ABC Block -> ABC scarf).
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.SPELL_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const lp = (page: Page) => page.evaluate(() => (window as any).__cozyLearn()) as Promise<any>;
const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [x, y] as const) as Promise<{ x: number; y: number }>;
const tapWorld = async (page: Page, x: number, y: number) => { const p = await toScreen(page, x, y); await page.touchscreen.tap(p.x, p.y); };
const tp = async (page: Page, x: number, y: number) => { await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y] as const); await page.waitForTimeout(450); };
const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const tileFor = (st: any, letter: string, used = false) => st.tiles.findIndex((t: any) => t.letter === letter && t.used === used);

test('letter easel: spell 3 words with big tiles, gentle hints, chest + ABC Block', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: ['rusty_key'], fish: {}, minor: {}, visited: ['glade', 'river', 'forest'], chests: [], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  const L = await cozy(page, 'learn()');
  expect(Object.keys(L).sort()).toEqual(['spell1', 'spell2']);
  const { x, y } = L.spell1;

  // 1. Walk up to the meadow easel and tap it (real touch).
  await tp(page, x, y + 70);
  await expect.poll(async () => (await cozy(page, 'state')).prompt, { timeout: 30_000 }).toBe('Play');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/spell-01-easel.png` });
  await tapWorld(page, x, y - 50);
  await expect.poll(async () => (await lp(page)).open, { timeout: 60_000, intervals: [300] }).toBe(true);
  let st = await lp(page);
  expect(st.free).toBe(false);
  expect(st.words).toEqual(['cat', 'sun', 'dog']);
  expect(st.tiles.length).toBe(6);
  // Huge tap targets: every tile is at least 90 CSS px on an iPad.
  for (const [k, r] of Object.entries<any>(st.rects)) if (k.startsWith('learn:tile:')) { expect(r.w).toBeGreaterThanOrEqual(90); expect(r.h).toBeGreaterThanOrEqual(90); }
  await page.waitForTimeout(800);

  // 2. A wrong letter: no fail, it wiggles home and the right "C" glows, with a ghost C in slot 1.
  const wrongI = st.tiles.findIndex((t: any) => !'CAT'.includes(t.letter));
  await page.touchscreen.tap(mid(st.rects[`learn:tile:${wrongI}`]).x, mid(st.rects[`learn:tile:${wrongI}`]).y);
  await expect.poll(async () => (await lp(page)).wrong, { timeout: 20_000 }).toBe(1);
  st = await lp(page);
  expect(st.letter).toBe(0);
  expect(st.tiles[tileFor(st, 'C')].hint).toBe(true);
  expect(st.ghost[0]).toBe(true);
  expect(st.open).toBe(true);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/spell-02-hint.png` });

  // 3. Drag the C up into the first slot (mouse drag), then tap A and T.
  const cR = mid(st.rects[`learn:tile:${tileFor(st, 'C')}`]);
  const s0 = mid(st.rects['learn:slot:0']);
  await page.mouse.move(cR.x, cR.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(cR.x + ((s0.x - cR.x) * i) / 8, cR.y + ((s0.y - cR.y) * i) / 8); await page.waitForTimeout(60); }
  await page.mouse.up();
  await expect.poll(async () => (await lp(page)).letter, { timeout: 20_000 }).toBe(1);
  const spellRest = async (word: string, from: number) => {
    for (let i = from; i < word.length; i++) {
      const s = await lp(page);
      const ti = tileFor(s, word[i]);
      expect(ti).toBeGreaterThanOrEqual(0);
      const r = mid(s.rects[`learn:tile:${ti}`]);
      await page.touchscreen.tap(r.x, r.y);
      await expect.poll(async () => { const q = await lp(page); return q.word !== word.toLowerCase() ? 99 : q.letter; }, { timeout: 20_000 }).toBeGreaterThan(i);
      if (i === 1 && word === 'CAT') await page.screenshot({ path: `${SHOTS}/spell-03-board.png` });
    }
  };
  await spellRest('CAT', 1);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/spell-04-yay.png` });
  await expect.poll(async () => (await lp(page)).word, { timeout: 30_000 }).toBe('sun');
  expect((await cozy(page, 'learn()')).spell1.done).toBe(1);

  // 4. Closing keeps your place: reopen and carry on with SUN.
  await page.touchscreen.tap(mid((await lp(page)).rects['learn:close']).x, mid((await lp(page)).rects['learn:close']).y);
  await expect.poll(async () => (await lp(page)).open, { timeout: 20_000 }).toBe(false);
  await page.waitForTimeout(800);
  await cozy(page, "learnOpen('spell1')");
  await expect.poll(async () => (await lp(page)).word, { timeout: 30_000 }).toBe('sun');
  await page.waitForTimeout(600);
  await spellRest('SUN', 0);
  await expect.poll(async () => (await lp(page)).word, { timeout: 30_000 }).toBe('dog');
  await page.waitForTimeout(600);
  await spellRest('DOG', 0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/spell-05-done.png` });

  // 5. Solved: the board closes and a chest pops up beside the easel.
  await expect.poll(async () => (await lp(page)).open, { timeout: 60_000 }).toBe(false);
  await expect.poll(async () => (await cozy(page, 'learn()')).spell1.revealed, { timeout: 30_000 }).toBe(true);
  expect((await cozy(page, 'state')).puzzles.spell1).toBe(true);
  expect((await cozy(page, 'chests()')).spell1).toBe(true);
  const [cx, cy] = (await cozy(page, 'learn()')).spell1.chest;
  await tp(page, cx, cy + 50);
  await expect.poll(async () => (await cozy(page, 'state')).prompt, { timeout: 20_000 }).toBe('Open');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/spell-06-chest.png` });
  await tapWorld(page, cx, cy - 20);
  await expect.poll(async () => (await cozy(page, 'state')).treasures, { timeout: 30_000 }).toContain('letter_block');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${SHOTS}/spell-07-treasure.png` });

  // 6. The seaside easel has its own words; once solved, play is just for fun.
  await page.evaluate(() => (window as any).__cozy.closeDialog?.());
  await cozy(page, "learnOpen('spell2')");
  await expect.poll(async () => (await lp(page)).open, { timeout: 30_000 }).toBe(true);
  expect((await lp(page)).words).toEqual(['hat', 'bee', 'cup']);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/spell-08-seaside.png` });
  await page.touchscreen.tap(mid((await lp(page)).rects['learn:close']).x, mid((await lp(page)).rects['learn:close']).y);
  await expect.poll(async () => (await lp(page)).open, { timeout: 20_000 }).toBe(false);
  await page.waitForTimeout(400);
  await cozy(page, "learnOpen('spell1')");
  await expect.poll(async () => (await lp(page)).free, { timeout: 30_000 }).toBe(true);

  // 7. Stays solved after reload; chest stays open.
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  const L2 = await cozy(page, 'learn()');
  expect(L2.spell1.solved).toBe(true);
  expect(L2.spell1.opened).toBe(true);
  expect(L2.spell2.solved).toBe(false);
  expect(errors).toEqual([]);
});
