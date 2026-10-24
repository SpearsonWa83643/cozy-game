import { test, expect, chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 12.2 Workshop tools: tap the tool wall, pick a tool, play its little game (wrench, hammer, screwdriver, saw,
// paintbrush), and get a small crafted thing for the room. A repeat gives a bit of wood/stone instead.
const FILE = pathToFileURL(resolve('dist-single/index.html')).href;
const SHOTS = process.env.INTERIOR_SHOTS ?? '/workspace/cozy-game/screenshots';
type R = { x: number; y: number; w: number; h: number };
const ir = (page: Page, k: string) => page.evaluate((k) => (window as any).__interior.rects[k], k);
const item = (page: Page, k: string) => page.evaluate((k) => (window as any).__interior.itemRect(k), k);
const st = (page: Page) => page.evaluate(() => { const s = (window as any).__interior; return { open: s.open, last: s.lastAction, crafted: s.crafted, picker: s.pickerOpen, tool: s.tool ? { ...s.tool } : null, items: s.items.map((i: any) => i.k) as string[] }; });
const tapRect = async (page: Page, r: R) => page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);

test('workshop tools: wrench, hammer, screwdriver, saw and paintbrush each make something', async ({ playwright: _pw }, info) => {
  test.setTimeout(600_000);
  const use = info.project.use as any;
  const browser = await chromium.launch(use.launchOptions);
  try {
    const ctx = await browser.newContext({ viewport: use.viewport, deviceScaleFactor: use.deviceScaleFactor, hasTouch: true, userAgent: use.userAgent });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(FILE);
      await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('cozy.save.v2', JSON.stringify({
          v: 2, theme: 'spring', puzzles: {}, treasures: [], fish: {}, minor: {}, visited: ['glade'], chests: [], snacks: 0, tips: ['feed', 'pantry', 'nearbed'],
          village: { res: { food: 5, wood: 3, stone: 1 }, buildings: [{ id: 1, type: 'home', gx: 0, gy: 1 }, { id: 2, type: 'workshop', gx: 4, gy: 1 }],
            villagers: [{ id: 3, name: 'Bea', trait: 'Loves flowers', kind: 0, job: null, food: 1, sleep: 1, fun: 1 }], nextId: 8, wanderer: 0, events: 0 },
        }));
      });
      await page.reload();
      await page.waitForFunction(() => (window as any).__cozy?.ready, null, { timeout: 180_000 });
      await page.evaluate(() => (window as any).__cozy.villageSpeed(0));
      const k = (await page.evaluate(() => (window as any).__cozy.village())).buildings.find((b: any) => b.id === 2);
      await page.evaluate(([x, y]) => (window as any).__cozy.teleport(x, y + 170), [k.x, k.y] as const);
      await page.waitForTimeout(1200);
      const p = await page.evaluate(([x, y]) => (window as any).__cozy.worldToScreen(x, y), [k.x, k.y] as const);
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForFunction(() => !!(window as any).__vui.rects['card:inside'], null, { timeout: 15_000 });
      await page.waitForTimeout(300);
      await tapRect(page, await page.evaluate(() => (window as any).__vui.rects['card:inside']));
      await expect.poll(async () => (await st(page)).open, { timeout: 15_000 }).toBe(true);
      await page.waitForTimeout(900);
      const res = () => page.evaluate(() => { const r = JSON.parse(localStorage.getItem('cozy.save.v2')!).village.res; return { wood: r.wood, stone: r.stone }; });

      const openTool = async (id: string) => {
        const w = (await item(page, 'toolwall'))!;
        await page.touchscreen.tap(w.x + w.w / 2, w.y + w.h / 2);
        await expect.poll(async () => (await st(page)).tool?.kind, { timeout: 8_000 }).toBe('pick');
        await page.waitForTimeout(400);
        await tapRect(page, await ir(page, `tool:pick:${id}`));
        await expect.poll(async () => (await st(page)).tool?.kind, { timeout: 8_000 }).toBe(id);
        await page.waitForTimeout(250);
      };
      // Tap a target, wait until the game counted the tap.
      const tapStep = async (key: string, dx = 0.5, dy = 0.5) => {
        const before = (await st(page)).tool!.done;
        const r = await ir(page, key);
        await page.touchscreen.tap(r.x + r.w * dx, r.y + r.h * dy);
        await expect.poll(async () => (await st(page)).tool?.done ?? before + 1, { timeout: 10_000 }).toBeGreaterThan(before);
      };
      const finishAs = async (id: string, reward: string) => {
        await expect.poll(async () => (await st(page)).last, { timeout: 25_000 }).toBe(`tool:${id}:done`);
        const s = await st(page);
        expect(s.tool).toBeNull();
        expect(s.items).toContain(reward);
      };

      // The tool wall opens a picker with all five tools; the X closes it.
      await openToolPicker();
      async function openToolPicker() {
        const w = (await item(page, 'toolwall'))!;
        await page.touchscreen.tap(w.x + w.w / 2, w.y + w.h / 2);
        await expect.poll(async () => (await st(page)).tool?.kind, { timeout: 8_000 }).toBe('pick');
      }
      await page.waitForTimeout(500);
      for (const t of ['wrench', 'hammer', 'screwdriver', 'saw', 'paint']) expect(await ir(page, `tool:pick:${t}`)).toBeTruthy();
      await page.screenshot({ path: `${SHOTS}/workshop-tools-picker.png` });
      await tapRect(page, await ir(page, 'tool-close'));
      await expect.poll(async () => (await st(page)).tool, { timeout: 8_000 }).toBeNull();
      expect(await ir(page, 'tool:pick:wrench')).toBeFalsy();

      // 1. Wrench: three bolts, three taps each.
      await openTool('wrench');
      expect((await st(page)).tool!.total).toBe(9);
      for (let i = 0; i < 3; i++) { for (let n = 0; n < 3; n++) await tapStep(`tool:bolt:${i}`); if (i === 1) await page.screenshot({ path: `${SHOTS}/workshop-tool-wrench.png` }); }
      await finishAs('wrench', 'cog');

      // 2. Hammer: four nails, two bonks each.
      await openTool('hammer');
      for (let i = 0; i < 4; i++) {
        await tapStep(`tool:nail:${i}`, 0.5, 0.3);
        if (i === 1) await page.screenshot({ path: `${SHOTS}/workshop-tool-hammer.png` });
        await tapStep(`tool:nail:${i}`, 0.5, 0.3);
      }
      await finishAs('hammer', 'sign');

      // 3. Screwdriver: four screws, three twists each.
      await openTool('screwdriver');
      for (let i = 0; i < 4; i++) { for (let n = 0; n < 3; n++) await tapStep(`tool:screw:${i}`); if (i === 1) await page.screenshot({ path: `${SHOTS}/workshop-tool-screwdriver.png` }); }
      await finishAs('screwdriver', 'musicbox');

      // 4. Saw: two cuts, three saw strokes each.
      await openTool('saw');
      for (let n = 0; n < 6; n++) { await tapStep('tool:plank'); if (n === 4) await page.screenshot({ path: `${SHOTS}/workshop-tool-saw.png` }); }
      await finishAs('saw', 'stool');

      // 5. Paintbrush: choose colors, paint roof, walls and door.
      await openTool('paint');
      await tapRect(page, await ir(page, 'tool:swatch:2'));
      await page.waitForTimeout(300);
      await tapStep('tool:part:roof');
      await tapRect(page, await ir(page, 'tool:swatch:1'));
      await page.waitForTimeout(300);
      await tapStep('tool:part:body', 0.5, 0.1);
      await page.screenshot({ path: `${SHOTS}/workshop-tool-paint.png` });
      await tapRect(page, await ir(page, 'tool:swatch:0'));
      await page.waitForTimeout(300);
      await tapStep('tool:part:door');
      await finishAs('paint', 'paintedhouse');
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${SHOTS}/workshop-tools-made.png` });
      expect(errors).toEqual([]);

      // Doing one again gives a bit of wood/stone instead of a second copy.
      const before = await res();
      await openTool('wrench');
      for (let i = 0; i < 3; i++) for (let n = 0; n < 3; n++) await tapStep(`tool:bolt:${i}`);
      await expect.poll(async () => (await st(page)).last, { timeout: 25_000 }).toBe('tool:wrench:bonus');
      const after = await res();
      expect(after.stone).toBe(before.stone + 1);
      expect((await st(page)).items.filter((x) => x === 'cog').length).toBe(1);

      // Tapping the made things plays with them.
      for (const [m, act] of [['cog', 'spin'], ['sign', 'swing'], ['musicbox', 'play'], ['stool', 'sit'], ['paintedhouse', 'tweet']] as const) {
        await page.waitForTimeout(500);
        const r = (await item(page, m))!;
        await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h * 0.6);
        await expect.poll(async () => (await st(page)).last, { timeout: 8_000 }).toBe(`${m}:${act}`);
      }

      // Made things are saved with the room.
      await tapRect(page, await ir(page, 'close'));
      await expect.poll(async () => (await st(page)).open, { timeout: 10_000 }).toBe(false);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cozy.save.v2')!).interiors['2'].items.map((i: any) => i.k));
      for (const m of ['cog', 'sign', 'musicbox', 'stool', 'paintedhouse']) expect(saved).toContain(m);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
