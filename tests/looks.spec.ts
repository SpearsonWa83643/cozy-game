import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 47-49 (Walker, Nov 2): Stable > "Looks & Moves": arrow pickers for the art style and the motion +
// soundscape (one at a time), the weather picking the motion under "Auto (weather)", a hand pick
// overriding it (saved), "Match weather" going back, and the flying friend using both.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.LK_SHOTS ?? resolve('screenshots');
const rect = (page: Page, k: string) => page.evaluate((k) => (window as any).__menu.rects[k], k);
const tap = async (page: Page, k: string) => {
  const r = await rect(page, k);
  expect(r, k).toBeTruthy();
  await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
  await page.waitForTimeout(350);
};
// 73: Looks & Moves lives behind the settings gear in the Map's bottom-left corner.
const openLooks = async (page: Page) => {
  if (!(await page.evaluate(() => (window as any).__menu.open && (window as any).__menu.tab === 'map'))) {
    await page.evaluate(() => (window as any).__menu.show('map'));
    await page.waitForTimeout(800);
  }
  await expect.poll(async () => { if (!(await rect(page, 'looks:open'))) await tap(page, 'gear:open'); return !!(await rect(page, 'looks:open')); }, { timeout: 30_000 }).toBe(true);
  await tap(page, 'looks:open');
  await expect.poll(() => page.evaluate(() => (window as any).__menu.stableView), { timeout: 15_000 }).toBe('looks');
};
const looks = (page: Page) => page.evaluate(() => (window as any).__cozy.looks());
const shown = (page: Page) => page.evaluate(() => ({ ...(window as any).__menu.looksShown }));

