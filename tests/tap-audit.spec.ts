import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 11.6 iPad tap-target audit: small hands need targets of at least ~44 pt. For every theme, every
// enabled world tappable (props, snowmen, sunflowers, balls...) must have a tap radius of at least
// 22 screen px at the default zoom, and every HUD button rect must be at least 44 px on its short side.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const cozy = (page: Page, expr: string) => page.evaluate(`(window.__cozy.${expr})`) as Promise<any>;
const THEMES = ['spring', 'summer', 'fall', 'halloween', 'christmas', 'winter'];

test('tap audit: world props and HUD targets are big enough for small fingers', async ({ page }) => {
  test.setTimeout(300_000);
  try {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(FILE);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('cozy.save.v2', JSON.stringify({ v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: [] }));
    });
    await page.reload();
    await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
    await page.waitForTimeout(1200);
    for (let i = 0; i < 8 && (await cozy(page, 'state')).dialogOpen; i++) { await page.touchscreen.tap(590, 700); await page.waitForTimeout(500); }
    const small: string[] = [];
    const summary: string[] = [];
    for (const id of THEMES) {
      await cozy(page, `setTheme('${id}')`);
      await page.waitForTimeout(700);
      const res = await page.evaluate(() => {
        const w = (window as any).__game.scene.getScene('world');
        const c = (window as any).__cozy;
        const out: { x: number; y: number; r: number; px: number }[] = [];
        for (const t of w.tappables) {
          if (t.enabled && !t.enabled()) continue;
          const x = t.x(), y = t.y();
          const a = c.worldToScreen(x, y), b = c.worldToScreen(x + t.r, y);
          out.push({ x: Math.round(x), y: Math.round(y), r: t.r, px: Math.round(Math.abs(b.x - a.x)) });
        }
        return out;
      });
      expect(res.length).toBeGreaterThan(0);
      summary.push(`${id}: ${res.length} tappables, smallest ${Math.min(...res.map((t) => t.px))}px radius`);
      for (const t of res) if (t.px < 22) small.push(`${id}: tappable at ${t.x},${t.y} r=${t.r} -> ${t.px}px`);
      const rects = await page.evaluate(() => (window as any).__vui.rects as Record<string, { w: number; h: number }>);
      for (const [k, r] of Object.entries(rects)) if (r && r.w > 0 && r.h > 0 && Math.min(r.w, r.h) < 44) small.push(`${id}: HUD ${k} ${Math.round(r.w)}x${Math.round(r.h)}`);
    }
    console.log(summary.join('\n') + `\ntap-audit: ${small.length} small targets\n` + [...new Set(small)].join('\n'));
    expect([...new Set(small)]).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});
