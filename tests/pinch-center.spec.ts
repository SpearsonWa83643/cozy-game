import { test, expect, type Page, type CDPSession } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 12.5 Walker, Oct 24: pinch zoom must keep the hero locked at screen centre while pinching and on release
// (no off-centre drift, no jagged recentre jump). Samples the hero's screen position on every frame.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.CENTER_SHOTS ?? 'test-results';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const pt = (id: number, x: number, y: number) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 });
type S = { l?: number; t: number; dx: number; dy: number; x: number; y: number; z: number };

/** Per-frame sampler: hero follow point on screen vs the screen centre (glade or Wild Woods). */
async function startSampler(page: Page, wild = false) {
  await page.evaluate((wild) => {
    const w = window as any; w.__samples = []; w.__rel = 0; w.__marks = []; w.__on = true;
    w.__off?.();
    w.__off = w.__cozy.onRender(() => {
      if (!w.__on) return;
      const h = w.__cozy.heroScreen(wild);
      w.__samples.push({ t: performance.now(), dx: h.x - h.cx, dy: h.y - h.cy, x: h.x, y: h.y, z: h.zoom, l: h.lerp });
    });
  }, wild);
}
const stopSampler = async (page: Page) => page.evaluate(() => { const w = window as any; w.__on = false; w.__off?.(); return { s: w.__samples as S[], rel: w.__rel as number, marks: w.__marks as { s: number; r: number }[] }; });

/** Pinch about an OFF-centre midpoint (the old code pivoted there), a frame-rate stream of moves, then release. */
async function pinch(page: Page, cdp: CDPSession, cx: number, cy: number, d0: number, d1: number, steps = 30) {
  await page.evaluate(() => { (window as any).__marks.push({ s: performance.now(), r: 0 }); });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(1, cx - d0 / 2, cy)] });
  await page.waitForTimeout(40);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(1, cx - d0 / 2, cy), pt(2, cx + d0 / 2, cy)] });
  await page.waitForTimeout(40);
  for (let i = 1; i <= steps; i++) {
    const d = d0 + ((d1 - d0) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(1, cx - d / 2, cy), pt(2, cx + d / 2, cy)] });
    await page.waitForTimeout(16);
  }
  await page.evaluate(() => { const w = window as any; w.__rel = performance.now(); w.__marks[w.__marks.length - 1].r = w.__rel; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [pt(1, cx - d1 / 2, cy)] });
  await page.waitForTimeout(30);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(1300);
}

const maxJump = (s: S[]) => { let m = 0; for (let i = 1; i < s.length; i++) m = Math.max(m, Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y)); return m; };
/** Jump per 16.7 ms (the box runs headless at a low, load-dependent frame rate, so scale by the frame time). */
const maxJumpPerFrame = (s: S[]) => { let m = 0; for (let i = 1; i < s.length; i++) m = Math.max(m, Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y) * 16.7 / Math.max(16.7, s[i].t - s[i - 1].t)); return m; };
const maxOff = (s: S[]) => s.reduce((m, a) => Math.max(m, Math.hypot(a.dx, a.dy)), 0);

