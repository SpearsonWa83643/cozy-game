import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 97: hills squirrels — nibble, tap = chatter, approach = scamper away, return, hidden in snow.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.POLISH_SHOTS ?? 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;

async function boot(page: Page, errors: string[], visited: string) {
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate((v) => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade', v], chests: [], snacks: 0, tips: [] }));
  }, visited);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
}

test('hills squirrels: idle, chatter, scamper away, come back, hidden in winter', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  await boot(page, errors, 'hills');
  const s0 = await cozy(page, 'squirrels()');
  expect(s0.shown).toBe(true);
  expect(s0.list.length).toBeGreaterThanOrEqual(3);
  const cones = await cozy(page, 'pinecones()');
  for (const s of s0.list) for (const c of cones.list) expect(Math.hypot(s.hx - c.x, s.hy - c.y)).toBeGreaterThan(70);
  const k = s0.list[0];
  await cozy(page, `teleport(${k.hx}, ${k.hy - 165})`);
  await expect.poll(async () => (await cozy(page, 'squirrels()')).list[0].on, { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/squirrels-idle.png` });
  expect(await cozy(page, 'squirrelTap(0)')).toBe(true);
  expect((await cozy(page, 'squirrels()')).taps).toBe(1);
  await expect.poll(async () => (await cozy(page, 'squirrels()')).chats, { timeout: 10_000 }).toBeGreaterThan(0);
  await cozy(page, `teleport(${k.hx - 60}, ${k.hy})`);
  await expect.poll(async () => (await cozy(page, 'squirrels()')).flees, { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${SHOTS}/squirrels-dash.png` });
  await expect.poll(async () => (await cozy(page, 'squirrels()')).list[0].away, { timeout: 30_000 }).toBe(true);
  await cozy(page, `teleport(${k.hx}, ${k.hy - 420})`);
  await expect.poll(async () => { const s = (await cozy(page, 'squirrels()')).list[0]; return !s.away && !s.hopping && s.x === s.hx && s.y === s.hy; }, { timeout: 60_000 }).toBe(true);
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await expect.poll(async () => (await cozy(page, 'squirrels()')).shown, { timeout: 15_000 }).toBe(false);
  expect((await cozy(page, 'squirrels()')).list.every((q: any) => !q.visible)).toBe(true);
  expect(errors).toEqual([]);
});
