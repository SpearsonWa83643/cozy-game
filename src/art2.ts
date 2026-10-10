// Painters for the wider world: new trees, landmarks, puzzle pieces, creatures, pickups, icons.
import Phaser from 'phaser';
import { Ctx, canvasTex, hsl, rr, dab, mulberry32, paintTree, paintSoft, blob, softCircle } from './art';

function paintBirch(ctx: Ctx, w: number, h: number, seed: number) {
  const rng = mulberry32(seed);
  const cx = w / 2, base = h - 8;
  // Slender white trunk with dark lenticels.
  const tw = 6;
  const g = ctx.createLinearGradient(cx - tw, 0, cx + tw, 0);
  g.addColorStop(0, hsl(40, 30, 96)); g.addColorStop(0.7, hsl(40, 15, 82)); g.addColorStop(1, hsl(210, 10, 62));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - tw * 1.5, base); ctx.quadraticCurveTo(cx - tw, base - 40, cx - tw * 0.7, h * 0.18);
  ctx.lineTo(cx + tw * 0.7, h * 0.18); ctx.quadraticCurveTo(cx + tw, base - 40, cx + tw * 1.5, base);
  ctx.closePath(); ctx.fill();
  for (let i = 0; i < 16; i++) {
    const y = rr(rng, h * 0.22, base - 4);
    ctx.fillStyle = hsl(220, 15, 18, 0.75);
    ctx.fillRect(cx - tw + rr(rng, 0, 3), y, rr(rng, 3, 7), rr(rng, 1, 2));
  }
  // Airy, sun-dappled canopy in clumps.
  const pal = [hsl(78, 55, 52), hsl(70, 60, 62), hsl(90, 45, 40), hsl(55, 70, 70)];
  const clumps: [number, number, number][] = [];
  for (let i = 0; i < 7; i++) clumps.push([cx + rr(rng, -w * 0.32, w * 0.32), rr(rng, h * 0.12, h * 0.5), rr(rng, 15, 24)]);
  for (const [x, y, r] of clumps) blob(ctx, x, y + 3, r, r * 0.85, hsl(95, 40, 30, 0.85), rng, 0.2);
  for (const [x, y, r] of clumps) blob(ctx, x - 2, y - 2, r * 0.85, r * 0.7, hsl(80, 50, 46), rng, 0.2);
  for (let i = 0; i < 360; i++) {
    const [x0, y0, r] = clumps[Math.floor(rng() * clumps.length)];
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r;
    const x = x0 + Math.cos(a) * d, y = y0 + Math.sin(a) * d * 0.8;
    const lit = (y0 - y) / r;
    dab(ctx, x, y, rr(rng, 1.6, 3.2), rr(rng, 1.2, 2.2), rng() * 3, lit > 0.2 ? pal[rng() < 0.5 ? 1 : 3] : pal[rng() < 0.6 ? 0 : 2]);
  }
}

function paintWindmill(ctx: Ctx, w: number, h: number) {
  const cx = w / 2, base = h - 6;
  // Stone tower, tapering.
  const g = ctx.createLinearGradient(cx - 50, 0, cx + 50, 0);
  g.addColorStop(0, hsl(38, 30, 86)); g.addColorStop(1, hsl(30, 18, 60));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(cx - 50, base); ctx.lineTo(cx - 32, 60); ctx.lineTo(cx + 32, 60); ctx.lineTo(cx + 50, base);
  ctx.quadraticCurveTo(cx, base + 6, cx - 50, base); ctx.fill();
  const rng = mulberry32(5);
  for (let i = 0; i < 70; i++) {
    const y = rr(rng, 66, base - 4), half = 32 + (y - 60) / (base - 60) * 18;
    dab(ctx, cx + rr(rng, -half + 4, half - 4), y, rr(rng, 3, 6), rr(rng, 1.6, 2.6), 0, hsl(35, 15, rr(rng, 62, 80), 0.6));
  }
  // Door + window.
  ctx.fillStyle = hsl(22, 45, 34);
  ctx.beginPath(); ctx.roundRect(cx - 11, base - 34, 22, 32, [11, 11, 2, 2]); ctx.fill();
  ctx.fillStyle = hsl(45, 80, 70);
  ctx.beginPath(); ctx.arc(cx, 105, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = hsl(22, 40, 30); ctx.lineWidth = 2; ctx.stroke();
  // Cap roof.
  ctx.fillStyle = hsl(8, 55, 48);
  ctx.beginPath(); ctx.moveTo(cx - 42, 64); ctx.quadraticCurveTo(cx, 6, cx + 42, 64); ctx.closePath(); ctx.fill();
  ctx.fillStyle = hsl(12, 60, 60, 0.7);
  ctx.beginPath(); ctx.moveTo(cx - 32, 60); ctx.quadraticCurveTo(cx - 14, 22, cx, 18); ctx.lineTo(cx - 6, 60); ctx.closePath(); ctx.fill();
  ctx.fillStyle = hsl(22, 30, 30);
  ctx.beginPath(); ctx.arc(cx, 52, 6, 0, Math.PI * 2); ctx.fill();
}

function paintBlades(ctx: Ctx, w: number) {
  const c = w / 2;
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.translate(c, c); ctx.rotate(i * Math.PI / 2);
    ctx.fillStyle = hsl(28, 35, 34);
    ctx.fillRect(-2.5, 0, 5, c - 6);
    ctx.fillStyle = hsl(40, 40, 88, 0.95);
    ctx.fillRect(3, 16, 22, c - 24);
    ctx.strokeStyle = hsl(28, 30, 40, 0.8); ctx.lineWidth = 1.2;
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(3, 18 + k * (c - 28) / 4); ctx.lineTo(25, 18 + k * (c - 28) / 4); ctx.stroke(); }
    ctx.strokeRect(3, 16, 22, c - 24);
    ctx.restore();
  }
  ctx.fillStyle = hsl(22, 30, 26); ctx.beginPath(); ctx.arc(c, c, 6, 0, Math.PI * 2); ctx.fill();
}

