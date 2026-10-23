import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 9.15 HUD theme picker: one round button shows the current theme; tap fans out the others,
// tap one to switch, tap elsewhere to fold away (no walking). Big iPad targets, clear of other HUD buttons.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.THEME_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const hud = (page: Page) => cozy(page, 'themeHud()');
type R = { x: number; y: number; w: number; h: number };
const tapRect = (page: Page, r: R) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
const overlap = (a: R, b: R) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('HUD theme picker: fan out, switch, fold away', async ({ page }) => {
  test.setTimeout(300_000);
  try {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1200);
    await cozy(page, "setTheme('spring')");
    await page.waitForTimeout(400);

    let h = await hud(page);
    expect(h.open).toBe(false);
    expect(h.current).toBe('spring');
    expect(h.rects.btn.w).toBeGreaterThanOrEqual(64);
    // Clear of the zoom buttons and other HUD buttons.
    for (const b of (await cozy(page, 'zoomInfo()')).buttons as R[]) expect(overlap(h.rects.btn, b)).toBe(false);

    // Tap: the five other themes fan out.
    await tapRect(page, h.rects.btn);
    await expect.poll(async () => (await hud(page)).open, { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(500);
    h = await hud(page);
    expect(Object.keys(h.rects).filter((k) => k !== 'btn').sort()).toEqual(['christmas', 'fall', 'halloween', 'summer', 'winter']);
    for (const k of ['christmas', 'fall', 'halloween', 'summer', 'winter']) expect(h.rects[k].w).toBeGreaterThanOrEqual(64);
    await page.screenshot({ path: `${SHOTS}/theme-hud-open.png` });

    // Pick Halloween: theme switches, picker folds.
    await tapRect(page, h.rects.halloween);
    await expect.poll(async () => (await hud(page)).current, { timeout: 10_000 }).toBe('halloween');
    h = await hud(page);
    expect(h.open).toBe(false);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('willowmere-save') ?? localStorage.getItem(Object.keys(localStorage)[0]) ?? '{}').theme ?? null)).not.toBe('spring');

    // Open again: now Spring is offered and Halloween is not; tapping elsewhere folds it away without walking.
    await tapRect(page, h.rects.btn);
    await expect.poll(async () => (await hud(page)).open, { timeout: 10_000 }).toBe(true);
    h = await hud(page);
    expect(Object.keys(h.rects).filter((k) => k !== 'btn').sort()).toEqual(['christmas', 'fall', 'spring', 'summer', 'winter']);
    const s0 = await cozy(page, 'state');
    await page.touchscreen.tap(700, 600);
    await expect.poll(async () => (await hud(page)).open, { timeout: 10_000 }).toBe(false);
    await page.waitForTimeout(800);
    const s1 = await cozy(page, 'state');
    expect(Math.hypot(s1.x - s0.x, s1.y - s0.y)).toBeLessThan(4);
    expect(s1.pathLen).toBe(0);

    // Tapping the main button twice opens and closes; the theme stays put.
    await tapRect(page, h.rects.btn);
    await expect.poll(async () => (await hud(page)).open, { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(300);
    await tapRect(page, h.rects.btn);
    await expect.poll(async () => (await hud(page)).open, { timeout: 10_000 }).toBe(false);
    expect((await hud(page)).current).toBe('halloween');

    // Switch to Christmas for the screenshot.
    await tapRect(page, h.rects.btn);
    await expect.poll(async () => (await hud(page)).open, { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(400);
    await tapRect(page, (await hud(page)).rects.christmas);
    await expect.poll(async () => (await hud(page)).current, { timeout: 10_000 }).toBe('christmas');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/theme-hud-christmas.png` });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});
