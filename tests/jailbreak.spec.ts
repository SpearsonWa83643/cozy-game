import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 55 (Walker, Nov 2): jailbreaks. Once per play session at most (never with a thief about), a jailed thief
// sneaks out (a dug tunnel or a picked padlock) with a cheeky toast; its cell shows it escaped; it comes back
// later as a normal thief event, and catching it puts it back in its cell.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.THIEF_SHOTS ?? '/workspace/cozy-game/screenshots';
const KEY = 'cozy.save.v2';
const thief = (page: Page) => page.evaluate(() => (window as any).__cozy.thief());
const info = (page: Page) => page.evaluate(() => (window as any).__cozy.jailbreakInfo());
const jb = (page: Page, ...a: any[]) => page.evaluate((a) => (window as any).__cozy.jailbreak(...a), a);
const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), KEY);
const toasts = (page: Page) => page.evaluate(() => (window as any).__toasts ?? []);
const ready = async (page: Page) => {
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.evaluate(() => { const w = window as any; w.__toasts = []; w.__game.events.on('toast', (t: string) => w.__toasts.push(t)); });
  await page.waitForTimeout(1200);
};
async function catchIt(page: Page, kind: string) {
  await expect.poll(async () => (await thief(page)).state, { timeout: 90_000 }).toBe('sneak');
  expect((await thief(page)).kind).toBe(kind);
  await page.waitForTimeout(1400);
  for (let i = 0; i < 40 && (await thief(page)).state === 'sneak'; i++) {
    const s = (await thief(page)).screen;
    if (s) await page.touchscreen.tap(s.x, s.y);
    await page.waitForTimeout(250);
  }
  expect((await thief(page)).state).toBe('caught');
  await expect.poll(async () => (await thief(page)).state, { timeout: 30_000 }).toBe('off');
}

test('jailbreak: once per session, escaped cell, sneaks back, caught again', async ({ playwright: _pw }, ti) => {
  test.setTimeout(900_000);
  const use = ti.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate((k) => {
      localStorage.clear();
      localStorage.setItem(k, JSON.stringify({ v: 2, theme: 'spring', puzzles: { trail: true, stones: true }, treasures: ['pterodactyl_egg', 'rainbow_horseshoe'], fish: {}, minor: { thief_caught: 3 }, jail: { raccoon: { n: 2 }, fox: { n: 1 } }, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
    }, KEY);
    await page.reload();
    await ready(page);
    let j = await info(page);
    expect(j).toMatchObject({ broke: false, can: true, nextCheck: 240 });

    // Never while another thief is about.
    await expect.poll(() => page.evaluate(() => (window as any).__cozy.startThief('bunny', 60000)), { timeout: 20_000 }).toBe(true);
    await expect.poll(async () => (await thief(page)).state, { timeout: 20_000 }).toBe('sneak');
    expect(await jb(page, 'raccoon', 'tunnel', 3)).toBe(false);
    expect((await info(page)).broke).toBe(false);
    await catchIt(page, 'bunny');

    // The natural roll: force the next check now with a lucky roll.
    await page.evaluate(() => { const t = (window as any).__game.scene.getScene('world').thief; t.jb.nextCheck = t.jb.played + 0.2; const r = Math.random; Math.random = () => 0.01; setTimeout(() => { Math.random = r; }, 4000); });
        await expect.poll(async () => (await info(page)).broke, { timeout: 30_000 }).toBe(true);
    j = await info(page);
    expect(j.checks).toBe(1);
    expect(['raccoon', 'fox', 'bunny']).toContain(j.kind);
    expect(j.jail[j.kind].out).toBe(true);
    expect((await toasts(page)).some((t: string) => /dug a tiny tunnel|picked the padlock/.test(t))).toBe(true);
    // At most once per session.
    expect(await jb(page, 'fox', 'lock')).toBe(false);
    const first = j.kind;

    // It sneaks back as a normal thief event: catch it and it is back in its cell.
    await page.evaluate(() => { const t = (window as any).__game.scene.getScene('world').thief; t.jb.backAt = t.jb.played + 1; });

    await catchIt(page, first);
    expect((await toasts(page)).some((t: string) => /is sneaking back!/.test(t))).toBe(true);
    await page.waitForTimeout(600);
    let sv = await stored(page);
    expect(sv.jail[first].out).toBeUndefined();
    expect((await info(page)).returned).toBe(1);

    // A new play session: the hook forces a padlock jailbreak of the Raccoon.
    await page.reload();
    await ready(page);
    expect(await jb(page, 'raccoon', 'lock', 9999)).toBe(true);
    await expect.poll(async () => (await stored(page)).jail.raccoon, { timeout: 5_000 }).toMatchObject({ out: true, how: 'lock' });
    expect(await jb(page, 'fox', 'tunnel')).toBe(false);
    // The jail shows the escaped cell.
    await page.evaluate(() => (window as any).__menu.openJail());
    await expect.poll(() => page.evaluate(() => (window as any).__menu.stableView)).toBe('jail');
    await page.waitForTimeout(800);
    const cell = await page.evaluate(() => { const c = (window as any).__menu.jailCells.find((q: any) => q.id === 'raccoon'); return { out: c.out, how: c.how, img: !!c.img }; });
    expect(cell).toEqual({ out: true, how: 'lock', img: false });
    const r = await page.evaluate(() => (window as any).__menu.rects['jail:raccoon']);
    await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => (window as any).__menu.lastJail)).toMatchObject({ id: 'raccoon', act: 'escaped' });
    await page.screenshot({ path: `${SHOTS}/thief-escaped.png`, scale: 'css' });
    await page.evaluate(() => (window as any).__menu.hide?.() ?? (window as any).__menu.close?.());
    const close = await page.evaluate(() => (window as any).__menu.rects.close);
    if (await page.evaluate(() => (window as any).__menu.open)) await page.touchscreen.tap(close.x + close.w / 2, close.y + close.h / 2);
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(false);

    // Still out after a reload (persisted); the mask button's next thief is the escaped one.
    await page.reload();
    await ready(page);
    expect((await stored(page)).jail.raccoon.out).toBe(true);
    j = await info(page);
    expect(j).toMatchObject({ broke: false, can: false, kind: 'raccoon' });
    const n0 = (await stored(page)).jail.raccoon.n;
    await expect.poll(() => page.evaluate(() => (window as any).__cozy.startThief()), { timeout: 20_000 }).toBe(true);
    await catchIt(page, 'raccoon');
    await page.waitForTimeout(600);
    sv = await stored(page);
    expect(sv.jail.raccoon.n).toBe(n0 + 1);
    expect(sv.jail.raccoon.out).toBeUndefined();
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
