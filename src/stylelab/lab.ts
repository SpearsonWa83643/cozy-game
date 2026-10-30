// Mount Style Lab (temporary, ?stylelab=1): two mounts side by side in the same art style,
// with big touch buttons (and swipe / arrow keys) to flip between styles. Plain DOM + Canvas 2D,
// no Phaser. Each style's flap/cape cycle is pre-rendered into a small frame cache, then played
// back with a gentle CSS bob so even the heavy painterly styles stay smooth on an iPad.
import '../style.css';
import { LAB_MOUNTS } from './mounts';
import { LAB_STYLES, pixelate, type LabStyle } from './styles';
import { TAU } from './geo';

const FRAMES = 12;
const FPS = 10;
const DPR = Math.min(2, window.devicePixelRatio || 1);

export const LAB_CSS = `
#lab { position: fixed; inset: 0; display: flex; flex-direction: column; background: #1f2622; color: #f6efdc;
  font-family: Nunito, system-ui, sans-serif; user-select: none; -webkit-user-select: none; touch-action: none; }
#lab header { display: flex; align-items: center; gap: 14px; padding: max(10px, env(safe-area-inset-top)) 18px 6px; }
#lab header .tag { font-size: 13px; letter-spacing: .12em; text-transform: uppercase; opacity: .65; font-weight: 800; }
#lab header .count { margin-left: auto; font-weight: 800; font-size: 15px; opacity: .8; }
#lab .stage { flex: 1; display: flex; gap: 14px; padding: 6px 14px; min-height: 0; }
#lab .panel { position: relative; flex: 1; border-radius: 22px; overflow: hidden; box-shadow: 0 6px 24px rgba(0,0,0,.35); }
#lab .panel canvas { position: absolute; display: block; }
#lab .panel .bg { inset: 0; width: 100%; height: 100%; }
#lab .panel .name { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); background: rgba(20,24,22,.62);
  padding: 6px 16px; border-radius: 999px; font-weight: 800; font-size: 17px; white-space: nowrap; }
#lab footer { display: flex; align-items: center; gap: 14px; padding: 10px 14px max(14px, env(safe-area-inset-bottom)); }
#lab button { flex: none; width: 96px; height: 76px; border-radius: 22px; border: 0; background: #f3c35a; color: #3a2a10;
  font: 900 34px Nunito, sans-serif; box-shadow: 0 5px 0 #b98a2a; touch-action: manipulation; }
#lab button:active { transform: translateY(4px); box-shadow: 0 1px 0 #b98a2a; }
#lab .label { flex: 1; text-align: center; min-width: 0; }
#lab .label .style { font-size: 30px; font-weight: 900; line-height: 1.1; }
#lab .label .blurb { font-size: 15px; opacity: .8; margin-top: 4px; }
#lab .dots { display: flex; gap: 8px; justify-content: center; margin-top: 8px; }
#lab .dots i { width: 11px; height: 11px; border-radius: 50%; background: rgba(255,255,255,.25); }
#lab .dots i.on { background: #f3c35a; }
@media (orientation: portrait) { #lab .stage { flex-direction: column; } }
`;

type Panel = { el: HTMLDivElement; bg: HTMLCanvasElement; sprite: HTMLCanvasElement; frames: HTMLCanvasElement[]; size: number; mount: number };