function paintBellPost(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  ctx.fillStyle = hsl(26, 38, 34);
  ctx.fillRect(cx - 3, 10, 6, h - 14);
  ctx.fillRect(cx - 16, 8, 32, 6);
  ctx.fillStyle = hsl(30, 40, 46, 0.7); ctx.fillRect(cx - 3, 10, 2, h - 14);
}
function paintBell(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  const g = ctx.createLinearGradient(cx - 10, 0, cx + 10, 0);
  g.addColorStop(0, hsl(48, 85, 72)); g.addColorStop(0.6, hsl(42, 75, 52)); g.addColorStop(1, hsl(32, 60, 36));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(cx - 3, 4); ctx.quadraticCurveTo(cx - 10, 6, cx - 10, h - 10);
  ctx.quadraticCurveTo(cx - 13, h - 5, cx - 13, h - 4); ctx.lineTo(cx + 13, h - 4); ctx.quadraticCurveTo(cx + 13, h - 5, cx + 10, h - 10);
  ctx.quadraticCurveTo(cx + 10, 6, cx + 3, 4); ctx.closePath(); ctx.fill();
  dab(ctx, cx, h - 2.5, 2.4, 2.2, 0, hsl(32, 40, 30));
  dab(ctx, cx - 4, 12, 1.6, 4, 0, 'rgba(255,255,240,0.7)');
}
function paintRibbon(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(w / 2 - 3, 0); ctx.lineTo(w / 2 + 3, 0); ctx.lineTo(w / 2 + 5, h); ctx.lineTo(w / 2, h - 4); ctx.lineTo(w / 2 - 5, h); ctx.closePath(); ctx.fill();
}

