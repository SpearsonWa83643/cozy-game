import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 78 (Walker, Nov 3): "our mount is kidnapped but is not found at the puzzle given, seems stuck".
// Every hiding place is a real puzzle you can walk to, with a cell right beside it; solving it and tapping the
// cell frees the friend. A broken saved hiding place heals itself on load, and "Free my friends" in the Map's
// settings gear brings everyone home (with a Yes / No first).
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.HR_SHOTS ?? resolve('screenshots');
const HIDE_IDS = ['pots', 'bells', 'tiles', 'dig', 'stones', 'trail', 'spell1', 'spell2', 'num1', 'num2'];
const rect = (page: Page, k: string) => page.evaluate((k) => (window as any).__menu.rects[k], k);
const tap = async (page: Page, k: string) => {
  const r = await rect(page, k);
  expect(r, k).toBeTruthy();
  await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
  await page.waitForTimeout(400);
};
const thief = (page: Page) => page.evaluate(() => (window as any).__cozy.thief());
const stolen = (page: Page) => page.evaluate(() => (window as any).__cozy.thief().stolen);
// The saved copy (written a moment later).
const savedStolen = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2') ?? '{}').stolen ?? null);
const boot = async (page: Page, extra: Record<string, unknown>) => {
  await page.goto(FILE);
  await page.evaluate((extra) => {
    localStorage.clear();
    localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [], ...extra }));
  }, extra);
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } (window as any).__cozy.chaseOffer(false); });
};

