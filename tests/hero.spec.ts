import { test, expect } from '@playwright/test';

// High-DPI (2x) beauty shots of key spots. Movement-free so slow software GL doesn't matter.
test.use({ deviceScaleFactor: 2 });

test('hi-dpi screenshots', async ({ page }) => {
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
  expect(errors, errors.join('\n')).toEqual([]);
});