function paintBridgeDeck(ctx: Ctx, w: number, h: number) {
  const rng = mulberry32(3);
  dab(ctx, w / 2, h / 2 + 6, w / 2, h / 2, 0, 'rgba(10,30,40,0.25)');
  for (let x = 4; x < w - 4; x += 12) {
    ctx.fillStyle = hsl(30, rr(rng, 35, 45), rr(rng, 44, 54));
    ctx.beginPath(); ctx.roundRect(x, 6 + rr(rng, -1, 1), 11, h - 12, 2); ctx.fill();
    ctx.fillStyle = hsl(34, 40, 64, 0.6); ctx.fillRect(x + 1, 8, 3, h - 16);
  }
  ctx.fillStyle = hsl(24, 35, 30); ctx.fillRect(0, 10, w, 3); ctx.fillRect(0, h - 13, w, 3);
}
function paintRail(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = hsl(24, 38, 32);
  for (let x = 6; x < w; x += 42) ctx.fillRect(x, 2, 6, h - 2);
  ctx.fillStyle = hsl(28, 42, 42);
  ctx.beginPath(); ctx.roundRect(0, 2, w, 5, 2); ctx.fill();
  ctx.fillStyle = hsl(34, 45, 60, 0.6); ctx.fillRect(2, 2.5, w - 4, 1.5);
}
function paintPier(ctx: Ctx, w: number, h: number) {
  const rng = mulberry32(9);
  for (let y = 4; y < h - 4; y += 11) {
    ctx.fillStyle = hsl(30, rr(rng, 30, 42), rr(rng, 44, 54));
    ctx.beginPath(); ctx.roundRect(4 + rr(rng, -1, 1), y, w - 8, 10, 2); ctx.fill();
    ctx.fillStyle = hsl(34, 40, 64, 0.5); ctx.fillRect(6, y + 1, w - 12, 2.5);
  }
  ctx.fillStyle = hsl(24, 35, 28);
  for (const y of [h * 0.3, h * 0.65, h - 10]) { ctx.fillRect(0, y, 6, 12); ctx.fillRect(w - 6, y, 6, 12); }
}
function paintGate(ctx: Ctx, w: number, h: number, open: boolean) {
  const post = (x: number) => {
    ctx.fillStyle = hsl(24, 38, 30); ctx.fillRect(x - 4, 6, 8, h - 8);
    ctx.fillStyle = hsl(28, 40, 44, 0.8); ctx.fillRect(x - 4, 6, 3, h - 8);
    dab(ctx, x, 7, 6, 3, 0, hsl(28, 30, 50));
  };
  post(6); post(w - 6);
  if (!open) {
    ctx.fillStyle = hsl(30, 40, 46);
    for (let x = 14; x < w - 14; x += 10) ctx.fillRect(x, 18, 7, h - 30);
    ctx.fillStyle = hsl(26, 38, 34); ctx.fillRect(10, 24, w - 20, 5); ctx.fillRect(10, h - 26, w - 20, 5);
    // Padlock.
    dab(ctx, w / 2, h / 2 + 2, 7, 6, 0, hsl(40, 30, 40));
    ctx.strokeStyle = hsl(40, 20, 55); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w / 2, h / 2 - 3, 4, Math.PI, 0); ctx.stroke();
    dab(ctx, w / 2, h / 2 + 2, 1.4, 2, 0, hsl(30, 30, 18));
    // Ivy.
    const rng = mulberry32(4);
    for (let i = 0; i < 30; i++) dab(ctx, rr(rng, 10, w - 10), rr(rng, 14, h - 10), rr(rng, 2, 3.5), rr(rng, 1.4, 2.4), rng() * 3, hsl(rr(rng, 95, 130), 45, rr(rng, 32, 50), 0.9));
  }
}
function paintPot(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  ctx.fillStyle = hsl(16, 55, 50);
  ctx.beginPath(); ctx.moveTo(cx - 10, 4); ctx.lineTo(cx + 10, 4); ctx.lineTo(cx + 7, h - 2); ctx.lineTo(cx - 7, h - 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = hsl(18, 60, 60); ctx.fillRect(cx - 11.5, 2, 23, 5);
  ctx.fillStyle = hsl(14, 50, 40, 0.5); ctx.fillRect(cx + 3, 7, 4, h - 10);
  dab(ctx, cx, 4, 9, 2, 0, hsl(25, 40, 22));
}
function paintPotFlower(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  ctx.strokeStyle = hsl(110, 45, 34); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, h); ctx.quadraticCurveTo(cx - 2, h * 0.6, cx, h * 0.42); ctx.stroke();
  dab(ctx, cx - 5, h * 0.72, 4, 2, -0.6, hsl(110, 45, 40));
  dab(ctx, cx + 5, h * 0.66, 4, 2, 0.6, hsl(110, 45, 40));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    dab(ctx, cx + Math.cos(a) * 5, h * 0.36 + Math.sin(a) * 4, 4, 3, a, hsl(0, 0, 96));
  }
  dab(ctx, cx, h * 0.36, 2.6, 2.4, 0, hsl(48, 90, 60));
}

/** The stone tile emblem: a moon, stars and an owl's eye ring, read clearly in any rotation. */
function paintEmblem(ctx: Ctx, size: number) {
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 4, c, c, c);
  g.addColorStop(0, hsl(215, 45, 34)); g.addColorStop(1, hsl(225, 40, 20));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, c - 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = hsl(45, 70, 70); ctx.lineWidth = 3; ctx.stroke();
  // Crescent moon.
  ctx.fillStyle = hsl(48, 90, 74);
  ctx.beginPath(); ctx.arc(c - 8, c - 6, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hsl(220, 42, 26);
  ctx.beginPath(); ctx.arc(c + 6, c - 16, 27, 0, Math.PI * 2); ctx.fill();
  // Stars.
  const star = (x: number, y: number, r: number) => {
    ctx.fillStyle = hsl(50, 100, 88); ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2; const rr2 = i % 2 ? r * 0.4 : r; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
    ctx.fill();
  };
  star(c + 26, c + 22, 8); star(c + 32, c - 30, 5); star(c - 30, c + 32, 5);
  // Leaf at bottom-left.
  dab(ctx, c - 6, c + 34, 12, 5, -0.5, hsl(120, 40, 50));
}

function paintStoneSlab(ctx: Ctx, w: number) {
  const rng = mulberry32(12);
  dab(ctx, w / 2, w / 2 + 3, w / 2 - 1, w / 2 - 3, 0, 'rgba(30,30,40,0.35)');
  ctx.fillStyle = hsl(210, 8, 62);
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, w - 6, 8); ctx.fill();
  for (let i = 0; i < 40; i++) dab(ctx, rr(rng, 6, w - 6), rr(rng, 6, w - 8), rr(rng, 2, 5), rr(rng, 1, 3), rng() * 3, hsl(rr(rng, 200, 220), 8, rr(rng, 55, 74), 0.6));
  ctx.strokeStyle = hsl(210, 10, 80, 0.6); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(3, 3, w - 6, w - 8, 7); ctx.stroke();
}

