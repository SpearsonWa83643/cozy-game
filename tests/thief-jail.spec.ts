import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 54 (Walker, Nov 2): a Thief Jail page, reached from the stable. Every caught thief gets a cozy cell
// (name, species, times caught). Tap one and it talks: cheeky, a wave, sorry, a sulk. Share a berry.
// Old saves seed the jail from minor.thief_caught.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.THIEF_SHOTS ?? '/workspace/cozy-game/screenshots';
const KEY = 'cozy.save.v2';
const thief = (page: Page) => page.evaluate(() => (window as any).__cozy.thief());
const rect = (page: Page, k: string) => page.evaluate((k) => (window as any).__menu.rects[k], k);
const tap = async (page: Page, k: string) => {
  const r = await rect(page, k);
  expect(r, k).toBeTruthy();
  await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
  await page.waitForTimeout(450);
};
const cells = (page: Page) => page.evaluate(() => (window as any).__menu.jailCells.map((c: any) => ({ id: c.id, n: c.n, fed: c.fed, out: c.out, nick: c.nick, species: c.species, img: !!c.img })));
const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), KEY);

test('thief jail: seeded from old saves, arrests land in jail, tap to talk, share a berry, persists', async ({ playwright: _pw }, info) => {
  test.setTimeout(900_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    // An old save: 3 thieves caught before the jail existed, no `jail` key, one berry + one apple.
    await page.evaluate((k) => {
      localStorage.clear();
      localStorage.setItem(k, JSON.stringify({ v: 2, theme: 'spring', puzzles: { trail: true, stones: true }, treasures: ['pterodactyl_egg', 'rainbow_horseshoe'], fish: {}, minor: { thief_caught: 3 }, visited: ['glade'], chests: [], snacks: 2, berries: 1, tips: [] }));
    }, KEY);
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1500);

    // Migration: the 3 old catches fill the first cells.
    await page.evaluate(() => (window as any).__menu.show('stable'));
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(true);
    const jb = await rect(page, 'jail:open');
    expect(jb.w).toBeGreaterThanOrEqual(120); expect(jb.h).toBeGreaterThanOrEqual(44);
    await tap(page, 'jail:open');
    await expect.poll(() => page.evaluate(() => (window as any).__menu.stableView)).toBe('jail');
    let c = await cells(page);
    expect(c.length).toBe(13);
    expect(c.filter((q) => q.n > 0).map((q) => q.id)).toEqual(['raccoon', 'fox', 'bunny']);
    expect(c[0]).toMatchObject({ nick: 'Rascal', species: 'Raccoon', n: 1, img: true });
    expect(await page.evaluate(() => (window as any).__menu.jailTitle)).toContain('3 / 13');
    // Back to the stable.
    await tap(page, 'jail:back');
    expect(await page.evaluate(() => (window as any).__menu.stableView)).toBe('barn');
    const close = await rect(page, 'close');
    await page.touchscreen.tap(close.x + close.w / 2, close.y + close.h / 2);
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open), { timeout: 30_000 }).toBe(false);

    // Catch a squirrel and a second raccoon: both go to the jail.
    for (const kind of ['squirrel', 'raccoon']) {
      await expect.poll(() => page.evaluate((k) => (window as any).__cozy.startThief(k, 60000), kind), { timeout: 20_000 }).toBe(true);
      await expect.poll(async () => (await thief(page)).state, { timeout: 20_000 }).toBe('sneak');
      await page.waitForTimeout(1400);
      for (let i = 0; i < 40 && (await thief(page)).state === 'sneak'; i++) {
        const s = (await thief(page)).screen;
        if (s) await page.touchscreen.tap(s.x, s.y);
        await page.waitForTimeout(250);
      }
      expect((await thief(page)).state).toBe('caught');
      await expect.poll(async () => (await thief(page)).state, { timeout: 30_000 }).toBe('off');
    }
    let sv = await stored(page);
    expect(sv.jail.squirrel.n).toBe(1);
    expect(sv.jail.raccoon.n).toBe(2);
    expect(sv.minor.thief_caught).toBe(5);

    // Persists across a reload (not re-seeded).
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => (window as any).__menu.openJail());
    await expect.poll(() => page.evaluate(() => (window as any).__menu.stableView)).toBe('jail');
    await page.waitForTimeout(800);
    c = await cells(page);
    expect(c.filter((q) => q.n > 0).map((q) => q.id)).toEqual(['raccoon', 'fox', 'bunny', 'squirrel']);
    expect(c.find((q) => q.id === 'raccoon')!.n).toBe(2);
    expect(c.find((q) => q.id === 'otter')).toMatchObject({ n: 0, img: false });
    expect(await page.evaluate(() => (window as any).__menu.jailTitle)).toContain('Caught 5 times');
    await page.screenshot({ path: `${SHOTS}/thief-jail.png`, scale: 'css' });

    // Tap a thief: cheeky, wave, sorry, sulk (in turn), each with a speech line.
    const acts: string[] = [];
    for (let i = 0; i < 4; i++) {
      await tap(page, 'jail:squirrel');
      const lj = await page.evaluate(() => (window as any).__menu.lastJail);
      expect(lj.id).toBe('squirrel');
      expect(lj.line.length).toBeGreaterThan(3);
      acts.push(lj.act);
      if (i === 0) { await page.waitForTimeout(200); await page.screenshot({ path: `${SHOTS}/thief-jail-talk.png`, scale: 'css' }); }
      await page.waitForTimeout(900);
    }
    expect(acts).toEqual(['cheeky', 'wave', 'sorry', 'sulk']);
    // An empty cell just gives a friendly hint.
    await tap(page, 'jail:otter');

    // Share a berry, then an apple, then the basket is empty.
    await tap(page, 'jail:raccoon');
    await tap(page, 'jailberry:raccoon');
    expect(await page.evaluate(() => (window as any).__menu.lastJail)).toMatchObject({ id: 'raccoon', act: 'berry' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/thief-jail-berry.png`, scale: 'css' });
    // Keep sharing until the basket is empty: a friendly 'no berries' line.
    let fed = 1;
    for (let i = 0; i < 8; i++) {
      await tap(page, 'jailberry:raccoon');
      const lj = await page.evaluate(() => (window as any).__menu.lastJail);
      if (lj.act === 'nofruit') break;
      expect(lj.act).toBe('berry'); fed++;
    }
    expect(await page.evaluate(() => (window as any).__menu.lastJail)).toMatchObject({ act: 'nofruit' });
    expect(fed).toBeGreaterThanOrEqual(2);
    sv = await stored(page);
    expect(sv.jail.raccoon.fed).toBe(fed);
    expect(sv.snacks).toBe(0);
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
