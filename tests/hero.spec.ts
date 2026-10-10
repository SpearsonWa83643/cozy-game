import { test, expect } from '@playwright/test';

// High-DPI (2x) beauty shots of key spots. Movement-free so slow software GL doesn't matter.
test.use({ deviceScaleFactor: 2 });

test('hi-dpi screenshots', async ({ page }) => {
  test.setTimeout(1_200_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__cozy?.ready === true, null, { timeout: 60_000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshots/hd-01-title.png' });
  const spots: [string, number, number][] = [
    ['hd-02-cottage', 560, 760],
    ['hd-03-pond', 1250, 1040],
    ['hd-04-gate', 960, 470],
  ];
  for (const [name, x, y] of spots) {
    await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [x, y]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `screenshots/${name}.png` });
  }
  // Puzzle beauty shots: light lanterns in order, watch the gate open, open the chest.
  const lanterns = await page.evaluate(() => (window as any).__cozy.lanterns);
  for (const id of ['dawn', 'noon', 'dusk']) {
    const l = lanterns.find((v: any) => v.id === id);
    await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y), [l.x - 26, l.y + 32]);
    await page.waitForTimeout(400);
    await page.keyboard.press('e');
    await page.waitForFunction((id) => (window as any).__cozy.state.litOrder.includes(id), id, { timeout: 120_000, polling: 250 });
    await page.waitForTimeout(1500);
    if (id === 'dawn') await page.screenshot({ path: 'screenshots/hd-05-lantern-lit.png' });
  }
  await page.waitForFunction(() => (window as any).__cozy.state.gateOpen, null, { timeout: 400_000, polling: 250 });
  await page.evaluate(() => (window as any).__cozy.teleport(1040, 420));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/hd-06-gate-open.png' });
  await page.evaluate(() => (window as any).__cozy.teleport(1000, 228));
  await page.waitForTimeout(400);
  await page.keyboard.press('e');
  await page.waitForFunction(() => (window as any).__cozy.state.dialogOpen, null, { timeout: 200_000, polling: 250 });
  await page.keyboard.press('e'); // finish the typewriter so the full line is visible
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/hd-07-golden-feather.png' });
  expect(errors, errors.join('\n')).toEqual([]);
});
