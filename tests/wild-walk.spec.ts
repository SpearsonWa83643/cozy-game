import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Wild Woods walking feels exactly like the glade: drag to steer at full speed, taps path around
// trees, ponds slide, and a ground tap next to a monster is a walk (not a bop).
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const state = (page: Page) => cozy(page, 'state');
const wild = (page: Page) => cozy(page, 'wild()');
async function closeDialogs(page: Page) {
  for (let i = 0; i < 14 && (await state(page)).dialogOpen; i++) { await page.touchscreen.tap(590, 650); await page.waitForTimeout(700); }
}

test('wild woods: same touch controls + movement as the glade', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);
  await closeDialogs(page);
  await page.evaluate(() => (window as any).__cozy.teleport(4080, 2800));
  await page.waitForTimeout(2000);
  await closeDialogs(page);
  for (let i = 0; i < 4 && !(await wild(page)).on && !(await wild(page)).inWild; i++) {
    const p = await page.evaluate(() => (window as any).__cozy.worldToScreen(4080, 2680));
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(2500);
    await closeDialogs(page);
  }
  await expect.poll(async () => (await wild(page)).on, { timeout: 60_000, intervals: [500] }).toBe(true);
  await page.waitForTimeout(1500);
  // Calm, monster-free test: park every monster far away.
  await page.evaluate(() => { const w = (window as any).__game.scene.getScene('wild'); for (const m of w.monsters) { m.alive = false; m.img.setVisible(false); } });

  // 1. Tap straight through a tree: the hero paths around it and arrives (no snagging).
  const leg = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene('wild');
    const free = (x: number, y: number) => { if (x < 300 || y < 300 || x > w.map.w - 300 || y > w.map.h - 300) return false; const [c, r] = w.nav.cellOf(x, y); return !w.nav.isBlocked(c, r); };
    for (const t of w.map.props) {
      if (t.kind !== 'tree') continue;
      const a = [t.x, t.y + 60], b = [t.x, t.y - 70];
      if (free(a[0], a[1]) && free(b[0], b[1]) && !w.nav.clearLine(a[0], a[1], b[0], b[1])) return { a, b };
    }
    return null;
  });
  expect(leg, 'a tree with open ground on both sides').not.toBeNull();
  await page.evaluate(([x, y]) => (window as any).__cozy.wildTeleport(x, y), leg!.a);
  await page.waitForTimeout(2000);
  const tp = await page.evaluate(([x, y]) => (window as any).__cozy.wildToScreen(x, y), leg!.b);
  await page.touchscreen.tap(tp.x, tp.y);
  await expect.poll(async () => (await wild(page)).path, { timeout: 10_000 }).toBeGreaterThan(1);
  await expect.poll(async () => { const p = (await wild(page)).player; return Math.hypot(p[0] - leg!.b[0], p[1] - leg!.b[1]); }, { timeout: 60_000 }).toBeLessThan(24);

  // 2. Drag to steer: floating joystick, glade speed (175).
  const cdp = await page.context().newCDPSession(page);
  const pt = (x: number, y: number) => [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
  const p0 = (await wild(page)).player;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(500, 500) });
  for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(500 + i * 15, 500) }); await page.waitForTimeout(50); }
  let top = 0;
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(150); const s = await wild(page); top = Math.max(top, s.speed); expect(s.stick).toBe(true); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  expect(top).toBeGreaterThan(150);
  expect(top).toBeLessThan(185);
  await expect.poll(async () => (await wild(page)).stick).toBe(false);
  const p1 = (await wild(page)).player;
  expect(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])).toBeGreaterThan(40);

  // 3. A ground tap right next to a monster walks there; only tapping the monster itself bops.
  const r = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene('wild');
    const m = w.monsters[0]; m.alive = true; m.img.setVisible(true);
    w.feet.setPosition(m.x - 150, m.y); w.body.reset(m.x - 150, m.y); w.lastSafe = [m.x - 150, m.y];
    const b = m.img.getBounds();
    w.tapAt(b.right + 16, m.y);
    const ground = { chasing: !!w.chase, path: w.path.length };
    w.tapAt(b.centerX, b.centerY);
    return { ground, onMonster: !!w.chase };
  });
  expect(r.ground.chasing).toBe(false);
  expect(r.ground.path).toBeGreaterThan(0);
  expect(r.onMonster).toBe(true);
  expect(errors).toEqual([]);
});
