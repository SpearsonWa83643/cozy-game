import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = 'screenshots';

const state = (page: Page) => page.evaluate(() => (window as any).__cozy.state);
const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [x, y] as const);
const ui = (page: Page) => page.evaluate(() => {
  const s = (window as any).__game.scene.getScene('ui');
  return { actionShown: s.actionShown, action: s.actionLabel.text, touchMode: s.touchMode,
    vol: { x: s.volC.x, y: s.volC.y }, btn: { x: s.actionC.x, y: s.actionC.y } };
});

/** Drag a virtual-joystick touch with CDP (Playwright only has tap()). */
async function drag(page: Page, x0: number, y0: number, dx: number, dy: number, until: () => Promise<boolean>) {
  const cdp = await page.context().newCDPSession(page);
  const pt = (x: number, y: number) => [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0, y0) });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x0 + (dx * i) / 6, y0 + (dy * i) / 6) });
    await page.waitForTimeout(60);
  }
  const t0 = Date.now();
  while (!(await until()) && Date.now() - t0 < 120_000) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x0 + dx + 0.5, y0 + dy) });
    await page.waitForTimeout(250);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('iPad touch: joystick, tap-to-move, tap objects, action button, volume', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(FILE);
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);
  expect((await ui(page)).touchMode).toBe(true);

  // 1. Floating joystick: drag right from where the thumb lands.
  const s0 = await state(page);
  await drag(page, 420, 600, 70, 0, async () => (await state(page)).x > s0.x + 50);
  expect((await state(page)).x).toBeGreaterThan(s0.x + 50);

  // 2. Tap-to-move with pathing: tap a spot up and to the left.
  const s1 = await state(page);
  const goal = { x: s1.x - 140, y: s1.y - 90 };
  const g = await toScreen(page, goal.x, goal.y);
  await page.touchscreen.tap(g.x, g.y);
  await expect.poll(async () => { const s = await state(page); return Math.hypot(s.x - goal.x, s.y - goal.y); },
    { timeout: 180_000, intervals: [500] }).toBeLessThan(24);

  // 3. Tap the cat from a distance: walk there along a path and pet it.
  await page.evaluate(() => (window as any).__cozy.teleport(660, 720));
  await page.waitForTimeout(800);
  const cat = await toScreen(page, 516, 590);
  await page.touchscreen.tap(cat.x, cat.y);
  await expect.poll(async () => (await state(page)).catPets, { timeout: 240_000, intervals: [500] }).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-01-cottage-cat.png` });

  // 4. Pond life.
  await page.evaluate(() => (window as any).__cozy.teleport(1180, 700));
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-02-pond-life.png` });

  // 5. Contextual action button lights a lantern.
  const L = await page.evaluate(() => (window as any).__cozy.lanterns.find((l: any) => l.id === 'dawn'));
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x + 30, y + 26), [L.x, L.y]);
  await expect.poll(async () => (await ui(page)).actionShown, { timeout: 60_000, intervals: [300] }).toBe(true);
  expect((await ui(page)).action).toBe('Light');
  const btn = (await ui(page)).btn;
  await page.touchscreen.tap(btn.x, btn.y);
  await expect.poll(async () => (await state(page)).litOrder.length, { timeout: 60_000, intervals: [300] }).toBe(1);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/hd-ipad-03-lantern-touch.png` });

  // 6. Volume toggle (touch-sized) cycles on -> quiet.
  const vol = (await ui(page)).vol;
  await page.touchscreen.tap(vol.x, vol.y);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cozy.vol')), { timeout: 30_000 }).toBe('quiet');

  // 7. Keyboard still works as a secondary input (and flips the UI back to keyboard hints).
  const k0 = await state(page);
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await state(page)).y, { timeout: 120_000, intervals: [300] }).toBeGreaterThan(k0.y + 30);
  await page.keyboard.up('ArrowDown');
  expect((await ui(page)).touchMode).toBe(false);

  // 8. Portrait still lays out sensibly.
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/portrait.png', scale: 'css' });

  expect(errors, errors.join('\n')).toEqual([]);
});
