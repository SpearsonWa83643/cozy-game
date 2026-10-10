import { test, expect, Page } from '@playwright/test';

const SHOTS = 'screenshots';

async function state(page: Page) {
  return page.evaluate(() => (window as any).__cozy.state);
}
async function teleport(page: Page, x: number, y: number) {
  await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y]);
  await page.waitForTimeout(250);
}
async function hold(page: Page, keys: string[], ms: number) {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
}
/** Holds keys until the predicate on game state passes (frame-rate independent). */
async function holdUntil(page: Page, keys: string[], pred: string, timeout = 60_000) {
  for (const k of keys) await page.keyboard.down(k);
  try {
    await page.waitForFunction(`(() => { const s = window.__cozy.state; return ${pred}; })()`, null, { timeout, polling: 100 });
  } finally {
    for (const k of keys) await page.keyboard.up(k);
  }
}
async function press(page: Page, key = 'e') {
  await page.keyboard.press(key);
  await page.waitForTimeout(120);
}
async function closeDialog(page: Page) {
  for (let i = 0; i < 15 && (await state(page)).dialogOpen; i++) {
    await press(page);
    await page.waitForTimeout(700);
  }
  await expect.poll(async () => (await state(page)).dialogOpen, { timeout: 45_000 }).toBe(false);
}
async function lanternPos(page: Page, id: string) {
  return page.evaluate((id) => (window as any).__cozy.lanterns.find((l: any) => l.id === id), id);
}

test.use({ deviceScaleFactor: 1, viewport: { width: 1024, height: 576 } });

test('cozy glade loads, moves, and the lantern puzzle can be solved', async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await page.waitForFunction(() => (window as any).__cozy?.ready === true, null, { timeout: 60_000 });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${SHOTS}/01-start.png` });

  // Movement: walk north up the path, then diagonally.
  const s0 = await state(page);
  await holdUntil(page, ['ArrowUp'], `s.y < ${s0.y - 110}`);
  const sMid = await state(page);
  await holdUntil(page, ['KeyW', 'KeyD'], `s.x > ${sMid.x + 40}`);
  await page.waitForTimeout(300);
  const s1 = await state(page);
  expect(s1.y).toBeLessThan(s0.y - 100);
  expect(s1.x).toBeGreaterThan(s0.x);
  await page.screenshot({ path: `${SHOTS}/02-walking.png` });

  // Read the hint sign.
  await teleport(page, 905, 465);
  await expect.poll(async () => (await state(page)).prompt, { timeout: 45_000 }).toBe('Read');
  await page.screenshot({ path: `${SHOTS}/03-sign-prompt.png` });
  await press(page);
  await expect.poll(async () => (await state(page)).dialogOpen, { timeout: 45_000 }).toBe(true);
  await page.waitForTimeout(2600);
  await press(page); // next page
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${SHOTS}/04-sign-dialog.png` });
  await closeDialog(page);

  // Wrong order first: noon before dawn should fizzle out.
  const noon = await lanternPos(page, 'noon');
  await teleport(page, noon.x, noon.y + 30);
  await press(page);
  await expect.poll(async () => (await state(page)).locked, { timeout: 45_000 }).toBe(true);
  await expect.poll(async () => (await state(page)).locked, { timeout: 45_000 }).toBe(false);
  expect((await state(page)).litOrder).toEqual([]);

  // Correct order: dawn, noon, dusk.
  for (const id of ['dawn', 'noon', 'dusk']) {
    const l = await lanternPos(page, id);
    await teleport(page, l.x, l.y + 30);
    await expect.poll(async () => (await state(page)).prompt, { timeout: 45_000 }).toBe('Light');
    await press(page);
    await expect.poll(async () => (await state(page)).litOrder.includes(id), { timeout: 45_000 }).toBe(true);
    await page.waitForTimeout(700);
    if (id === 'dawn') await page.screenshot({ path: `${SHOTS}/05-lantern-lit.png` });
  }
  expect((await state(page)).solved).toBe(true);
  // Camera pans to the gate, brambles unravel, camera returns.
  await page.waitForFunction(() => (window as any).__cozy.state.gateOpen, null, { timeout: 240_000, polling: 250 });
  await page.screenshot({ path: `${SHOTS}/06-gate-open.png` });

  // Walk through the opened gate.
  await teleport(page, 1000, 420);
  await holdUntil(page, ['ArrowUp'], 's.y < 300');
  expect((await state(page)).y).toBeLessThan(320);

  // Open the chest.
  await teleport(page, 1000, 228);
  await expect.poll(async () => (await state(page)).prompt, { timeout: 45_000 }).toBe('Open');
  await press(page);
  await expect.poll(async () => (await state(page)).chestOpened, { timeout: 45_000 }).toBe(true);
  await page.waitForFunction(() => (window as any).__cozy.state.dialogOpen, null, { timeout: 120_000, polling: 250 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/07-golden-feather.png` });
  await closeDialog(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/08-shrine.png` });

  console.log('final state', JSON.stringify(await state(page)));
  expect(errors, errors.join('\n')).toEqual([]);
});
