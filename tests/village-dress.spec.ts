import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 11.7: the village dresses up for the theme. Every 2x2 building gets theme dressing:
// Summer bunting, Fall gourds + corn, Halloween lanterns (+ the old jack/candle), Christmas lights
// + wreaths, Winter snow caps + icicles. Spring/Classic stay plain.
const FILE = pathToFileURL(resolve(process.env.COZY_SINGLE ?? 'dist-single/index.html')).href;
const SHOTS = process.env.DRESS_SHOTS ?? '/workspace/cozy-game/screenshots';
const village = (page: Page) => page.evaluate(() => (window as any).__cozy.village()) as Promise<any>;

const EXPECT: Record<string, string[]> = {
  spring: [],
  classic: [],
  summer: ['f_bunting'],
  fall: ['vd_gourds', 'vd_corn'],
  halloween: ['vd_lanterns'],
  christmas: ['vd_lights'],
  winter: ['vd_icicles'],
};

test('village dresses up for each theme', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({
      v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: ['pantry', 'build', 'village', 'jobs'],
      village: { res: { food: 5, wood: 8, stone: 4 }, buildings: [
        { id: 1, type: 'home', gx: 0, gy: 0 }, { id: 2, type: 'kitchen', gx: 3, gy: 0 }, { id: 3, type: 'workshop', gx: 6, gy: 0 },
        { id: 4, type: 'fishhut', gx: 9, gy: 0 }, { id: 5, type: 'garden', gx: 3, gy: 3 }, { id: 6, type: 'lamp', gx: 7, gy: 3 }],
        villagers: [], nextId: 7, wanderer: 0, events: 0 },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => (window as any).__cozy.teleport(470, 1820));

  const v0 = await village(page);
  expect(v0.buildings.length).toBe(6);

  for (const id of ['spring', 'summer', 'fall', 'halloween', 'christmas', 'winter']) {
    await page.evaluate((t) => (window as any).__cozy.setTheme(t), id);
    await page.waitForTimeout(1200);
    const v = await village(page);
    expect(v.theme).toBe(id);
    for (const b of v.buildings) {
      if (b.type === 'lamp') { expect(b.dress, `${id} lamp`).toEqual([]); continue; }
      for (const k of EXPECT[id]) if (!(id === 'winter' && b.type === 'garden')) expect(b.dress, `${id} ${b.type}`).toContain(k);
      if (!EXPECT[id].length) expect(b.dress, `${id} ${b.type}`).toEqual([]);
    }
    const by = (t: string) => v.buildings.find((b: any) => b.type === t).dress as string[];
    if (id === 'halloween') { expect(by('home')).toContain('h_jack'); expect(by('home')).toContain('h_candle'); }
    if (id === 'christmas') { for (const t of ['home', 'kitchen', 'workshop', 'fishhut']) expect(by(t)).toContain('vd_wreath'); expect(by('garden')).not.toContain('vd_wreath'); }
    if (id === 'winter') {
      for (const t of ['home', 'kitchen', 'fishhut']) expect(by(t)).toContain('vd_snowtri');
      expect(by('workshop')).toContain('vd_snowtrap');
      expect(by('garden')).toContain('vd_snowpile');
      expect(by('garden')).not.toContain('vd_icicles');
    }
    if (id !== 'spring' && id !== 'classic') {
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${SHOTS}/village-dress-${id}.png` });
    }
  }
  // Dressing does not pile up across theme flips.
  await page.evaluate(() => (window as any).__cozy.setTheme('winter'));
  await page.waitForTimeout(600);
  await page.evaluate(() => (window as any).__cozy.setTheme('winter'));
  await page.waitForTimeout(600);
  const home = (await village(page)).buildings.find((b: any) => b.type === 'home');
  expect(home.dress.filter((k: string) => k === 'vd_icicles').length).toBe(1);
  expect(errors).toEqual([]);
});
