import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Numbered sequence puzzles on iPad: clue cards on signs, number badges on the objects that
// turn into checks as each step is done, in Classic and Halloween.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const state = (page: Page) => cozy(page, 'state');
const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [x, y] as const) as Promise<{ x: number; y: number }>;
const teleport = async (page: Page, x: number, y: number, settle = 1500) => {
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y] as const);
  await page.waitForTimeout(settle);
};
const tapWorld = async (page: Page, x: number, y: number) => { const p = await toScreen(page, x, y); await page.touchscreen.tap(p.x, p.y); };
const seqCards = (page: Page) => page.evaluate(() => Object.keys((window as any).__game.scene.getScene('ui').rects).filter((k) => k.startsWith('seq')).length);
const badges = (page: Page) => page.evaluate(() => {
  const w = (window as any).__game.scene.getScene('world');
  return { lanterns: w.lanterns.map((l: any) => l.badge.state), pots: w.puzzles.pots.map((p: any) => p.badge.state), bells: w.puzzles.bells.map((b: any) => b.badge.state) };
});
async function closeDialogs(page: Page) {
  for (let i = 0; i < 12 && (await state(page)).dialogOpen; i++) { await page.touchscreen.tap(590, 300); await page.waitForTimeout(500); }
}
async function readSign(page: Page, x: number, y: number) {
  for (let i = 0; i < 4 && !(await state(page)).dialogOpen; i++) { await tapWorld(page, x, y - 24); await page.waitForTimeout(1500); }
  await expect.poll(() => state(page).then((s) => s.dialogOpen), { timeout: 30_000 }).toBe(true);
}

test('numbered sequences: sign cards, object badges, step checks, both themes', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);

  // 1. Lantern sign: three big numbered cards (1 dawn, 2 noon, 3 dusk).
  await teleport(page, 905, 500);
  await readSign(page, 905, 430);
  await expect.poll(() => seqCards(page), { timeout: 10_000 }).toBe(3);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v6-01-sign-numbers.png` });
  await closeDialogs(page);

  // 2. Light dawn (1): its badge turns into a check. Then noon (2).
  const L = await cozy(page, 'lanterns');
  const at = (id: string) => L.find((l: any) => l.id === id);
  expect((await badges(page)).lanterns.every((s: string) => s === 'todo')).toBe(true);
  for (const id of ['dawn', 'noon']) {
    const l = at(id);
    await teleport(page, l.x, l.y + 50);
    for (let i = 0; i < 4 && !(await state(page)).litOrder.includes(id); i++) { await tapWorld(page, l.x, l.y - 30); await page.waitForTimeout(1500); }
    await expect.poll(async () => (await state(page)).litOrder, { timeout: 30_000 }).toContain(id);
  }
  const lb = await badges(page);
  expect(lb.lanterns.filter((s: string) => s === 'done').length).toBe(2);
  // Stand between noon (lit, check) and dusk (3, waiting) for the object shot.
  const noon = at('noon'), dusk = at('dusk');
  await teleport(page, (noon.x + dusk.x) / 2 - 60, (noon.y + dusk.y) / 2 + 40, 2500);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v6-02-lanterns-numbers.png` });

  // 3. Flower pots in Halloween: numbered pots, one fixed (check), and the pot sign's cards.
  await cozy(page, "setTheme('halloween')");
  await teleport(page, 245, 880, 2500);
  for (let g = 0; g < 8 && (await cozy(page, 'pots()'))[0] !== 0; g++) {
    const c0 = (await cozy(page, 'pots()'))[0];
    await tapWorld(page, 175, 756);
    await expect.poll(async () => (await cozy(page, 'pots()'))[0], { timeout: 30_000, intervals: [200] }).not.toBe(c0);
  }
  await expect.poll(async () => (await badges(page)).pots[0], { timeout: 10_000 }).toBe('done');
  await page.waitForTimeout(6000); // ground repaint + cross-fade
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v6-03-pots-halloween.png` });
  await teleport(page, 140, 860);
  await readSign(page, 120, 790);
  await expect.poll(() => seqCards(page), { timeout: 10_000 }).toBe(4);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-v6-04-pot-sign-halloween.png` });
  await closeDialogs(page);

  // 4. Bells carry their tune order; the sign shows 4 cards. Back to Classic (live toggle).
  expect((await badges(page)).bells.length).toBe(4);
  await cozy(page, "setTheme('classic')");
  await teleport(page, 3470, 2150);
  await readSign(page, 3470, 2080);
  await expect.poll(() => seqCards(page), { timeout: 10_000 }).toBe(4);
  await closeDialogs(page);
  expect((await cozy(page, 'village()')).theme).toBe('classic');
  expect(errors).toEqual([]);
});
