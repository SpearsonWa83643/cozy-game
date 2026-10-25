import { test, expect, chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 13.1: a one-time, gentle nudge about pinch / +- zoom. Never blocks input, fades, shows once.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;

test('zoom hint: shows once after play, pulses the buttons, fades, not again', async ({ playwright: _pw }, info) => {
  test.setTimeout(600_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
    });
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
    const ui = () => page.evaluate(() => {
      const u = (window as any).__game.scene.getScene('ui');
      return { pulsing: u.zoomBtns.pulsing, ms: Math.round(u.zoomHintMs), toast: u.toastText.text, a: u.toastC.alpha };
    });
    // Too early: nothing.
    expect((await ui()).pulsing).toBe(false);
    // Fast-forward the play timer instead of waiting 40 s.
    await page.evaluate(() => { (window as any).__game.scene.getScene('ui').zoomHintMs = 39_900; });
    await page.waitForFunction(() => (window as any).__game.scene.getScene('ui').zoomBtns.pulsing, null, { timeout: 15_000 });
    const on = await ui();
    expect(on.toast).toContain('pinch');
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2')!).tips)).toContain('zoomhint');
    await page.waitForTimeout(700);
    // Zooming with + stops the pulse.
    await page.evaluate(() => (window as any).__game.scene.getScene('ui').zoomBtns.pulse(false));
    await page.evaluate(() => { (window as any).__game.scene.getScene('ui').zoomHintMs = 0; });
    await page.waitForTimeout(500);
    expect((await ui()).pulsing).toBe(false);
    // Once only: even after the timer runs again it never comes back.
    await page.evaluate(() => { (window as any).__game.scene.getScene('ui').zoomHintMs = 45_000; });
    await page.waitForTimeout(1500);
    expect((await ui()).pulsing).toBe(false);
    // Reload: still once only (persisted).
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.evaluate(() => { (window as any).__game.scene.getScene('ui').zoomHintMs = 45_000; });
    await page.waitForTimeout(1500);
    expect((await ui()).pulsing).toBe(false);
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
