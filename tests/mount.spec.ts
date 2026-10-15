import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Mounts: Call Mount -> eagle swoops in -> ride a wandering path -> tap ground to hop off;
// tap the eagle for a short whoosh with a cooldown. iPad touch config.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.MOUNT_SHOTS ?? 'test-results';
const mount = (page: Page) => page.evaluate(() => (window as any).__cozy.mount());
const st = (page: Page) => page.evaluate(() => (window as any).__cozy.state);
const rect = (page: Page, id: string) => page.evaluate((id) => (window as any).__vui.rects[id], id) as Promise<{ x: number; y: number; w: number; h: number }>;
const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [x, y] as const) as Promise<{ x: number; y: number }>;
const tapRect = async (page: Page, id: string) => { const r = await rect(page, id); await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2); };

test('mount: call eagle, ride, tap eagle for whoosh, tap ground to hop off', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
  await page.waitForTimeout(800);

  // 1) Button visible; tap it: the eagle swoops in.
  expect((await mount(page)).canCall).toBe(true);
  await tapRect(page, 'mount');
  await expect.poll(async () => (await mount(page)).phase, { timeout: 5000, intervals: [100] }).toBe('arrive');
  // Mid-swoop shot (the box GPU is slow, so wait on game progress, not wall time).
  await expect.poll(async () => (await mount(page)).seg ?? 0, { timeout: 60_000, intervals: [100] }).toBeGreaterThan(0.72);
  await page.screenshot({ path: `${SHOTS}/mount-call-classic.png` });

  // 2) Picked up and riding: the player moves with the eagle along its wandering path.
  await expect.poll(async () => (await mount(page)).phase, { timeout: 60_000, intervals: [200] }).toBe('ride');
  const s0 = await st(page);
  await expect.poll(async () => { const s = await st(page); return Math.hypot(s.x - s0.x, s.y - s0.y); }, { timeout: 90_000, intervals: [500] }).toBeGreaterThan(150);
  const m1 = await mount(page);
  expect(m1.riderOn).toBe(true);
  expect(m1.alt).toBeGreaterThan(40);
  // The camera follows the ground point under the eagle.
  const s1 = await st(page);
  expect(Math.hypot(s1.x - m1.ground[0], s1.y - m1.ground[1])).toBeLessThan(30);
  await expect.poll(async () => (await mount(page)).alt, { timeout: 30_000, intervals: [300] }).toBeGreaterThan(60);
  await page.screenshot({ path: `${SHOTS}/mount-riding-classic.png` });

  // Halloween look while riding (subtle tint), then back to Classic.
  await page.evaluate(() => (window as any).__cozy.setTheme('halloween'));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/mount-riding-halloween.png` });
  await page.evaluate(() => (window as any).__cozy.setTheme('classic'));
  expect((await mount(page)).phase).toBe('ride');

  // 3) Tap the eagle: a few seconds of whoosh. Tapping again right away does nothing (cooldown).
  const tapEagle = async () => { const m = await mount(page); const p = await toScreen(page, m.eagle[0], m.eagle[1] - 6); await page.touchscreen.tap(p.x, p.y); };
  await tapEagle();
  await expect.poll(async () => (await mount(page)).fast, { timeout: 10_000, intervals: [100] }).toBe(true);
  await expect.poll(async () => (await mount(page)).speed, { timeout: 30_000, intervals: [200] }).toBeGreaterThan(250);
  expect((await mount(page)).phase).toBe('ride');
  await page.screenshot({ path: 'test-results/mount-fast-classic.png' });
  await tapEagle();
  await page.waitForTimeout(600);
  const mf = await mount(page);
  expect(mf.boosts).toBe(1);
  expect(mf.cooldown).toBeGreaterThan(0);
  await expect.poll(async () => (await mount(page)).fast, { timeout: 90_000, intervals: [300] }).toBe(false);
  expect((await mount(page)).cooldown).toBeGreaterThan(0);

  // 4) Tap the ground away from the eagle: it lands near there, you hop off, it flies away.
  const m2 = await mount(page);
  const e = await toScreen(page, m2.eagle[0], m2.eagle[1]);
  const gx = Math.min(950, Math.max(260, e.x + (e.x < 590 ? 260 : -260))), gy = Math.min(600, Math.max(200, e.y + 140));
  await page.touchscreen.tap(gx, gy);
  await expect.poll(async () => (await mount(page)).phase, { timeout: 10_000, intervals: [100] }).toBe('land');
  await expect.poll(async () => (await mount(page)).landings, { timeout: 90_000, intervals: [200] }).toBe(1);
  const m3 = await mount(page);
  const s3 = await st(page);
  expect(m3.riderOn).toBe(false);
  expect(m3.reachableHere).toBe(true);
  expect(Math.hypot(s3.x - m3.dropAt[0], s3.y - m3.dropAt[1])).toBeLessThan(6);
  await expect.poll(async () => (await mount(page)).phase, { timeout: 60_000, intervals: [200] }).toBe('off');
  // On foot again: mount is free to call, player is not riding. (Tap-to-move is flaky on the box GPU at ~2 FPS.)
  expect((await mount(page)).canCall).toBe(true);
  expect((await mount(page)).riderOn).toBe(false);
  await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
  await expect.poll(async () => Math.round((await st(page)).x), { timeout: 10_000, intervals: [100] }).toBe(905);

  // 5) Build mode while riding: you are set down first; Call Mount hides in build mode.
  await tapRect(page, 'mount');
  await expect.poll(async () => (await mount(page)).riderOn, { timeout: 60_000, intervals: [200] }).toBe(true);
  await tapRect(page, 'build');
  await expect.poll(async () => (await page.evaluate(() => (window as any).__cozy.village())).building, { timeout: 10_000, intervals: [100] }).toBe(true);
  expect((await mount(page)).carrying).toBe(false);
  expect((await mount(page)).canCall).toBe(false);
  await expect.poll(() => page.evaluate(() => (window as any).__vui.mountC.visible), { timeout: 10_000, intervals: [100] }).toBe(false);
  await tapRect(page, 'build');
  await expect.poll(async () => (await page.evaluate(() => (window as any).__cozy.village())).building, { timeout: 10_000, intervals: [100] }).toBe(false);
  await expect.poll(() => page.evaluate(() => (window as any).__vui.mountC.visible), { timeout: 10_000, intervals: [100] }).toBe(true);
  expect(errors).toEqual([]);
});
