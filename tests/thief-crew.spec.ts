import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 56 (Walker, Nov 2): seven more masked thieves, each with its own look, mask color, voice and giggles.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.THIEF_SHOTS ?? '/workspace/cozy-game/screenshots';
const thief = (page: Page) => page.evaluate(() => (window as any).__cozy.thief());
const NEW = ['squirrel', 'hedgehog', 'otter', 'skunk', 'possum', 'badger', 'duckling'];

test('thief crew: 13 masked thieves, a lineup, new thieves giggle their own lines', async ({ playwright: _pw }, info) => {
  test.setTimeout(900_000);
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
      localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: { trail: true, stones: true }, treasures: ['pterodactyl_egg', 'rainbow_horseshoe'], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
    });
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1500);
    const t0 = await thief(page);
    expect(t0.kinds.length).toBe(13);
    for (const k of NEW) expect(t0.kinds).toContain(k);
    // Every thief has its own painted texture.
    const tex = await page.evaluate((ids) => ids.map((id: string) => { const g = (window as any).__game; const key = `thief_${id}`; return g.textures.exists(key) || Object.values(g.textures.list).some((t: any) => t.has?.(key)); }), t0.kinds);
    expect(tex.every(Boolean)).toBe(true);
    const ids = await page.evaluate(() => (window as any).__cozy.thiefLineup(20000));
    expect(ids.length).toBe(13);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/thief-lineup.png`, scale: 'css' });

    // A new thief (the Duckling) giggles its own line when tapped.
    expect(await page.evaluate(() => (window as any).__cozy.startThief('duckling', 60000))).toBe(true);
    await expect.poll(async () => (await thief(page)).state, { timeout: 20_000 }).toBe('sneak');
    expect((await thief(page)).kind).toBe('duckling');
    await page.waitForTimeout(2500);
    for (let i = 0; i < 30 && (await thief(page)).giggles < 1; i++) {
      const s = (await thief(page)).screen;
      if (s) await page.touchscreen.tap(s.x, s.y);
      await page.waitForTimeout(300);
    }
    const t1 = await thief(page);
    expect(t1.giggles).toBe(1);
    expect(['Quack quack!', 'Waddle waddle!', 'Peep peep!', 'Splash dash!']).toContain(t1.lastGiggle);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/thief-duckling.png`, scale: 'css' });
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