test('hide rescue: every hiding place has a reachable cell, heals on load, Free my friends', async ({ playwright: _pw }, info) => {
  test.setTimeout(900_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // 1) A fresh save (north gate still locked): every hiding place is a real puzzle, named with its area, reachable on foot.
    await boot(page, {});
    const t0 = await thief(page);
    console.log('hides', JSON.stringify(t0.hides));
    expect(t0.hides.map((h: any) => h.id).sort()).toEqual([...HIDE_IDS].sort());
    for (const h of t0.hides) {
      expect(h.spot, h.id).toBeTruthy();
      expect(h.ok, `${h.id} reachable`).toBe(true);
      expect(h.place, h.id).toMatch(/ in [A-Z]/);
    }
    expect(t0.hides.find((h: any) => h.id === 'stones').place).toBe('the stepping stones in Mistbirch Wood');

    // 2) Steal into each one: a cell right beside its puzzle, locked until solved, solving + tapping frees the friend.
    for (const pid of HIDE_IDS) {
      expect(await page.evaluate((pid) => (window as any).__cozy.stealInto(pid, 'sushi', 'fox'), pid), pid).toBe(true);
      const t = await thief(page);
      expect(t.cells, pid).toContain(pid);
      const spot = t0.hides.find((h: any) => h.id === pid).spot;
      expect(Math.hypot(t.cellAt[pid].x - spot.x, t.cellAt[pid].y - spot.y), pid).toBeLessThan(10);
      expect(await page.evaluate((pid) => (window as any).__cozy.thiefCell(pid, false), pid), `${pid} locked`).toBe(false);
      await page.evaluate(() => document.querySelectorAll('#clue').forEach((e) => e.remove()));
      expect(await page.evaluate((pid) => (window as any).__cozy.thiefCell(pid, true), pid), `${pid} solved`).toBe(true);
      await expect.poll(() => stolen(page), { timeout: 10_000 }).toBeNull();
      expect((await thief(page)).cells).not.toContain(pid);
    }
    // The stones cell, on screen, beside the stepping stones' chest.
    await page.evaluate(() => (window as any).__cozy.stealInto('stones', 'sushi', 'fox'));
    const at = (await thief(page)).cellAt.stones;
    await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x - 150, y + 40), [at.x, at.y]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SHOTS}/hide-rescue-stones.png` });

    // 3) The Map shows a pink heart where the friend is; Free my friends (gear) with a No, then a Yes.
    await page.evaluate(() => (window as any).__cozy.stealInto('num2', 'eagle', 'raccoon'));
    expect((await stolen(page)).length).toBe(2);
    await page.evaluate(() => (window as any).__menu.show('map'));
    await page.waitForTimeout(1000);
    expect(await rect(page, 'friend:stones')).toBeTruthy();
    expect(await rect(page, 'friend:num2')).toBeTruthy();
    await expect.poll(async () => {
      if (await page.evaluate(() => (window as any).__menu.gearOpen)) return true;
      await tap(page, 'gear:open');
      return page.evaluate(() => (window as any).__menu.gearOpen);
    }, { timeout: 30_000 }).toBe(true);
    expect(await rect(page, 'gear:free-yes')).toBeFalsy();
    await tap(page, 'gear:free');
    await expect.poll(() => rect(page, 'gear:free-yes'), { timeout: 10_000 }).toBeTruthy();
    await page.screenshot({ path: `${SHOTS}/hide-rescue-free-ask.png` });
    await tap(page, 'gear:free-no');
    await expect.poll(() => rect(page, 'gear:free-yes'), { timeout: 10_000 }).toBeFalsy();
    expect((await stolen(page)).length).toBe(2);
    await tap(page, 'gear:free');
    await expect.poll(() => rect(page, 'gear:free-yes'), { timeout: 10_000 }).toBeTruthy();
    await tap(page, 'gear:free-yes');
    await expect.poll(() => stolen(page), { timeout: 10_000 }).toBeNull();
    const tf = await thief(page);
    expect(tf.cells).toEqual([]); expect(tf.freed).toBe(2);
    await expect.poll(() => savedStolen(page), { timeout: 10_000 }).toBeNull();
    expect(await rect(page, 'friend:stones')).toBeFalsy();
    await page.screenshot({ path: `${SHOTS}/hide-rescue-freed.png` });

    // 4) A stuck save heals on load: a hiding place that doesn't exist, two friends in one cell, an unknown friend,
    //    and a chase that never finished. Every friend that exists ends up in its own cell beside a real puzzle.
    await boot(page, { puzzles: { stones: true, bells: true }, stolen: [
      { mount: 'sushi', puzzle: 'bogus', kind: 'fox' },
      { mount: 'eagle', puzzle: 'stones', kind: 'fox' },
      { mount: 'unicorn', puzzle: 'stones', kind: 'raccoon' },
      { mount: 'no_such_friend', puzzle: 'tiles', kind: 'fox' },
      { mount: 'snail', puzzle: 'trail', kind: 'fox', chase: true },
    ] });
    const th = await thief(page);
    console.log('healed', JSON.stringify(th.healed), 'stolen', JSON.stringify(th.stolen));
    const st = await stolen(page);
    expect(st.map((s: any) => s.mount).sort()).toEqual(['eagle', 'snail', 'sushi', 'unicorn']);
    const pids = st.map((s: any) => s.puzzle);
    expect(new Set(pids).size).toBe(pids.length);
    for (const s of st) {
      expect(HIDE_IDS, s.mount).toContain(s.puzzle);
      expect(th.cells, s.mount).toContain(s.puzzle);
      expect(s.chase).toBeFalsy();
    }
    expect(th.healed.length).toBe(3); // bogus, duplicate, unknown friend
    await expect.poll(async () => ((await savedStolen(page)) ?? []).map((s: any) => s.puzzle).sort().join(), { timeout: 10_000 }).toBe([...pids].sort().join());
    // Each healed friend can be freed the normal way.
    for (const s of st) expect(await page.evaluate((pid) => (window as any).__cozy.thiefCell(pid, true), s.puzzle)).toBe(true);
    await expect.poll(() => stolen(page), { timeout: 10_000 }).toBeNull();

    // 5) Free my friends with nothing taken just says so (no Yes / No).
    await page.evaluate(() => (window as any).__menu.show('map'));
    await page.waitForTimeout(1000);
    await expect.poll(async () => {
      if (await page.evaluate(() => (window as any).__menu.gearOpen)) return true;
      await tap(page, 'gear:open');
      return page.evaluate(() => (window as any).__menu.gearOpen);
    }, { timeout: 30_000 }).toBe(true);
    await tap(page, 'gear:free');
    expect(await rect(page, 'gear:free-yes')).toBeFalsy();
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
