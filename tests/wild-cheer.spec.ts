import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 24: when the lunchbox carrier is found (poofed), the other Wild Woods creatures hop for joy with little hearts.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const wildS = `window.__game.scene.getScene('wild')`;

test('wild cheer: others hop when the carrier is found, then settle', async ({ playwright: _pw }, info) => {
  test.setTimeout(600_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1200);
    for (let i = 0; i < 14 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 650); await page.waitForTimeout(700); }
    await cozy(page, 'enterWild(4242)');
    await expect.poll(async () => (await cozy(page, 'wild()')).on, { timeout: 90_000, intervals: [500] }).toBe(true);
    await page.waitForTimeout(800);
    for (let i = 0; i < 14 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 650); await page.waitForTimeout(700); }

    const info1 = await page.evaluate(`(() => { const w = ${wildS}; return { others: w.monsters.filter((m) => m.alive && m !== w.carrier).length, cheering: w.monsters.filter((m) => m.cheerT > 0 || m.cheerWait > 0).length }; })()`) as any;
    expect(info1.others).toBeGreaterThan(0);
    expect(info1.cheering).toBe(0); // quiet until the carrier is found

    // Stand next to a creature, then find (bop) the carrier twice.
    await page.evaluate(`(() => { const w = ${wildS}; const m = w.monsters.find((q) => q.alive && q !== w.carrier); window.__cozy.wildTeleport(m.x - 90, m.y + 40); })()`);
    await page.waitForTimeout(600);
    await page.evaluate(`(() => { const w = ${wildS}; const c = w.carrier; c.hit(c.x - 40, c.y); c.hit(c.x - 40, c.y); })()`);
    await expect.poll(async () => page.evaluate(`${wildS}.chests.some((c) => c.lunchbox)`), { timeout: 10_000 }).toBe(true);
    await expect.poll(async () => page.evaluate(`${wildS}.monsters.filter((m) => m.alive && (m.cheerT > 0 || m.cheerWait > 0)).length`), { timeout: 5_000 }).toBeGreaterThan(0);
    // Catch one mid-hop (bring it into view for the picture).
    await expect.poll(async () => page.evaluate(`(() => { const w = ${wildS}; const m = w.monsters.find((q) => q.alive && q.cheerT > 300); if (!m) return false; window.__cozy.wildTeleport(m.x - 70, m.y + 50); return true; })()`), { timeout: 8_000, intervals: [100] }).toBe(true);
    await page.waitForTimeout(120);
    await page.screenshot({ path: 'screenshots/wild-cheer.png' });
    // ...and they settle down again.
    await expect.poll(async () => page.evaluate(`${wildS}.monsters.filter((m) => m.alive && (m.cheerT > 0 || m.cheerWait > 0)).length`), { timeout: 15_000 }).toBe(0);
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