test('pinch zoom keeps the hero centred (glade, world edge, riding a mount)', async ({ page }) => {
  test.setTimeout(400_000);
  let cdp: CDPSession | null = null;
  try {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1200);
    for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
    await cozy(page, 'teleport(1400, 1100)');
    await page.waitForTimeout(4000); // let the follow settle (headless runs at a low frame rate)
    cdp = await page.context().newCDPSession(page);

    // 1. Open glade: pinch OUT then IN about an off-centre midpoint. Hero stays at the centre on every frame, including release.
    await startSampler(page);
    await page.waitForTimeout(300);
    await pinch(page, cdp, 300, 250, 160, 420);
    await page.screenshot({ path: `${SHOTS}/pinch-center-in.png` });
    await pinch(page, cdp, 800, 600, 420, 140);
    let { s } = await stopSampler(page);
    console.log('glade samples', s.length, 'fps', Math.round(1000 * s.length / (s[s.length - 1].t - s[0].t)), 'maxOff', maxOff(s).toFixed(2), 'maxJump', maxJump(s).toFixed(2));
    expect(s.length).toBeGreaterThan(60);
    expect(maxOff(s)).toBeLessThan(2.5);
    expect(maxJump(s)).toBeLessThan(2.5);
    expect(Math.max(...s.map((a) => a.z)) / Math.min(...s.map((a) => a.z))).toBeGreaterThan(1.3); // it really zoomed

    // 2. Hero at the top-left world edge: the camera clamps at the map edge. Clamping is continuous with the zoom
    //    and the release adds no snap: every frame after the fingers lift moves < 3 px, and the view is settled.
    await cozy(page, 'teleport(90, 90)');
    await page.waitForTimeout(4000);
    await startSampler(page);
    await page.waitForTimeout(300);
    await pinch(page, cdp, 700, 400, 150, 400);
    await page.screenshot({ path: `${SHOTS}/pinch-center-edge.png` });
    await pinch(page, cdp, 500, 500, 400, 140);
    const e = await stopSampler(page);
    const all = e.s, after = all.filter((a) => a.t > e.rel + 130);
    console.log('edge samples', all.length, 'maxJump', maxJump(all).toFixed(2), 'post-release maxJump', maxJump(after).toFixed(2));
    expect(maxJump(all)).toBeLessThan(30); // while zooming about a clamped view the hero slides with the zoom, never teleports
    expect(after.length).toBeGreaterThan(4);
    expect(maxJump(after)).toBeLessThan(2.5);
    const settle = after[after.length - 1];
    expect(Math.hypot(settle.x - after[0].x, settle.y - after[0].y)).toBeLessThan(3);

    // 3. Riding a mount: the hero keeps moving, the camera stays locked on it while pinching, no jump on release.
    await cozy(page, 'teleport(1400, 1100)');
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => (window as any).__vui.rects.mount);
    await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
    await expect.poll(async () => (await cozy(page, 'state')).mount, { timeout: 90_000, intervals: [200] }).toBe('ride');
    await page.waitForTimeout(1500);
    await startSampler(page);
    await page.waitForTimeout(300);
    await pinch(page, cdp, 350, 300, 160, 430);
    await page.screenshot({ path: `${SHOTS}/pinch-center-mount.png` });
    await pinch(page, cdp, 750, 560, 430, 140);
    const m = await stopSampler(page);
    expect((await cozy(page, 'state')).mount).toBe('ride');
    // The camera was lagging behind the flying hero before the pinch; the lock-in is a short eased catch-up (a few
    // frames), then the hero sits dead centre for the rest of the pinch even while it flies.
    // Frames where the pinch's follow lock is fully on (the lock-in is an eased ramp, timing depends on box load).
    const locked = m.s.filter((a) => (a.l ?? 0) > 0.99 && m.marks.some((k) => a.t > k.s && a.t < k.r));
    for (const k of m.marks) expect(m.s.some((a) => (a.l ?? 0) > 0.99 && a.t > k.s && a.t < k.r)).toBe(true);
    const mAfter = m.s.filter((a) => m.marks.some((k) => a.t > k.r + 130 && a.t < k.r + 1200));
    console.log('mount samples', m.s.length, 'locked', locked.length, 'maxOff(locked)', maxOff(locked).toFixed(2), 'maxJump/frame', maxJumpPerFrame(m.s).toFixed(2), 'post-release/frame', maxJumpPerFrame(mAfter).toFixed(2));
    expect(locked.length).toBeGreaterThan(10);
    expect(maxOff(locked)).toBeLessThan(3);
    expect(maxJumpPerFrame(mAfter)).toBeLessThan(12);

    // 4. Wild Woods: same camera rules there.
    await cozy(page, 'enterWild(4242)');
    await expect.poll(async () => (await cozy(page, 'wild()')).on, { timeout: 60_000, intervals: [500] }).toBe(true);
    await page.waitForTimeout(2500);
    await startSampler(page, true);
    await page.waitForTimeout(300);
    await pinch(page, cdp, 300, 260, 160, 420);
    await pinch(page, cdp, 800, 560, 420, 140);
    const w = await stopSampler(page);
    console.log('wild samples', w.s.length, 'maxOff', maxOff(w.s).toFixed(2), 'maxJump', maxJump(w.s).toFixed(2));
    expect(w.s.length).toBeGreaterThan(60);
    expect(maxJump(w.s)).toBeLessThan(15); // near an edge the clamp may slide the hero with the zoom, never a snap
    expect(maxJump(w.s.filter((a) => a.t > w.rel + 130))).toBeLessThan(3);
    expect(errors).toEqual([]);
  } finally {
    await cdp?.detach().catch(() => {});
    await page.close();
  }
});
