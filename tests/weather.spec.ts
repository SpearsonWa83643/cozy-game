import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 11.85: the village rainy-day event follows the theme: Spring rain + rainbow, Summer sun shower +
// rainbow, Fall wind, Halloween mist, Christmas/Winter snow. Theme switch mid-event swaps live.
const FILE = pathToFileURL(resolve(process.env.COZY_SINGLE ?? 'dist-single/index.html')).href;
const SHOTS = process.env.WEATHER_SHOTS ?? '/workspace/cozy-game/screenshots';
const village = (page: Page) => page.evaluate(() => (window as any).__cozy.village()) as Promise<any>;
const toast = (page: Page) => page.evaluate(() => (window as any).__game.scene.getScene('ui').toastText.text as string);

const KIND: Record<string, string> = { spring: 'rain', summer: 'sunshower', fall: 'wind', halloween: 'mist', christmas: 'snow', winter: 'snow' };
const START: Record<string, string> = { rain: 'Rainy day', sunshower: 'Sun shower', wind: 'Windy day', mist: 'Misty evening', snow: 'Snowy day' };
const END: Record<string, string> = { rain: 'rainbow', sunshower: 'rainbow', wind: 'wind settled', mist: 'mist drifted', snow: 'snow stopped' };

test('gentle weather follows the theme', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({
      v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: ['pantry', 'build', 'village', 'jobs'],
      village: { res: { food: 5, wood: 8, stone: 4 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 0 }, { id: 2, type: 'kitchen', gx: 3, gy: 0 }], villagers: [], nextId: 3, wanderer: 0, events: 0 },
    }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => (window as any).__cozy.teleport(470, 1820));

  for (const id of ['spring', 'summer', 'fall', 'halloween', 'christmas', 'winter']) {
    await page.evaluate((t) => (window as any).__cozy.setTheme(t), id);
    await page.waitForTimeout(500);
    await page.evaluate(() => (window as any).__cozy.villageEvent('rain'));
    const k = KIND[id];
    await expect.poll(() => village(page).then((v) => v.weather)).toBe(k);
    expect(await toast(page)).toContain(START[k]);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${SHOTS}/weather-${id}.png` });
    const before = (await village(page)).rainbows;
    await page.evaluate(() => (window as any).__cozy.weatherLeft(0.05));
    await expect.poll(() => village(page).then((v) => v.rain)).toBe(false);
    const v = await village(page);
    expect(v.weather).toBeNull();
    expect(await toast(page)).toContain(END[k]);
    expect(v.rainbows - before).toBe(k === 'rain' || k === 'sunshower' ? 1 : 0);
    if (id === 'summer') { await page.waitForTimeout(1800); await page.screenshot({ path: `${SHOTS}/weather-rainbow.png` }); }
  }

  // Switching theme mid-event swaps the look live (snow -> rain), and the event still ends cleanly.
  await page.evaluate(() => (window as any).__cozy.villageEvent('rain'));
  await expect.poll(() => village(page).then((v) => v.weather)).toBe('snow');
  await page.evaluate(() => (window as any).__cozy.setTheme('spring'));
  await expect.poll(() => village(page).then((v) => v.weather)).toBe('rain');
  await page.evaluate(() => (window as any).__cozy.setTheme('halloween'));
  await expect.poll(() => village(page).then((v) => v.weather)).toBe('mist');
  await page.evaluate(() => (window as any).__cozy.weatherLeft(0.05));
  await expect.poll(() => village(page).then((v) => v.weather)).toBeNull();
  expect(errors).toEqual([]);
});
