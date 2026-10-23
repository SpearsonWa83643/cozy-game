import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 11.9: friends notice the decorations. On a theme change every awake friend hops and up to three
// say a theme line (with hearts). Now and then an idle friend near a dressed house admires it.
const FILE = pathToFileURL(resolve(process.env.COZY_SINGLE ?? 'dist-single/index.html')).href;
const SHOTS = process.env.CHEER_SHOTS ?? '/workspace/cozy-game/screenshots';
const village = (page: Page) => page.evaluate(() => (window as any).__cozy.village()) as Promise<any>;

const CHEER: Record<string, string[]> = {
  summer: ['Sunny fun!', 'Beach day!', 'Yay, summer!'],
  christmas: ['Twinkly lights!', 'Merry, merry!', 'So cozy!'],
  spring: ['Pretty blossoms!', 'Smells like flowers!', 'Hello, spring!'],
};
const ADMIRE: Record<string, string[]> = {
  christmas: ['What a pretty wreath!', 'The lights twinkle!'],
  spring: ['I love the flower box!', 'What pretty blossoms!'],
};
const friend = (id: number, name: string, kind: number) => ({ id, name, trait: 'Always humming', kind, job: null, food: 1, sleep: 1, fun: 1 });

test('villagers cheer for the theme and admire dressed houses', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(([a, b, c]) => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({
      v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: ['pantry', 'build', 'village', 'jobs', 'nearbed'],
      village: { res: { food: 5, wood: 0, stone: 0 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 0 }, { id: 2, type: 'home', gx: 3, gy: 0 }],
        villagers: [a, b, c], nextId: 6, wanderer: 0, events: 0 },
    }));
  }, [friend(3, 'Pip', 0), friend(4, 'Moss', 1), friend(5, 'Bun', 2)]);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => (window as any).__cozy.teleport(470, 1820));
  const v0 = await village(page);
  expect(v0.villagers.length).toBe(3);
  expect(v0.cheers).toBe(0);

  // Theme change: all three hop, each says a theme line.
  let cheers = 0;
  for (const id of ['summer', 'christmas']) {
    await page.evaluate((t) => (window as any).__cozy.setTheme(t), id);
    await page.waitForTimeout(900);
    const mid = await village(page);
    expect(mid.cheering, `${id} hopping`).toBeGreaterThan(0);
    await page.screenshot({ path: `${SHOTS}/cheer-${id}.png` });
    await expect.poll(() => village(page).then((v) => v.cheers)).toBe(cheers + 3);
    cheers += 3;
    const v = await village(page);
    expect(CHEER[id]).toContain(v.said);
    await expect.poll(() => village(page).then((q) => q.cheering), { timeout: 60_000 }).toBe(0);
  }

  // Admire: an idle friend next to a dressed house says something nice about it.
  for (const id of ['christmas', 'spring']) {
    if (id === 'spring') {
      await page.evaluate(() => (window as any).__cozy.setTheme('spring'));
      await expect.poll(() => village(page).then((v) => v.cheers)).toBe(cheers + 3);
      cheers += 3;
      await expect.poll(() => village(page).then((q) => q.cheering), { timeout: 60_000 }).toBe(0);
    }
    const before = (await village(page)).admires;
    await page.evaluate(() => {
      const c = (window as any).__cozy; const h = c.village().buildings[0];
      c.moveVillager(3, h.x + 70, h.y + 110); c.villageAdmire();
    });
    await expect.poll(() => village(page).then((v) => v.admires)).toBe(before + 1);
    expect(ADMIRE[id]).toContain((await village(page)).said);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${SHOTS}/admire-${id}.png` });
    // Rate-limited: no more admiring for a good while without the hook.
    await page.waitForTimeout(5000);
    expect((await village(page)).admires).toBe(before + 1);
  }

  // Cheering never changes needs: still full after all that (they decay slowly on their own).
  const end = await village(page);
  for (const q of end.villagers) expect(q.need.fun).toBeGreaterThan(0.6);
  expect(errors).toEqual([]);
});
