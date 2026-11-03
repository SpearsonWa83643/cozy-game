import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 76: Counting Board free play counts a surprise thing each round (shells, stars, strawberries, fish, apples, stones).
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.COUNT_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const np = (page: Page) => page.evaluate(() => (window as any).__cozyNum()) as Promise<any>;
const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const tapRect = async (page: Page, r: any) => { const m = mid(r); await page.touchscreen.tap(m.x, m.y); };
const ALL = ['apple', 'stone', 'shell', 'star', 'berry', 'fish'];

test('free play counts surprise things; the solving round still counts the board\'s own thing', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: { num1: true }, treasures: ['rusty_key', 'abacus'], fish: {}, minor: {}, visited: ['glade', 'river', 'forest'], chests: ['num1'], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1000);
  // Unsolved board: its own thing every round.
  await cozy(page, "learnOpen('num2')");
  await expect.poll(async () => (await np(page)).ready, { timeout: 30_000 }).toBe(true);
  let st = await np(page);
  expect(st.free).toBe(false);
  expect(st.things).toEqual(['stone', 'stone', 'stone']);
  await tapRect(page, st.rects['learn:close']);
  await expect.poll(async () => (await np(page)).open, { timeout: 20_000 }).toBe(false);
  await page.waitForTimeout(800);
  // Solved board: three different surprise things.
  await cozy(page, "learnOpen('num1')");
  await expect.poll(async () => (await np(page)).ready, { timeout: 30_000 }).toBe(true);
  st = await np(page);
  expect(st.free).toBe(true);
  expect(new Set(st.things).size).toBe(3);
  for (const t of st.things) expect(ALL).toContain(t);
  await page.waitForTimeout(600);
  // Answer round 1 with a real tap and check round 2 switches to the next thing.
  await tapRect(page, st.rects[`learn:num:choice:${st.choices.findIndex((c: any) => c.n === st.answer)}`]);
  await expect.poll(async () => (await np(page)).index, { timeout: 30_000 }).toBe(1);
  await expect.poll(async () => (await np(page)).ready, { timeout: 30_000 }).toBe(true);
  expect((await np(page)).thing).toBe(st.things[1]);
  // A photo of each new thing.
  for (const t of ['shell', 'star', 'berry', 'fish']) {
    expect(await page.evaluate(([t]) => (window as any).__cozyNumThing(t, '3+2'), [t])).toBe(true);
    await page.waitForTimeout(500);
    const s = await np(page);
    expect(s.thing).toBe(t);
    expect(s.items).toBe(5);
    await page.screenshot({ path: `${SHOTS}/count-things-${t}.png` });
  }
  expect(errors).toEqual([]);
});