function paintCreature(kind: string) {
  return (ctx: Ctx, w: number, h: number) => {
    const cx = w / 2, by = h - 2;
    switch (kind) {
      case 'rabbit_sit':
        dab(ctx, cx + 2, by - 6, 7.5, 6, 0, hsl(30, 25, 70));
        dab(ctx, cx + 1, by - 8, 5, 3, 0, hsl(30, 30, 80, 0.8));
        dab(ctx, cx + 9, by - 6, 2.4, 2.4, 0, '#fff');
        dab(ctx, cx - 4, by - 12, 4.6, 4.2, 0, hsl(30, 25, 72));
        dab(ctx, cx - 6, by - 19, 1.6, 5, -0.2, hsl(30, 25, 70)); dab(ctx, cx - 3, by - 19, 1.6, 5, 0.15, hsl(30, 25, 68));
        dab(ctx, cx - 6, by - 19, 0.7, 3.4, -0.2, hsl(350, 50, 80)); dab(ctx, cx - 3, by - 19, 0.7, 3.4, 0.15, hsl(350, 50, 80));
        dab(ctx, cx - 6.5, by - 12.5, 0.9, 1, 0, hsl(250, 30, 15)); dab(ctx, cx - 8.4, by - 11, 0.8, 0.6, 0, hsl(350, 60, 60));
        break;
      case 'rabbit_hop':
        dab(ctx, cx + 2, by - 7, 9, 4.5, -0.2, hsl(30, 25, 70));
        dab(ctx, cx + 10, by - 9, 2.4, 2.4, 0, '#fff');
        dab(ctx, cx - 6, by - 10, 4.4, 3.8, 0, hsl(30, 25, 72));
        dab(ctx, cx - 6, by - 15, 1.4, 5, -0.9, hsl(30, 25, 70)); dab(ctx, cx - 4, by - 15, 1.4, 5, -0.6, hsl(30, 25, 68));
        dab(ctx, cx - 8.5, by - 10.5, 0.9, 1, 0, hsl(250, 30, 15));
        dab(ctx, cx + 8, by - 3, 4, 1.6, 0.4, hsl(30, 25, 64));
        break;
      case 'squirrel':
        ctx.strokeStyle = hsl(18, 60, 46); ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(cx + 4, by - 3); ctx.quadraticCurveTo(cx + 14, by - 8, cx + 8, by - 18); ctx.quadraticCurveTo(cx + 4, by - 22, cx + 9, by - 22); ctx.stroke();
        ctx.strokeStyle = hsl(22, 70, 62, 0.6); ctx.lineWidth = 2.5; ctx.stroke();
        dab(ctx, cx - 1, by - 6, 5.5, 5, 0, hsl(18, 60, 50));
        dab(ctx, cx - 2, by - 5, 2.6, 3, 0, hsl(35, 50, 84));
        dab(ctx, cx - 4, by - 12, 3.8, 3.4, 0, hsl(18, 60, 52));
        dab(ctx, cx - 4.5, by - 16, 1.2, 1.8, 0, hsl(18, 60, 48));
        dab(ctx, cx - 6, by - 12.5, 0.9, 1, 0, hsl(250, 30, 12));
        break;
      case 'hedgehog':
      case 'hedgeball': {
        const ball = kind === 'hedgeball';
        const r = ball ? 7 : 9;
        for (let i = 0; i < 26; i++) {
          const a = Math.PI + (i / 25) * Math.PI;
          ctx.strokeStyle = hsl(28, 30, i % 2 ? 30 : 46); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.5, by - 5 + Math.sin(a) * r * 0.4); ctx.lineTo(cx + Math.cos(a) * (r + 3), by - 5 + Math.sin(a) * (r * 0.8 + 3)); ctx.stroke();
        }
        dab(ctx, cx, by - 5, r, r * 0.7, 0, hsl(30, 30, 38));
        if (!ball) {
          dab(ctx, cx - 9, by - 4, 4.5, 3.4, 0.2, hsl(32, 40, 78));
          dab(ctx, cx - 13, by - 4, 1.2, 1.2, 0, hsl(250, 30, 12));
          dab(ctx, cx - 9.5, by - 5.5, 0.9, 1, 0, hsl(250, 30, 12));
        }
        break;
      }
      case 'deer_graze':
      case 'deer_alert': {
        const alert = kind === 'deer_alert';
        const fur = hsl(26, 55, 52);
        for (const lx of [-12, -7, 9, 13]) { ctx.fillStyle = hsl(24, 45, 38); ctx.fillRect(cx + lx - 1.5, by - 16, 3, 16); }
        dab(ctx, cx + 1, by - 20, 17, 8.5, 0, fur);
        dab(ctx, cx - 1, by - 23, 11, 3.5, 0, hsl(30, 60, 64, 0.7));
        for (let i = 0; i < 5; i++) dab(ctx, cx - 6 + i * 4, by - 22 + (i % 2), 1.1, 1, 0, hsl(35, 50, 90, 0.9));
        dab(ctx, cx + 17, by - 22, 2.6, 2.2, 0, '#fff');
        if (alert) {
          ctx.fillStyle = fur;
          ctx.beginPath(); ctx.moveTo(cx - 12, by - 24); ctx.lineTo(cx - 18, by - 40); ctx.lineTo(cx - 11, by - 40); ctx.lineTo(cx - 7, by - 25); ctx.fill();
          dab(ctx, cx - 17, by - 42, 5, 4.2, 0, fur);
          dab(ctx, cx - 21, by - 41, 2.4, 1.8, 0, hsl(30, 30, 30));
          dab(ctx, cx - 14, by - 48, 2, 3.4, 0.5, fur); dab(ctx, cx - 19, by - 48, 2, 3.4, -0.5, fur);
          dab(ctx, cx - 17.5, by - 43.5, 1, 1.1, 0, hsl(250, 30, 12));
        } else {
          ctx.fillStyle = fur;
          ctx.beginPath(); ctx.moveTo(cx - 12, by - 22); ctx.lineTo(cx - 20, by - 8); ctx.lineTo(cx - 14, by - 6); ctx.lineTo(cx - 7, by - 20); ctx.fill();
          dab(ctx, cx - 18, by - 6, 4.6, 3.6, 0.4, fur);
          dab(ctx, cx - 14, by - 11, 1.8, 3, 0.9, fur);
        }
        break;
      }
      case 'crab':
        for (const sx of [-1, 1]) {
          ctx.strokeStyle = hsl(8, 70, 46); ctx.lineWidth = 1.4;
          for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(cx + sx * 4, by - 4 + k); ctx.lineTo(cx + sx * 10, by - 1 + k * 0.5); ctx.stroke(); }
          dab(ctx, cx + sx * 9, by - 9, 3.2, 2.6, sx * 0.4, hsl(8, 75, 54));
        }
        dab(ctx, cx, by - 5, 7, 4.5, 0, hsl(8, 75, 56));
        dab(ctx, cx - 1, by - 6.5, 4, 1.6, 0, hsl(14, 85, 70, 0.8));
        dab(ctx, cx - 2.4, by - 10, 1, 1.2, 0, hsl(250, 30, 12)); dab(ctx, cx + 2.4, by - 10, 1, 1.2, 0, hsl(250, 30, 12));
        break;
      case 'owl':
      case 'owl_blink': {
        dab(ctx, cx, by - 10, 9, 11, 0, hsl(28, 35, 42));
        dab(ctx, cx, by - 7, 6, 7, 0, hsl(34, 40, 70));
        for (let i = 0; i < 6; i++) dab(ctx, cx + (i % 2 ? 2 : -2), by - 10 + i * 1.6, 1.2, 0.6, 0, hsl(28, 30, 40, 0.7));
        dab(ctx, cx - 6, by - 23, 2.4, 3.2, -0.4, hsl(28, 35, 38)); dab(ctx, cx + 6, by - 23, 2.4, 3.2, 0.4, hsl(28, 35, 38));
        dab(ctx, cx, by - 18, 9, 6.5, 0, hsl(28, 35, 46));
        if (kind === 'owl') {
          for (const sx of [-1, 1]) { dab(ctx, cx + sx * 4, by - 18, 3.4, 3.4, 0, hsl(48, 90, 70)); dab(ctx, cx + sx * 4, by - 18, 1.6, 1.8, 0, hsl(250, 30, 10)); }
        } else {
          ctx.strokeStyle = hsl(250, 30, 15); ctx.lineWidth = 1;
          for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * 4, by - 19, 2.4, 0.2, Math.PI - 0.2); ctx.stroke(); }
        }
        dab(ctx, cx, by - 15.5, 1.2, 1.6, 0, hsl(40, 60, 50));
        dab(ctx, cx - 3, by - 0.8, 2, 1, 0, hsl(40, 70, 50)); dab(ctx, cx + 3, by - 0.8, 2, 1, 0, hsl(40, 70, 50));
        break;
      }
      case 'sparrow':
        dab(ctx, cx + 1, by - 4, 4.6, 3.2, -0.2, hsl(28, 40, 46));
        dab(ctx, cx + 2, by - 5, 3, 1.6, -0.2, hsl(28, 30, 32));
        dab(ctx, cx - 3.4, by - 6.5, 2.6, 2.4, 0, hsl(26, 35, 40));
        dab(ctx, cx - 3, by - 3.5, 2.4, 1.6, 0, hsl(35, 30, 86));
        dab(ctx, cx - 6.3, by - 6.6, 1.2, 0.6, 0, hsl(40, 60, 40));
        dab(ctx, cx - 4.2, by - 7.2, 0.6, 0.7, 0, hsl(250, 30, 12));
        dab(ctx, cx + 6, by - 3.5, 2.6, 0.9, 0.3, hsl(28, 30, 32));
        break;
      case 'beetle':
        dab(ctx, cx, by - 3, 3.4, 2.6, 0, hsl(160, 60, 26));
        dab(ctx, cx - 0.8, by - 3.8, 1.6, 0.9, 0, hsl(150, 70, 55, 0.8));
        dab(ctx, cx - 3.4, by - 3, 1.3, 1.3, 0, hsl(160, 30, 14));
        break;
    }
  };
}

