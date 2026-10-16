import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Halloween preview: tap jack-o'-lanterns (flare + giggle), pumpkins (wobble + candy pop),
// bat trees (bats flutter out and come home) and the peekaboo pumpkin patch (ghost pops up).
// Everything is real touch taps; Classic must show none of it and ignore taps there.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = 'screenshots';
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const hw = (page: Page) => cozy(page, 'halloween()');
const toScreen = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [x, y] as const) as Promise<{ x: number; y: number }>;
const tap = async (page: Page, x: number, y: number) => { const p = await toScreen(page, x, y); await page.touchscreen.tap(p.x, p.y); };
const near = <T extends number[]>(list: any[], x: number, y: number) => [...list].sort((a: T, b: T) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y))[0];
const teleport = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y]);

/** Particles must never draw tree art, and every particle frame must live on its emitter's texture. */
const TREE_FRAME = /^(h_)?tree|^pine|^birch|^apple|^stump|canopy/;
async function checkParticles(page: Page, label: string) {
  await page.waitForTimeout(4000); // let the ambient emitters fill the view
  const ps: { scene: string; tex: string; frame: string; frameTex: string }[] = await cozy(page, 'particleFrames()');
  expect(ps.length, `${label}: some live particles`).toBeGreaterThan(10);
  const bad = ps.filter((p) => TREE_FRAME.test(p.frame) || p.frameTex !== p.tex || p.frame === '__BASE');
  expect(bad, `${label}: particles drawing tree/wrong-atlas frames`).toEqual([]);
}

test('halloween: interactive decorations respond to taps', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  // Close any intro dialog / what's-new card.
  for (let i = 0; i < 6 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(400); }

  await checkParticles(page, 'classic');
  expect((await cozy(page, 'state')).soundscape).toBe('classic');
  await cozy(page, "setTheme('halloween')");
  await page.waitForTimeout(1500);
  expect((await cozy(page, 'state')).soundscape).toBe('halloween');
  await checkParticles(page, 'halloween');
  let h = await hw(page);
  expect(h.jacks.length).toBeGreaterThan(4);
  expect(h.pumpkins.length).toBeGreaterThan(4);
  expect(h.batTrees.length).toBeGreaterThanOrEqual(2);
  expect(h.peeks.length).toBe(1);
  expect(h.orchardBats).toBeGreaterThan(0);

  // Start meadow: bat tree + peekaboo patch are both here.
  const [sx, sy] = (await cozy(page, 'state')) && [905, 1330];
  const bt = near(h.batTrees, sx, sy), pk = h.peeks[0];
  await teleport(page, (bt[0] + pk[0]) / 2, (bt[1] + pk[1]) / 2 + 60);
  await page.waitForTimeout(1500);

  // Peekaboo: tap the pumpkin patch, the ghost rises up.
  await tap(page, pk[0], pk[1]);
  // (the box renders at a few fps, so give the rise time)
  await expect.poll(async () => (await hw(page)).peeks[0][2], { timeout: 30_000 }).toBeGreaterThan(0.6);
  expect((await hw(page)).taps.peek).toBe(1);

  // Bats: tap the tree, bats flutter out.
  await tap(page, bt[0], bt[1]);
  await expect.poll(async () => near((await hw(page)).batTrees, bt[0], bt[1])[2], { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
  // Screenshot mid-flight (bats well out of the tree; the box renders slowly, so wait on game time).
  await expect.poll(async () => +String(near((await hw(page)).batTrees, bt[0], bt[1])[4]).split(',')[2], { timeout: 60_000 }).toBeGreaterThan(0.7);
  await page.screenshot({ path: `${SHOTS}/halloween-preview-bats.png` });
  // ...and they come home again.
  await expect.poll(async () => near((await hw(page)).batTrees, bt[0], bt[1])[2], { timeout: 120_000 }).toBe(0);

  // Jack-o'-lantern by the cottage: tap -> it flares up.
  h = await hw(page);
  const jk = near(h.jacks, 400, 590);
  const pp = near(h.pumpkins, jk[0], jk[1]);
  await teleport(page, (jk[0] + pp[0]) / 2, Math.max(jk[1], pp[1]) + 90);
  await page.waitForTimeout(1500);
  await tap(page, jk[0], jk[1]);
  await expect.poll(async () => near((await hw(page)).jacks, jk[0], jk[1])[2], { timeout: 3_000 }).toBeGreaterThan(0.3);
  // Pumpkin: tap -> wobble + candy pops out.
  const c0 = (await hw(page)).taps.candy;
  await tap(page, pp[0], pp[1]);
  await expect.poll(async () => (await hw(page)).taps.candy, { timeout: 3_000 }).toBe(c0 + 1);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/halloween-preview-cottage.png` });
  h = await hw(page);
  expect(h.taps.jack).toBeGreaterThanOrEqual(1);
  expect(h.taps.pumpkin).toBeGreaterThanOrEqual(1);
  expect(h.wisps).toBeLessThanOrEqual(12);

  // Orchard look.
  const ft = (await page.evaluate(() => (window as any).__cozy.fruitTrees(3100, 2420)))[0];
  await teleport(page, ft[0] + 40, ft[2] + 70);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/halloween-preview-orchard.png` });

  // Classic: decorations hidden, taps there do nothing.
  await cozy(page, "setTheme('classic')");
  expect((await cozy(page, 'state')).soundscape).toBe('classic');
  await checkParticles(page, 'classic again');
  await teleport(page, (bt[0] + pk[0]) / 2, (bt[1] + pk[1]) / 2 + 60);
  await page.waitForTimeout(1200);
  h = await hw(page);
  expect(h.batTrees.every((b: any) => b[3] === false)).toBe(true);
  expect(h.jacks.every((j: any) => j[3] === false)).toBe(true);
  expect(h.wisps).toBe(0);
  const t0 = h.taps;
  await tap(page, bt[0], bt[1]);
  await page.waitForTimeout(600);
  expect((await hw(page)).taps.bats).toBe(t0.bats);

  expect(errors.filter((e) => !/AudioContext|favicon|Failed to load/i.test(e))).toEqual([]);
});
