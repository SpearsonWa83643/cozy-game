import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 187–190: little life 23 — quokka (all themes), axolotl and baby anteater (hidden in snow), lynx kitten in a Christmas hat (snowy themes only).
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

const KINDS: [string, number, string][] = [['quokka', 1, 'quokka'], ['axolotl', 1, 'axolotl'], ['anteater', 1, 'anteater']];

test('little life 23: quokka, axolotl, anteater react to taps; lynx only in snow, axolotl and anteater hide in snow', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  await boot(page, errors);
  const check = async (k: string, min: number, shot: string) => {
    const s0 = await cozy(page, `life2('${k}')`);
    expect(s0.shown, k).toBe(true);
    expect(s0.list.length, k).toBeGreaterThanOrEqual(min);
    for (const q of s0.list) for (const [px, py] of [[5550, 1060], [7300, 3780], [2950, 4500], [7200, 2420]]) expect(Math.hypot(q.hx - px, q.hy - py), k).toBeGreaterThan(260);
    console.log(k, 'at', s0.list.map((q: any) => `${q.hx},${q.hy}`).join(' '));
    const all = await page.evaluate(() => (window as any).__cozy.lifeAll?.() ?? null);
    if (all) for (const q of s0.list) for (const o of all) if (o.kind !== k) expect(Math.hypot(q.hx - o.hx, q.hy - o.hy), `${k} vs ${o.kind}`).toBeGreaterThan(200);
    const c = s0.list[0];
    await cozy(page, `teleport(${c.hx}, ${c.hy + 170})`);
    await expect.poll(async () => (await cozy(page, `life2('${k}')`)).list[0].on, { timeout: 20_000 }).toBe(true);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/${shot}-idle.png` });
    expect(await cozy(page, `life2Tap('${k}', 0)`)).toBe(true);
    expect(await cozy(page, `life2Tap('${k}', 0)`)).toBe(false);
    const s1 = await cozy(page, `life2('${k}')`);
    expect(s1.taps).toBe(1);
    expect(s1.list[0].busy).toBe(true);
    const pose: Record<string, [string, number]> = { quokka: ['ll_quokka_smile', 0.3], axolotl: ['ll_axolotl_wave', 0.4], anteater: ['ll_anteater_achoo', 0.6], lynx: ['ll_lynx_pounce', 0.5] };
    expect(await cozy(page, `life2Hold('${k}', 0, ${pose[k][1]})`)).toBe(true);
    await expect.poll(async () => (await cozy(page, `life2('${k}')`)).list[0].tex, { timeout: 30_000 }).toBe(pose[k][0]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SHOTS}/${shot}-tap.png` });
    expect(await cozy(page, `life2Hold('${k}', 0)`)).toBe(true);
    await expect.poll(async () => (await cozy(page, `life2('${k}')`)).list[0].busy, { timeout: 60_000 }).toBe(false);
  };
  // The lynx stays hidden outside the snowy themes.
  expect((await cozy(page, "life2('lynx')")).shown).toBe(false);
  expect((await cozy(page, "life2('lynx')")).list.every((q: any) => !q.visible)).toBe(true);
  for (const [k, min, shot] of KINDS) await check(k, min, shot);
  await page.evaluate(() => (window as any).__cozy.setTheme?.('winter'));
  await page.waitForTimeout(800);
  expect((await cozy(page, "life2('quokka')")).shown).toBe(true);
  for (const k of ['axolotl', 'anteater']) {
    expect((await cozy(page, `life2('${k}')`)).shown, k).toBe(false);
    expect((await cozy(page, `life2('${k}')`)).list.every((q: any) => !q.visible), k).toBe(true);
  }
  await check('lynx', 1, 'lynx');
  await page.evaluate(() => (window as any).__cozy.setTheme?.('spring'));
  await expect.poll(async () => (await cozy(page, "life2('lynx')")).shown, { timeout: 15_000 }).toBe(false);
  expect((await cozy(page, "life2('lynx')")).list.every((q: any) => !q.visible)).toBe(true);
  for (const k of ['axolotl', 'anteater']) expect((await cozy(page, `life2('${k}')`)).shown, k).toBe(true);
  expect(errors).toEqual([]);
});