function paintPickup(kind: string) {
  return (ctx: Ctx, w: number, h: number) => {
    const cx = w / 2, cy = h / 2;
    if (kind === 'shell0' || kind === 'shell1') {
      const hh = kind === 'shell0' ? 20 : 345;
      ctx.fillStyle = hsl(hh, 60, 86);
      ctx.beginPath(); ctx.moveTo(cx, h - 1);
      for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI; ctx.lineTo(cx + Math.cos(a) * (w / 2 - 1), h - 3 + Math.sin(a) * (h - 4)); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hsl(hh, 40, 66); ctx.lineWidth = 0.8;
      for (let i = 1; i < 6; i++) { const a = Math.PI + (i / 6) * Math.PI; ctx.beginPath(); ctx.moveTo(cx, h - 1.5); ctx.lineTo(cx + Math.cos(a) * (w / 2 - 2), h - 3 + Math.sin(a) * (h - 5)); ctx.stroke(); }
    } else if (kind === 'starfish') {
      ctx.fillStyle = hsl(20, 80, 64); ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2; const r = i % 2 ? w * 0.18 : w * 0.46; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      ctx.fill();
      dab(ctx, cx, cy, 1.4, 1.4, 0, hsl(30, 90, 80));
    } else if (kind === 'apple' || kind === 'pear') {
      const fh = kind === 'apple' ? 4 : 52;
      dab(ctx, cx, cy + 1, w * 0.38, kind === 'pear' ? h * 0.36 : w * 0.38, 0, hsl(fh, 72, kind === 'apple' ? 52 : 60));
      if (kind === 'pear') dab(ctx, cx, cy - 2.5, w * 0.24, h * 0.22, 0, hsl(fh, 72, 60));
      dab(ctx, cx - 1.5, cy - 0.5, 1.4, 1.4, 0, hsl(fh, 80, 86));
      ctx.strokeStyle = hsl(28, 40, 28); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy - h * 0.3); ctx.lineTo(cx + 1, 0.5); ctx.stroke();
      dab(ctx, cx + 2.2, 1.4, 1.8, 0.9, -0.4, hsl(110, 50, 40));
    } else if (kind === 'acorn') {
      dab(ctx, cx, cy + 1.5, w * 0.32, h * 0.36, 0, hsl(32, 60, 48));
      dab(ctx, cx, cy - 1.5, w * 0.4, h * 0.2, 0, hsl(25, 30, 30));
      ctx.strokeStyle = hsl(25, 30, 26); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy - 3); ctx.lineTo(cx + 1, 0.5); ctx.stroke();
    }
  };
}