test('looks & moves: arrow pickers, weather auto-match, override, flying', async ({ playwright: _pw }, info) => {
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
      localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
    });
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
    await page.evaluate(() => (window as any).__cozy.teleport(905, 1330));
    // Defaults: classic art, Auto motion, clear weather -> Gentle Float.
    let L = await looks(page);
    expect(L.art).toBe('classic'); expect(L.motion).toBe('auto'); expect(L.weather).toBe('clear'); expect(L.effective).toBe('gentle');

    // The stable beam no longer has the button; it's tucked behind the Map's settings gear (bottom-left).
    await page.evaluate(() => (window as any).__menu.show('stable'));
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open)).toBe(true);
    await page.waitForTimeout(600);
    expect(await rect(page, 'looks:open')).toBeFalsy();
    await page.evaluate(() => (window as any).__menu.show('map'));
    await page.waitForTimeout(800);
    const gear = await rect(page, 'gear:open');
    const vp0 = page.viewportSize()!;
    expect(gear.w).toBeGreaterThanOrEqual(56); expect(gear.x).toBeLessThan(120); expect(gear.y + gear.h).toBeGreaterThan(vp0.height - 120);
    expect(await rect(page, 'looks:open')).toBeFalsy(); // hidden until the gear is tapped
    await tap(page, 'gear:open');
    await expect.poll(() => rect(page, 'looks:open'), { timeout: 15_000 }).toBeTruthy();
    const open = await rect(page, 'looks:open');
    expect(open.w).toBeGreaterThanOrEqual(150); expect(open.h).toBeGreaterThanOrEqual(44);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/looks-gear-panel.png`, scale: 'css' });
    await tap(page, 'looks:open');
    expect(await page.evaluate(() => (window as any).__menu.stableView)).toBe('looks');
    const vp = page.viewportSize()!;
    for (const k of ['art:prev', 'art:next', 'motion:prev', 'motion:next', 'looks:back']) {
      const r = await rect(page, k);
      expect(r.w, k).toBeGreaterThanOrEqual(44); expect(r.h, k).toBeGreaterThanOrEqual(44);
      expect(r.x + r.w).toBeLessThanOrEqual(vp.width); expect(r.y + r.h).toBeLessThanOrEqual(vp.height);
    }
    expect(await rect(page, 'motion:auto')).toBeFalsy(); // already following the weather
    let S = await shown(page);
    expect(S.art).toBe('Classic Glade'); expect(S.motion).toBe('Auto (weather)'); expect(S.auto).toBe('Clear skies \u2192 Gentle Float'); expect(S.sound).toBe('Meadow Lullaby');
    // The page plays the soundscape.
    await expect.poll(() => looks(page).then((l) => l.previewing)).toBe(true);
    await expect.poll(() => looks(page).then((l) => l.playing), { timeout: 15_000 }).toBe('gentle');

    // ---- Art style: arrows cycle one style at a time and wrap; the pick is saved. ----
    const ART = ['Classic Glade', 'Storybook Watercolor', 'Bold Cel-Shaded', 'Painterly Gouache', 'Soft 3D Clay', 'Ink and Wash', 'Hi-Res Pixel Art'];
    for (let i = 1; i < ART.length; i++) {
      await tap(page, 'art:next');
      expect((await shown(page)).art).toBe(ART[i]);
      if (i === 1) await page.screenshot({ path: `${SHOTS}/looks-watercolor.png`, scale: 'css' });
      if (i === 4) await page.screenshot({ path: `${SHOTS}/looks-clay.png`, scale: 'css' });
    }
    await tap(page, 'art:next');
    expect((await shown(page)).art).toBe('Classic Glade'); // wraps around
    await tap(page, 'art:prev');
    expect((await shown(page)).art).toBe('Hi-Res Pixel Art');
    await tap(page, 'art:prev');
    expect((await shown(page)).art).toBe('Ink and Wash');
    await tap(page, 'art:prev'); await tap(page, 'art:prev'); await tap(page, 'art:prev');
    expect((await shown(page)).art).toBe('Bold Cel-Shaded');
    // 59: the arrows only preview. Nothing is applied (or saved) until Apply.
    L = await looks(page);
    expect(L.pArt).toBe('cel'); expect(L.art).toBe('classic'); expect(L.dirty).toBe(true); expect(L.saved).toBeNull();
    expect((await shown(page)).apply).toBe('Apply');
    const ap = await rect(page, 'looks:apply');
    expect(ap.w).toBeGreaterThanOrEqual(200); expect(ap.h).toBeGreaterThanOrEqual(56); expect(ap.y + ap.h).toBeLessThanOrEqual(vp.height);
    await page.screenshot({ path: `${SHOTS}/looks-apply.png`, scale: 'css' });
    // Leaving without Apply keeps the old choice.
    await tap(page, 'looks:back');
    await expect.poll(() => page.evaluate(() => (window as any).__menu.tab)).toBe('map');
    await expect.poll(() => looks(page).then((l) => l.previewing)).toBe(false);
    await openLooks(page);
    await expect.poll(() => looks(page).then((l) => l.previewing)).toBe(true);
    expect((await shown(page)).art).toBe('Classic Glade');
    L = await looks(page);
    expect(L.art).toBe('classic'); expect(L.pArt).toBe('classic');
    expect((await shown(page)).apply).toBe('Applied \u2713');
    await tap(page, 'art:next'); await tap(page, 'art:next');
    expect((await shown(page)).art).toBe('Bold Cel-Shaded');
    await tap(page, 'looks:apply');
    L = await looks(page);
    expect(L.art).toBe('cel'); expect(L.dirty).toBe(false); expect(L.applies).toBe(1); expect(JSON.parse(L.saved).art).toBe('cel');
    expect((await shown(page)).apply).toBe('Applied \u2713');
    await page.screenshot({ path: `${SHOTS}/looks-applied.png`, scale: 'css' });
    await page.screenshot({ path: `${SHOTS}/looks-art-picker.png`, scale: 'css' });
    // The stable stalls now show the friends in the applied style too.
    await page.evaluate(() => (window as any).__menu.show('stable'));
    await page.waitForTimeout(800);
    const stallTex = await page.evaluate(() => {
      const out: string[] = [];
      const walk = (o: any) => { if (o.texture?.key) out.push(o.texture.key); for (const c of o.list ?? []) walk(c); };
      for (const c of (window as any).__menu.children.list) walk(c);
      return out.filter((k) => k.startsWith('look:cel:')).length;
    });
    expect(stallTex).toBeGreaterThan(0);
    await openLooks(page);
    await expect.poll(() => looks(page).then((l) => l.previewing)).toBe(true);

    // ---- Motion: arrows step through Auto + the 7 motions; a hand pick overrides the weather. ----
    const MOT = ['Auto (weather)', 'Gentle Float', 'Springy Squash & Stretch', 'Floaty Dreamy Drift', 'Snappy Cartoon', 'Natural Physics', 'Playful Bounce', 'Storm Jitters'];
    const SND = ['Meadow Lullaby', 'Meadow Lullaby', 'Boing Pulse', 'Starlit Pond', 'Toybox Tick-Tock', 'Open Sky', 'Hop Parade', 'Thunderstorm'];
    for (let i = 1; i < MOT.length; i++) {
      await tap(page, 'motion:next');
      S = await shown(page);
      expect(S.motion).toBe(MOT[i]); expect(S.sound).toBe(SND[i]); expect(S.auto).toBe('');
    }
    await expect.poll(() => looks(page).then((l) => l.playing), { timeout: 15_000 }).toBe('storm');
    await tap(page, 'motion:next');
    expect((await shown(page)).motion).toBe('Auto (weather)'); // wraps back to Auto
    await tap(page, 'motion:prev');
    expect((await shown(page)).motion).toBe('Storm Jitters');
    await tap(page, 'motion:prev'); // Playful Bounce
    expect(await rect(page, 'motion:auto')).toBeTruthy();
    await page.screenshot({ path: `${SHOTS}/looks-motion-picker.png`, scale: 'css' });
    L = await looks(page);
    expect(L.pMotion).toBe('playful'); expect(L.motion).toBe('auto'); expect(JSON.parse(L.saved).motion).toBe('auto');
    await tap(page, 'looks:apply');
    L = await looks(page);
    expect(L.motion).toBe('playful'); expect(JSON.parse(L.saved).motion).toBe('playful');

    // A hand pick stays put when the weather changes.
    await tap(page, 'looks:back');
    await page.evaluate(() => (window as any).__menu.close());
    await expect.poll(() => page.evaluate(() => (window as any).__menu.open)).toBe(false);
    await page.waitForTimeout(400);
    await page.evaluate(() => (window as any).__cozy.villageEvent('rain'));
    await expect.poll(() => looks(page).then((l) => l.weather), { timeout: 20_000 }).toBe('rain');
    L = await looks(page);
    expect(L.effective).toBe('playful'); expect(L.weatherSwitches).toBe(0);

    // "Match weather" goes back to Auto, and the rain picks Storm Jitters + Thunderstorm.
    await openLooks(page);
    await page.waitForTimeout(800); // let the menu settle (slow headless frames)
    await expect.poll(() => rect(page, 'motion:auto'), { timeout: 15_000 }).toBeTruthy();
    await tap(page, 'motion:auto');
    S = await shown(page);
    expect(S.motion).toBe('Auto (weather)'); expect(S.auto).toBe('Rain \u2192 Storm Jitters'); expect(S.sound).toBe('Thunderstorm');
    expect(await rect(page, 'motion:auto')).toBeFalsy();
    L = await looks(page);
    expect(L.pMotion).toBe('auto'); expect(L.motion).toBe('playful');
    await tap(page, 'looks:apply');
    L = await looks(page);
    expect(L.motion).toBe('auto'); expect(L.effective).toBe('storm');
    await expect.poll(() => looks(page).then((l) => l.playing), { timeout: 15_000 }).toBe('storm');
    await page.screenshot({ path: `${SHOTS}/looks-auto-rain.png`, scale: 'css' });
    await page.evaluate(() => (window as any).__menu.close());
    await expect.poll(() => looks(page).then((l) => l.previewing)).toBe(false);
    // Rain ends: Auto follows the weather back to Gentle Float.
    await page.evaluate(() => (window as any).__cozy.weatherLeft(0.2));
    await expect.poll(() => looks(page).then((l) => l.weather), { timeout: 20_000 }).toBe('clear');
    L = await looks(page);
    expect(L.effective).toBe('gentle'); expect(L.weatherSwitches).toBe(1);
    await expect.poll(() => looks(page).then((l) => l.playing), { timeout: 15_000 }).toBe('');

    // ---- The picks survive a reload, and the flying friend wears the style and moves in the motion. ----
    await page.evaluate(() => (window as any).__cozy.setLookMotion('springy'));
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => { try { (window as any).__cozy.dismiss?.(); } catch { /* */ } });
    L = await looks(page);
    expect(L.art).toBe('cel'); expect(L.motion).toBe('springy');
    await page.evaluate(() => (window as any).__cozy.callMount());
    await expect.poll(() => page.evaluate(() => (window as any).__cozy.mount().phase), { timeout: 120_000, intervals: [300] }).toBe('ride');
    await page.waitForTimeout(1500);
    const M = await page.evaluate(() => (window as any).__cozy.mount());
    expect(M.looks.art).toBe('cel'); expect(M.looks.motion).toBe('springy');
    expect(M.looks.tex).toMatch(/^look:cel:/);
    await expect.poll(() => page.evaluate(() => (window as any).__cozy.mount().looks.mix), { timeout: 90_000, intervals: [500] }).toBeGreaterThan(0.6);
    L = await looks(page);
    expect(L.flying).toBe(true);
    await expect.poll(() => looks(page).then((l) => l.playing), { timeout: 15_000 }).toBe('springy');
    await page.screenshot({ path: `${SHOTS}/looks-riding-cel.png`, scale: 'css' });
    // Under Auto the flying friend follows the rain.
    await page.evaluate(() => (window as any).__cozy.setLookMotion('auto'));
    await page.evaluate(() => (window as any).__cozy.villageEvent('rain'));
    await expect.poll(() => page.evaluate(() => (window as any).__cozy.mount().looks.motion), { timeout: 20_000 }).toBe('storm');
    await expect.poll(() => looks(page).then((l) => l.playing), { timeout: 15_000 }).toBe('storm');
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
