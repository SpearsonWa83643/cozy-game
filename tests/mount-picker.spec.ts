import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Order 14: with only the eagle unlocked, Call Mount rides straight away.
// After granting the pterodactyl egg, Call Mount opens a picker; tap pterodactyl to ride it.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.MOUNT_SHOTS ?? 'test-results';
const mount = (page: Page) => page.evaluate(() => (window as any).__cozy.mount());
const rect = (page: Page, id: string) => page.evaluate((id) => (window as any).__vui.rects[id], id) as Promise<{ x: number; y: number; w: number; h: number }>;
const tapRect = async (page: Page, id: string) => { const r = await rect(page, id); await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2); };

test('mount picker: eagle alone skips picker; pterodactyl unlock shows picker', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1000);
  // Dismiss What's new if showing.
  await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
  await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
  await page.waitForTimeout(500);

  // 1) Only eagle unlocked: Call Mount goes straight to arrive (no picker).
  expect((await mount(page)).canCall).toBe(true);
  await tapRect(page, 'mount');
  await expect.poll(async () => (await mount(page)).phase, { timeout: 8000, intervals: [100] }).toBe('arrive');
  expect(await page.evaluate(() => !!(window as any).__vui.mountPicker)).toBe(false);
  expect((await mount(page)).id).toBe('eagle');
  // Wait for pickup, then tap ground to hop off so we can unlock the next mount.
  await expect.poll(async () => (await mount(page)).phase, { timeout: 90_000, intervals: [200] }).toBe('ride');
  await page.evaluate(() => {
    const m = (window as any).__cozy.mount();
    (window as any).__cozy.mountTap(m.ground[0] + 100, m.ground[1] + 80);
  });
  await expect.poll(async () => (await mount(page)).phase, { timeout: 120_000, intervals: [300] }).toBe('off');

  // 2) Grant pterodactyl egg: Call Mount opens the picker with both tiles.
  await page.evaluate(() => (window as any).__cozy.giveTreasure('pterodactyl_egg'));
  await page.waitForTimeout(300);
  expect((await mount(page)).canCall).toBe(true);
  await tapRect(page, 'mount');
  await expect.poll(() => page.evaluate(() => !!(window as any).__vui.mountPicker), { timeout: 10_000, intervals: [100] }).toBe(true);
  await expect.poll(() => page.evaluate(() => !!(window as any).__vui.rects['mountPick:pterodactyl']), { timeout: 5000 }).toBe(true);
  expect(await page.evaluate(() => !!(window as any).__vui.rects['mountPick:eagle'])).toBe(true);
  await page.screenshot({ path: `${SHOTS}/mount-picker-classic.png` });

  // 3) Tap pterodactyl tile: it swoops in as the pterodactyl.
  await tapRect(page, 'mountPick:pterodactyl');
  await expect.poll(async () => (await mount(page)).phase, { timeout: 10_000, intervals: [100] }).toBe('arrive');
  expect((await mount(page)).id).toBe('pterodactyl');
  await expect.poll(async () => (await mount(page)).phase, { timeout: 90_000, intervals: [200] }).toBe('ride');
  expect((await mount(page)).riderOn).toBe(true);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/mount-ptero-riding-classic.png` });
  // Hop off.
  await page.evaluate(() => {
    const m = (window as any).__cozy.mount();
    (window as any).__cozy.mountTap(m.ground[0] + 120, m.ground[1] + 80);
  });
  await expect.poll(async () => (await mount(page)).landings, { timeout: 90_000, intervals: [200] }).toBeGreaterThan(0);
  await expect.poll(async () => (await mount(page)).phase, { timeout: 60_000, intervals: [200] }).toBe('off');
  expect(errors).toEqual([]);
});