function paintIcon(kind: string) {
  return (ctx: Ctx, w: number, h: number) => {
    const cx = w / 2, cy = h / 2;
    switch (kind) {
      case 'ic_key':
        ctx.strokeStyle = hsl(32, 45, 46); ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(cx - 10, cy, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 2, cy); ctx.lineTo(cx + 18, cy); ctx.moveTo(cx + 12, cy); ctx.lineTo(cx + 12, cy + 7); ctx.moveTo(cx + 17, cy); ctx.lineTo(cx + 17, cy + 6); ctx.stroke();
        ctx.strokeStyle = hsl(36, 60, 66, 0.7); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx - 10, cy, 8, Math.PI, Math.PI * 1.6); ctx.stroke();
        for (let i = 0; i < 6; i++) dab(ctx, cx - 4 + i * 4, cy - 2 + (i % 2) * 3, 1.4, 1, 0, hsl(20, 60, 38, 0.6));
        break;
      case 'ic_crown': {
        for (let i = 0; i < 9; i++) {
          const a = Math.PI + (i / 8) * Math.PI;
          const x = cx + Math.cos(a) * 16, y = cy + 6 + Math.sin(a) * 8;
          dab(ctx, x, y + 3, 4, 3, a, hsl(110, 45, 40));
          const hue = [340, 48, 0, 270, 20][i % 5];
          dab(ctx, x, y, 3.6, 3.4, 0, hsl(hue, hue === 0 ? 0 : 80, hue === 0 ? 96 : 74));
          dab(ctx, x, y, 1.2, 1.2, 0, hsl(50, 90, 66));
        }
        ctx.strokeStyle = hsl(100, 40, 36); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy + 8, 17, 8, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
        break;
      }
      case 'ic_shells':
        ctx.strokeStyle = hsl(30, 20, 60); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy - 8, 15, 0.2, Math.PI - 0.2); ctx.stroke();
        for (let i = 0; i < 7; i++) {
          const a = 0.35 + (i / 6) * (Math.PI - 0.7);
          dab(ctx, cx + Math.cos(a) * 15, cy - 8 + Math.sin(a) * 15, 3, 3.6, a, hsl(i % 2 ? 20 : 345, 60, 84));
        }
        break;
      case 'ic_hood':
        ctx.fillStyle = hsl(22, 75, 54);
        ctx.beginPath(); ctx.moveTo(cx - 16, cy + 12); ctx.quadraticCurveTo(cx - 18, cy - 12, cx, cy - 12); ctx.quadraticCurveTo(cx + 18, cy - 12, cx + 16, cy + 12); ctx.closePath(); ctx.fill();
        for (const sx of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(cx + sx * 6, cy - 10); ctx.lineTo(cx + sx * 14, cy - 22); ctx.lineTo(cx + sx * 15, cy - 6); ctx.fill();
          ctx.fillStyle = hsl(30, 40, 92); ctx.beginPath(); ctx.moveTo(cx + sx * 9, cy - 10); ctx.lineTo(cx + sx * 13, cy - 17); ctx.lineTo(cx + sx * 13.5, cy - 9); ctx.fill();
          ctx.fillStyle = hsl(22, 75, 54);
        }
        dab(ctx, cx, cy + 3, 9, 7, 0, hsl(28, 50, 82));
        break;
      case 'ic_star':
        ctx.fillStyle = hsl(48, 90, 66); ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2; const r = i % 2 ? 7 : 16; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
        ctx.fill();
        break;
    }
  };
}

