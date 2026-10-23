import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.2 Random start spot: each session starts somewhere new, but only on safe, walkable,
// reachable ground (never water, buildings, trees/rocks or behind the locked gate).
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.START_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const boot = async (page: Page, q = '') => {
  await page.goto(FILE + q);
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(800);
};

test('random start spot: many seeds land on safe ground; session start uses one', async ({ page }) => {
  test.setTimeout(300_000);
  try {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate(() => localStorage.clear());
    await boot(page);

    // Automated runs and brand-new players keep the classic spot by the lantern sign.
    const s0 = await cozy(page, 'state');
    expect(await cozy(page, 'startInfo()')).toMatchObject({ random: false });
    expect([s0.x, s0.y]).toEqual([905, 1330]);

    // Many seeds: every pick is walkable, dry, clear of solids and reachable on foot.
    const r = await cozy(page, 'startSpots(300)');
    expect(r.candidates).toBeGreaterThan(200);
    const bad = r.spots.filter((p: any) => !p.free || p.water || p.solid || !p.reach);
    expect(bad).toEqual([]);
    const distinct = new Set(r.spots.map((p: any) => `${p.x},${p.y}`));
    expect(distinct.size).toBeGreaterThan(150);

    // A real session start with a random spot: player placed there, camera centred on them.
    const vp = page.viewportSize()!;
    const seen: string[] = [];
    for (const seed of [7, 99]) {
      await boot(page, `?start=random&startSeed=${seed}`);
      const info = await cozy(page, 'startInfo()');
      expect(info.random).toBe(true);
      expect(info.fallback).toBe(false);
      const st = await cozy(page, 'state');
      expect(Math.abs(st.x - info.x)).toBeLessThan(4);
      expect(Math.abs(st.y - info.y)).toBeLessThan(4);
      const sc = await cozy(page, `worldToScreen(${st.x}, ${st.y})`);
      expect(sc.x).toBeGreaterThan(vp.width * 0.2); expect(sc.x).toBeLessThan(vp.width * 0.8);
      expect(sc.y).toBeGreaterThan(vp.height * 0.2); expect(sc.y).toBeLessThan(vp.height * 0.8);
      seen.push(`${info.x},${info.y}`);
      await page.screenshot({ path: `${SHOTS}/random-start-${seed}.png` });
    }
    expect(seen[0]).not.toBe(seen[1]);

    // ?start=fixed always keeps the classic spot.
    await boot(page, '?start=fixed');
    expect(await cozy(page, 'startInfo()')).toMatchObject({ random: false });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});
