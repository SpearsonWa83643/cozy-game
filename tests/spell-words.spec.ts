import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 75: six new picture words (fox, egg, bug, car, owl, pie) in the Letter Easels' free play.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.SPELL_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const lp = (page: Page) => page.evaluate(() => (window as any).__cozyLearn()) as Promise<any>;
const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const NEW = ['fox', 'egg', 'bug', 'car', 'owl', 'pie'];

test('free play: the six new picture words spell with big tiles (egg has two Gs)', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: { spell1: true }, treasures: ['rusty_key', 'letter_block'], fish: {}, minor: {}, visited: ['glade', 'river', 'forest'], chests: ['spell1'], snacks: 0, tips: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1000);
  // Free play draws from the bigger list; open it a few times and every word has a picture.
  const seen = new Set<string>();
  for (let k = 0; k < 4; k++) {
    await cozy(page, "learnOpen('spell1')");
    await expect.poll(async () => (await lp(page)).ready, { timeout: 30_000 }).toBe(true);
    const st = await lp(page);
    expect(st.free).toBe(true);
    for (const w of st.words) seen.add(w);
    await page.touchscreen.tap(mid(st.rects['learn:close']).x, mid(st.rects['learn:close']).y);
    await expect.poll(async () => (await lp(page)).open, { timeout: 20_000 }).toBe(false);
    await page.waitForTimeout(300);
  }
  expect(seen.size).toBeGreaterThanOrEqual(3);
  const pics = await page.evaluate((ws) => ws.map((w) => (window as any).__cozyLearnHasPic?.(w)), NEW);
  expect(pics).toEqual(NEW.map(() => true));

  await cozy(page, "learnOpen('spell1')");
  await expect.poll(async () => (await lp(page)).ready, { timeout: 30_000 }).toBe(true);
  for (const word of NEW) {
    expect(await page.evaluate((w) => (window as any).__cozyLearnWords([w]), word)).toBe(true);
    await expect.poll(async () => (await lp(page)).word, { timeout: 10_000 }).toBe(word);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/spell-words-${word}.png` });
    if (word !== 'egg') continue;
    // Spell E G G with real taps (the second G must be the other tile).
    const W = word.toUpperCase();
    for (let i = 0; i < W.length; i++) {
      const s = await lp(page);
      const ti = s.tiles.findIndex((t: any) => t.letter === W[i] && !t.used);
      expect(ti).toBeGreaterThanOrEqual(0);
      const r = mid(s.rects[`learn:tile:${ti}`]);
      await page.touchscreen.tap(r.x, r.y);
      await expect.poll(async () => (await lp(page)).letter, { timeout: 10_000 }).toBeGreaterThan(i);
    }
    await page.screenshot({ path: `${SHOTS}/spell-words-egg-done.png` });
    await expect.poll(async () => (await lp(page)).open, { timeout: 30_000 }).toBe(false);
    await cozy(page, "learnOpen('spell1')");
    await expect.poll(async () => (await lp(page)).ready, { timeout: 30_000 }).toBe(true);
  }
  expect(errors).toEqual([]);
});