function paintBobber(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  dab(ctx, cx, h * 0.62, 4, 4.2, 0, '#fff');
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h * 0.6); ctx.clip();
  dab(ctx, cx, h * 0.62, 4, 4.2, 0, hsl(4, 80, 56)); ctx.restore();
  ctx.fillStyle = hsl(30, 30, 30); ctx.fillRect(cx - 0.6, 1, 1.2, h * 0.35);
  dab(ctx, cx - 1.4, h * 0.5, 1.2, 1, 0, 'rgba(255,255,255,0.8)');
}

function paintChime(ctx: Ctx, w: number, h: number) {
  ctx.strokeStyle = hsl(30, 30, 40); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, 6); ctx.stroke();
  dab(ctx, w / 2, 7, 7, 2, 0, hsl(28, 40, 40));
  for (let i = 0; i < 4; i++) {
    const x = 3 + i * ((w - 6) / 3), len = 14 + (i % 2) * 6 + i * 2;
    ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, 12); ctx.stroke();
    const g = ctx.createLinearGradient(x - 1.5, 0, x + 1.5, 0);
    g.addColorStop(0, hsl(190, 30, 90)); g.addColorStop(1, hsl(200, 20, 55));
    ctx.fillStyle = g; ctx.fillRect(x - 1.5, 12, 3, len);
  }
}

function paintFern(ctx: Ctx, w: number, h: number, seed: number) {
  const rng = mulberry32(seed);
  for (let f = 0; f < 6; f++) {
    const a = -Math.PI / 2 + rr(rng, -1.1, 1.1);
    const len = rr(rng, h * 0.6, h * 0.95);
    const bx = w / 2, by = h - 2;
    for (let i = 2; i < 12; i++) {
      const t = i / 12;
      const x = bx + Math.cos(a) * len * t + Math.sin(t * 3) * 2, y = by + Math.sin(a) * len * t;
      const lw = (1 - t) * 6 + 1.5;
      dab(ctx, x - Math.sin(a) * lw * 0.7, y + Math.cos(a) * lw * 0.7, lw, 1.3, a + 1.2, hsl(rr(rng, 110, 135), 45, rr(rng, 30, 46)));
      dab(ctx, x + Math.sin(a) * lw * 0.7, y - Math.cos(a) * lw * 0.7, lw, 1.3, a - 1.2, hsl(rr(rng, 110, 135), 45, rr(rng, 34, 50)));
    }
  }
}

function paintDriftwood(ctx: Ctx, w: number, h: number) {
  ctx.strokeStyle = hsl(32, 18, 70); ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(4, h * 0.6); ctx.quadraticCurveTo(w * 0.5, h * 0.3, w - 4, h * 0.55); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * 0.6, h * 0.45); ctx.lineTo(w * 0.75, h * 0.1); ctx.stroke();
  ctx.strokeStyle = hsl(30, 20, 84, 0.7); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(8, h * 0.5); ctx.quadraticCurveTo(w * 0.5, h * 0.22, w - 8, h * 0.45); ctx.stroke();
}

function paintDuneGrass(ctx: Ctx, w: number, h: number, seed: number) {
  const rng = mulberry32(seed);
  for (let i = 0; i < 14; i++) {
    const x = w / 2 + rr(rng, -8, 8), lean = rr(rng, -12, 12), len = rr(rng, h * 0.5, h - 2);
    ctx.strokeStyle = hsl(rr(rng, 55, 85), 40, rr(rng, 50, 70)); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x, h - 1); ctx.quadraticCurveTo(x + lean * 0.3, h - len * 0.6, x + lean, h - len); ctx.stroke();
  }
}

function paintDigSpot(ctx: Ctx, w: number, h: number, hole: boolean) {
  if (hole) {
    dab(ctx, w / 2, h / 2 + 1, w * 0.46, h * 0.42, 0, hsl(36, 30, 52));
    dab(ctx, w / 2, h / 2 + 1, w * 0.34, h * 0.3, 0, hsl(30, 35, 26));
    return;
  }
  ctx.strokeStyle = hsl(36, 30, 58, 0.6); ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * (0.18 + i * 0.12), h * (0.16 + i * 0.1), 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
}