export function startStyleLab() {
  document.getElementById('loading')?.remove();
  document.getElementById('game')?.remove();
  const st = document.createElement('style'); st.textContent = LAB_CSS; document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'lab';
  root.innerHTML = `
    <header><span class="tag">Mount Style Lab · temporary</span><span class="count"></span></header>
    <div class="stage"></div>
    <footer>
      <button class="prev" aria-label="Previous style">‹</button>
      <div class="label"><div class="style"></div><div class="blurb"></div><div class="dots"></div></div>
      <button class="next" aria-label="Next style">›</button>
    </footer>`;
  document.body.appendChild(root);
  const stage = root.querySelector('.stage') as HTMLDivElement;
  const q = new URLSearchParams(location.search);
  let idx = Math.max(0, LAB_STYLES.findIndex((s) => s.id === q.get('s')));
  if (/^\d+$/.test(q.get('s') ?? '')) idx = Math.min(LAB_STYLES.length - 1, Math.max(0, Number(q.get('s')) - 1));

  const panels: Panel[] = LAB_MOUNTS.map((m, i) => {
    const el = document.createElement('div'); el.className = 'panel';
    const bg = document.createElement('canvas'); bg.className = 'bg';
    const sprite = document.createElement('canvas');
    const name = document.createElement('div'); name.className = 'name'; name.textContent = m.name;
    el.append(bg, sprite, name); stage.appendChild(el);
    return { el, bg, sprite, frames: [], size: 0, mount: i };
  });
  const dots = root.querySelector('.dots') as HTMLDivElement;
  dots.innerHTML = LAB_STYLES.map(() => '<i></i>').join('');

  let token = 0;
  function layout() {
    const style = LAB_STYLES[idx];
    (root.querySelector('.style') as HTMLElement).textContent = style.name;
    (root.querySelector('.blurb') as HTMLElement).textContent = style.blurb;
    (root.querySelector('.count') as HTMLElement).textContent = `Style ${idx + 1} of ${LAB_STYLES.length}`;
    dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === idx));
    const u = new URL(location.href); u.searchParams.set('s', style.id); history.replaceState(null, '', u);
    const my = ++token;
    for (const p of panels) {
      const r = p.el.getBoundingClientRect();
      p.bg.width = Math.round(r.width * DPR); p.bg.height = Math.round(r.height * DPR);
      const bc = p.bg.getContext('2d')!; bc.clearRect(0, 0, p.bg.width, p.bg.height); style.backdrop(bc, p.bg.width, p.bg.height);
      const size = Math.min(r.width * 0.96, r.height * 0.88);
      p.size = size;
      Object.assign(p.sprite.style, { width: `${size}px`, height: `${size}px`, left: `${(r.width - size) / 2}px`, top: `${(r.height - size) / 2 - r.height * 0.03}px` });
      const px = Math.min(1100, Math.round(size * DPR));
      p.sprite.width = p.sprite.height = px;
      p.frames = [];
      const sc = p.sprite.getContext('2d')!; sc.imageSmoothingEnabled = !style.pixel;
    }
    // Render frames progressively: frame 0 for both panels first so something shows at once.
    let f = 0;
    const step = () => {
      if (my !== token || f >= FRAMES) return;
      for (const p of panels) p.frames[f] = renderFrame(style, p.mount, f, p.sprite.width);
      f++;
      requestAnimationFrame(step);
    };
    step();
  }

  function renderFrame(style: LabStyle, mi: number, f: number, px: number): HTMLCanvasElement {
    const phase = (f / FRAMES) * TAU;
    const parts = LAB_MOUNTS[mi].parts(phase);
    const res = style.pixel ?? px;
    const cv = document.createElement('canvas'); cv.width = cv.height = res;
    const c = cv.getContext('2d')!;
    c.scale(res / 512, res / 512);
    c.translate(256, 262); c.scale(0.9, 0.9); c.translate(-256, -256); // breathing room for capes / wingtips
    style.render(c, parts);
    if (style.pixel) pixelate(cv);
    return cv;
  }

  const go = (d: number) => { idx = (idx + d + LAB_STYLES.length) % LAB_STYLES.length; layout(); };
  (root.querySelector('.prev') as HTMLButtonElement).addEventListener('click', () => go(-1));
  (root.querySelector('.next') as HTMLButtonElement).addEventListener('click', () => go(1));
  window.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); });
  let sx = 0, sy = 0;
  stage.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  stage.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(layout, 150); });

  // Playback: frame-cached flap/cape + a gentle CSS bob (each mount slightly out of step).
  let freeze: number | null = q.has('freeze') ? Number(q.get('freeze')) % FRAMES : null;
  let shown: (HTMLCanvasElement | undefined)[] = [];
  const t0 = performance.now();
  const tick = (now: number) => {
    const t = (now - t0) / 1000;
    const fi = freeze ?? Math.floor(t * FPS) % FRAMES;
    panels.forEach((p, i) => {
      const fr = p.frames[fi] ?? p.frames[0];
      if (fr && shown[i] !== fr) {
        const c = p.sprite.getContext('2d')!;
        c.imageSmoothingEnabled = !LAB_STYLES[idx].pixel;
        c.clearRect(0, 0, p.sprite.width, p.sprite.height);
        c.drawImage(fr, 0, 0, p.sprite.width, p.sprite.height);
        shown[i] = fr;
      }
      const bob = Math.sin(t * 1.6 + i * 1.3) * p.size * 0.022;
      const tilt = Math.sin(t * 1.1 + i) * 1.6;
      p.sprite.style.transform = `translateY(${bob.toFixed(2)}px) rotate(${tilt.toFixed(2)}deg)`;
    });
    requestAnimationFrame(tick);
  };
  layout();
  requestAnimationFrame(tick);
  (window as any).__stylelab = { go, count: LAB_STYLES.length, styles: LAB_STYLES.map((s) => s.id), freeze: (f: number | null) => { freeze = f; }, ready: () => panels.every((p) => p.frames.length === FRAMES && p.frames.every(Boolean)) };
}
