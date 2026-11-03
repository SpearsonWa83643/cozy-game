import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 67: counting boards for young kids. Tap the board, count the apples (or stones), tap the big number.
// A wrong number wiggles, then everything counts itself out and the right number glows. No fail state.
// Three sums fill three stars and pop a chest with a treasure (Little Abacus / Counting Star).
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.NUM_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const np = (page: Page) => page.evaluate(() => (window as any).__cozyNum()) as Promise<any>;
const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [x, y] as const) as Promise<{ x: number; y: number }>;
const tapWorld = async (page: Page, x: number, y: number) => { const p = await toScreen(page, x, y); await page.touchscreen.tap(p.x, p.y); };
const tp = async (page: Page, x: number, y: number) => { await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y] as const); await page.waitForTimeout(450); };
const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const tapRect = async (page: Page, r: any) => { const m = mid(r); await page.touchscreen.tap(m.x, m.y); };
const ansI = (st: any) => st.choices.findIndex((c: any) => c.n === st.answer);

test('counting board: 3 sums with big number buttons, count-along hints, chest + Little Abacus', async ({ page }) => {
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
  expect(Object.keys(L).sort()).toEqual(['num1', 'num2', 'spell1', 'spell2']);
  const { x, y } = L.num1;

  // 1. Walk up to the grove counting board and tap it (real touch).
  await tp(page, x, y + 45);
  await expect.poll(async () => (await cozy(page, 'state')).prompt, { timeout: 30_000 }).toBe('Play');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/num-01-board.png` });
  await tapWorld(page, x, y - 50);
  await expect.poll(async () => (await np(page)).open, { timeout: 60_000, intervals: [300] }).toBe(true);
  let st = await np(page);
  expect(st.free).toBe(false);
  expect(st.probs).toEqual(['1+2', '2+3', '4-1']);
  expect(st.prob).toBe('1+2');
  expect(st.answer).toBe(3);
  expect(st.items).toBe(3);
  expect(st.choices.length).toBe(4);
  expect(new Set(st.choices.map((c: any) => c.n)).size).toBe(4);
  expect(ansI(st)).toBeGreaterThanOrEqual(0);
  // The spelling board stays shut; huge tap targets (>= 90 CSS px) for every number.
  expect(await page.evaluate(() => (window as any).__cozyLearn().open)).toBe(false);
  for (const [k, r] of Object.entries<any>(st.rects)) if (k.startsWith('learn:num:choice:')) { expect(r.w).toBeGreaterThanOrEqual(90); expect(r.h).toBeGreaterThanOrEqual(90); }
  await expect.poll(async () => (await np(page)).ready, { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(800);

  // 2. Tap an apple to count it.
  await tapRect(page, st.rects['learn:num:item:1']);
  await expect.poll(async () => (await np(page)).lastCount, { timeout: 20_000 }).toBe(2);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}/num-02-count.png` });

  // 3. A wrong number: it wiggles, no fail; we count together and the right one glows.
  const wrongI = st.choices.findIndex((c: any) => c.n !== st.answer);
  await tapRect(page, st.rects[`learn:num:choice:${wrongI}`]);
  await expect.poll(async () => (await np(page)).wrong, { timeout: 20_000 }).toBe(1);
  st = await np(page);
  expect(st.open).toBe(true);
  expect(st.choices[wrongI].dim).toBe(true);
  await expect.poll(async () => (await np(page)).choices[ansI(st)].hint, { timeout: 60_000, intervals: [400] }).toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/num-03-hint.png` });

  const answer = async (prob: string) => {
    await expect.poll(async () => (await np(page)).prob, { timeout: 30_000 }).toBe(prob);
    await expect.poll(async () => (await np(page)).ready, { timeout: 30_000 }).toBe(true);
    const s = await np(page);
    await tapRect(page, s.rects[`learn:num:choice:${ansI(s)}`]);
    await expect.poll(async () => (await np(page)).index, { timeout: 20_000 }).toBeGreaterThan(s.index);
  };
  await answer('1+2');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/num-04-yay.png` });
  expect((await cozy(page, 'learn()')).num1.done).toBe(1);

  // 4. Closing keeps your place: reopen and carry on with 2 + 3.
  await expect.poll(async () => (await np(page)).prob, { timeout: 30_000 }).toBe('2+3');
  await expect.poll(async () => (await np(page)).ready, { timeout: 30_000 }).toBe(true);
  await tapRect(page, (await np(page)).rects['learn:close']);
  await expect.poll(async () => (await np(page)).open, { timeout: 20_000 }).toBe(false);
  await page.waitForTimeout(800);
  await cozy(page, "learnOpen('num1')");
  await expect.poll(async () => (await np(page)).prob, { timeout: 30_000 }).toBe('2+3');
  expect((await np(page)).items).toBe(5);
  await answer('2+3');
  // 5. Take away: 4 - 1 shows 4 apples, 1 floats off.
  await expect.poll(async () => (await np(page)).prob, { timeout: 30_000 }).toBe('4-1');
  st = await np(page);
  expect(st.items).toBe(4);
  expect(st.leaving).toBe(1);
  expect(st.answer).toBe(3);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/num-05-takeaway.png` });
  await answer('4-1');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/num-06-done.png` });

  // 6. Solved: the board closes and a chest pops up beside it.
  await expect.poll(async () => (await np(page)).open, { timeout: 60_000 }).toBe(false);
  await expect.poll(async () => (await cozy(page, 'learn()')).num1.revealed, { timeout: 30_000 }).toBe(true);
  expect((await cozy(page, 'state')).puzzles.num1).toBe(true);
  expect((await cozy(page, 'chests()')).num1).toBe(true);
  const [cx, cy] = (await cozy(page, 'learn()')).num1.chest;
  await tp(page, cx, cy + 36);
  await expect.poll(async () => (await cozy(page, 'state')).prompt, { timeout: 20_000 }).toBe('Open');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/num-07-chest.png` });
  await tapWorld(page, cx, cy - 20);
  await expect.poll(async () => (await cozy(page, 'state')).treasures, { timeout: 30_000 }).toContain('abacus');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${SHOTS}/num-08-treasure.png` });

  // 7. The hills pebble board counts stones with its own sums; num1 is now free play.
  await page.evaluate(() => (window as any).__cozy.closeDialog?.());
  await cozy(page, "learnOpen('num2')");
  await expect.poll(async () => (await np(page)).open, { timeout: 30_000 }).toBe(true);
  expect((await np(page)).probs).toEqual(['3+1', '5-2', '2+4']);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/num-09-pebbles.png` });
  await expect.poll(async () => (await np(page)).ready, { timeout: 30_000 }).toBe(true);
  await tapRect(page, (await np(page)).rects['learn:close']);
  await expect.poll(async () => (await np(page)).open, { timeout: 20_000 }).toBe(false);
  await page.waitForTimeout(400);
  await cozy(page, "learnOpen('num1')");
  await expect.poll(async () => (await np(page)).free, { timeout: 30_000 }).toBe(true);
  expect((await np(page)).probs.length).toBe(3);

  // 8. Stays solved after reload.
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  const L2 = await cozy(page, 'learn()');
  expect(L2.num1.solved).toBe(true);
  expect(L2.num1.opened).toBe(true);
  expect(L2.num2.solved).toBe(false);
  expect(errors).toEqual([]);
});