export function paintAll2(scene: Phaser.Scene) {
  for (let i = 0; i < 2; i++) canvasTex(scene, `birch${i}`, 110, 230, (c) => paintBirch(c, 110, 230, 200 + i), 2.5);
  canvasTex(scene, 'apple0', 150, 180, (c) => paintTree(c, 150, 180, 'apple', 301), 2.5);
  canvasTex(scene, 'apple1', 150, 180, (c) => paintTree(c, 150, 180, 'pear', 302), 2.5);
  canvasTex(scene, 'windmill', 120, 190, (c) => paintWindmill(c, 120, 190), 2);
  canvasTex(scene, 'blades', 190, 190, (c) => paintBlades(c, 190), 2);
  canvasTex(scene, 'bellpost', 40, 96, (c) => paintBellPost(c, 40, 96));
  canvasTex(scene, 'bell', 28, 32, (c) => paintBell(c, 28, 32));
  canvasTex(scene, 'ribbon', 12, 22, (c) => paintRibbon(c, 12, 22));
  canvasTex(scene, 'bridge_deck', 260, 56, (c) => paintBridgeDeck(c, 260, 56), 2);
  canvasTex(scene, 'bridge_rail', 260, 16, (c) => paintRail(c, 260, 16), 2);
  canvasTex(scene, 'pier', 48, 200, (c) => paintPier(c, 48, 200), 2);
  canvasTex(scene, 'gate_closed', 64, 70, (c) => paintGate(c, 64, 70, false), 2.5);
  canvasTex(scene, 'gate_open', 64, 70, (c) => paintGate(c, 64, 70, true), 2.5);
  canvasTex(scene, 'pot', 26, 22, (c) => paintPot(c, 26, 22));
  canvasTex(scene, 'potflower', 26, 30, (c) => paintPotFlower(c, 26, 30));
  // Emblem sliced into four quadrants (each painted from the full emblem so edges line up).
  for (let q = 0; q < 4; q++) {
    canvasTex(scene, `tileq${q}`, 60, 60, (c) => { c.translate(-(q % 2) * 60, -Math.floor(q / 2) * 60); paintEmblem(c, 120); });
  }
  canvasTex(scene, 'emblem', 120, 120, (c) => paintEmblem(c, 120), 1);
  canvasTex(scene, 'slab', 64, 64, (c) => paintStoneSlab(c, 64), 2);
  canvasTex(scene, 'wstone', 20, 14, (c) => { dab(c, 10, 9, 9, 4.5, 0, 'rgba(40,30,20,0.3)'); dab(c, 10, 7, 8.5, 5, 0, hsl(40, 15, 94)); dab(c, 8, 5.5, 4, 1.8, 0, '#fff'); });
  canvasTex(scene, 'digspot', 40, 22, (c) => paintDigSpot(c, 40, 22, false), 2);
  canvasTex(scene, 'hole', 40, 22, (c) => paintDigSpot(c, 40, 22, true), 2);
  canvasTex(scene, 'driftwood', 70, 24, (c) => paintDriftwood(c, 70, 24), 2);
  for (let i = 0; i < 2; i++) canvasTex(scene, `dune${i}`, 30, 30, (c) => paintDuneGrass(c, 30, 30, 70 + i), 2.5);
  for (let i = 0; i < 2; i++) canvasTex(scene, `fern${i}`, 44, 32, (c) => paintFern(c, 44, 32, 80 + i), 2.5);
  canvasTex(scene, 'chime', 18, 40, (c) => paintChime(c, 18, 40));
  canvasTex(scene, 'bobber', 10, 14, (c) => paintBobber(c, 10, 14));
  const creatures: [string, number, number][] = [
    ['rabbit_sit', 24, 24], ['rabbit_hop', 28, 20], ['squirrel', 26, 26], ['hedgehog', 30, 18], ['hedgeball', 22, 18],
    ['deer_graze', 60, 40], ['deer_alert', 60, 54], ['crab', 26, 16], ['owl', 24, 28], ['owl_blink', 24, 28], ['sparrow', 16, 11], ['beetle', 10, 7],
  ];
  for (const [k, w, h] of creatures) { const f = paintCreature(k); canvasTex(scene, k, w, h, (c) => f(c, w, h)); }
  const pickups: [string, number, number][] = [['shell0', 12, 10], ['shell1', 12, 10], ['starfish', 14, 14], ['apple', 11, 12], ['pear', 11, 13], ['acorn', 9, 11]];
  for (const [k, w, h] of pickups) { const f = paintPickup(k); canvasTex(scene, k, w, h, (c) => f(c, w, h)); }
  for (const k of ['ic_key', 'ic_crown', 'ic_shells', 'ic_hood', 'ic_star']) { const f = paintIcon(k); canvasTex(scene, k, 48, 48, (c) => f(c, 48, 48), 2); }
  canvasTex(scene, 'mist', 128, 64, (c) => { c.save(); c.scale(1, 0.5); paintSoft(c, 128, 0.6, 1.4); c.restore(); }, 1);
  void softCircle;
}
