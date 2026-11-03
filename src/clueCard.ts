// 57 (Walker, Nov 2): rescue clues are the thing kids most want to read, so they open as one big,
// centered card with very simple words. It never times out: tap anywhere (or OK) to close it.
// Plain DOM over the canvas (like the What's new note), so it reads the same over any scene.
import type Phaser from 'phaser';
import { theme } from './theme';
import { sfx } from './audio';
import { repaint } from './art';
import { save, type Stolen } from './save';
import { mountById } from './mount/defs';

/** Short, simple names for the puzzle spots. */
export const PLACE: Record<string, string> = {
  pots: 'the flower pots', bells: 'the bells', tiles: 'the tiles',
  dig: 'the dig spot', stones: 'the stones', trail: 'the deer tracks',
};
const ICON: Record<string, string> = {
  pots: '<svg viewBox="0 0 40 40"><path d="M10 22h20l-3 14H13z" fill="#d9774a" stroke="#7a3a18" stroke-width="2.5" stroke-linejoin="round"/><circle cx="20" cy="12" r="5" fill="#ffd34d"/><g fill="#ff6f91"><circle cx="20" cy="5" r="4"/><circle cx="27" cy="12" r="4"/><circle cx="13" cy="12" r="4"/><circle cx="20" cy="19" r="4"/></g><circle cx="20" cy="12" r="3.4" fill="#ffd34d"/></svg>',
  bells: '<svg viewBox="0 0 40 40"><path d="M20 5c-7 0-10 6-10 13v7l-4 5h28l-4-5v-7c0-7-3-13-10-13z" fill="#ffd34d" stroke="#a5741d" stroke-width="2.5" stroke-linejoin="round"/><circle cx="20" cy="34" r="3.5" fill="#a5741d"/></svg>',
  tiles: '<svg viewBox="0 0 40 40"><g stroke="#4a6a8a" stroke-width="2.5"><rect x="5" y="5" width="13" height="13" rx="3" fill="#8fd0ff"/><rect x="22" y="5" width="13" height="13" rx="3" fill="#ffd34d"/><rect x="5" y="22" width="13" height="13" rx="3" fill="#ff9ab8"/><rect x="22" y="22" width="13" height="13" rx="3" fill="#9be07a"/></g></svg>',
  dig: '<svg viewBox="0 0 40 40"><ellipse cx="20" cy="32" rx="15" ry="5" fill="#8a5a3a"/><path d="M26 4l-4 16" stroke="#7a4f2c" stroke-width="4" stroke-linecap="round"/><path d="M15 18h12l-2 10h-8z" fill="#b8c4cc" stroke="#5a6670" stroke-width="2.5" stroke-linejoin="round"/></svg>',
  stones: '<svg viewBox="0 0 40 40"><rect x="2" y="24" width="36" height="12" rx="6" fill="#8fd0ff"/><g fill="#c9c2b5" stroke="#6a6258" stroke-width="2.5"><ellipse cx="10" cy="27" rx="6" ry="4"/><ellipse cx="22" cy="20" rx="6" ry="4"/><ellipse cx="32" cy="12" rx="6" ry="4"/></g></svg>',
  trail: '<svg viewBox="0 0 40 40"><g fill="#7a4f2c"><ellipse cx="10" cy="30" rx="3" ry="5"/><ellipse cx="16" cy="30" rx="3" ry="5"/><ellipse cx="22" cy="14" rx="3" ry="5"/><ellipse cx="28" cy="14" rx="3" ry="5"/></g></svg>',
};

/** One very simple clue line for a hidden friend. `here`: you are already at its cell. */
export function clueLine(st: Stolen, here = false) {
  const name = mountById(st.mount)?.name ?? 'friend';
  const place = PLACE[st.puzzle] ?? 'a puzzle';
  return here ? `Your ${name} is in this cell. Solve ${place}. Then tap the cell.`
    : `Your ${name} is in a cell. Go to ${place}. Solve it. Tap the cell.`;
}

const CSS = `
#clue{position:fixed;inset:0;z-index:21;display:flex;align-items:center;justify-content:center;font-family:'Nunito',system-ui,sans-serif;color:#2a1d14;
  background:rgba(0,0,0,.45);touch-action:manipulation;transition:opacity .25s ease;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);box-sizing:border-box}
#clue.out{opacity:0;pointer-events:none}
#clue *{box-sizing:border-box}
#clue .c-card{width:min(760px,94vw);max-height:94%;overflow:auto;background:#fffaf0;border:5px solid var(--edge);border-radius:34px;
  box-shadow:0 12px 0 rgba(0,0,0,.16),0 24px 60px rgba(0,0,0,.35);padding:clamp(18px,3vh,30px) clamp(20px,3vw,36px);display:flex;flex-direction:column;gap:clamp(12px,2vh,20px);
  animation:c-in .4s cubic-bezier(.2,1.4,.4,1)}
@keyframes c-in{from{transform:scale(.92)}to{transform:none}}
#clue h2{margin:0;text-align:center;font-weight:900;font-size:clamp(38px,6vw,56px);line-height:1.1;color:#2a1d14}
#clue ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px}
#clue li{display:flex;align-items:center;gap:16px;background:#fff3d6;border:4px solid var(--edge);border-radius:24px;padding:12px 16px;font-size:clamp(28px,4vw,38px);font-weight:900;line-height:1.25}
#clue li .c-pics{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:6px}
#clue li img{width:96px;height:96px;object-fit:contain}
#clue li svg{width:52px;height:52px}
#clue .c-ok{min-height:96px;border:0;border-radius:28px;background:var(--accent);color:#fffaf0;font-family:inherit;font-size:48px;font-weight:900;box-shadow:0 7px 0 var(--accentDark);cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
#clue .c-ok:active{transform:translateY(3px) scale(.97)}
@media (prefers-reduced-motion:reduce){#clue *{animation:none!important}}
`;

const api = { open: false, shown: 0, title: '', lines: [] as string[] };
(window as any).__clue = api;

function friendPic(id: string) {
  const m = mountById(id);
  if (!m) return '';
  // Atlas canvases are released after upload (iPad memory), so paint the friend again.
  try { return repaint(m.body)?.toDataURL() ?? ''; } catch { return ''; }
}

/** Open the big clue card for these hidden friends (default: all of them). */
export function showClue(list: Stolen[] = save.stolen ?? [], opts: { here?: boolean; title?: string } = {}) {
  if (!list.length) return false;
  const game: Phaser.Game | undefined = (window as any).__game;
  document.getElementById('clue')?.remove();
  if (!document.getElementById('clue-css')) {
    const st = document.createElement('style'); st.id = 'clue-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const e = theme.entry;
  const el = document.createElement('div');
  el.id = 'clue';
  el.setAttribute('role', 'dialog');
  el.style.setProperty('--edge', e.cardEdge); el.style.setProperty('--accent', e.accent); el.style.setProperty('--accentDark', e.accentDark);
  const title = opts.title ?? (list.length === 1 ? 'Help your friend!' : 'Help your friends!');
  el.innerHTML = `<div class="c-card"><h2></h2><ul></ul><button class="c-ok" aria-label="OK, close">OK!</button></div>`;
  el.querySelector('h2')!.textContent = title;
  const ul = el.querySelector('ul')!;
  const lines: string[] = [];
  for (const st of list) {
    const li = document.createElement('li');
    const pics = document.createElement('div'); pics.className = 'c-pics';
    const src = friendPic(st.mount);
    if (src) { const im = document.createElement('img'); im.src = src; im.alt = mountById(st.mount)?.name ?? ''; pics.appendChild(im); }
    pics.insertAdjacentHTML('beforeend', ICON[st.puzzle] ?? '');
    li.appendChild(pics);
    const span = document.createElement('span'); const t = clueLine(st, opts.here); span.textContent = t; lines.push(t);
    li.appendChild(span); ul.appendChild(li);
  }
  for (const ev of ['touchstart', 'touchend', 'touchcancel', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'keypress']) el.addEventListener(ev, (x) => x.stopPropagation());
  const kb = game?.input?.keyboard as any;
  if (kb) kb.enabled = false;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    sfx.blip?.();
    api.open = false;
    el.classList.add('out');
    if (kb) kb.enabled = true;
    window.removeEventListener('keydown', onKey, true);
    setTimeout(() => el.remove(), 280);
  };
  const onKey = (k: KeyboardEvent) => { if (k.key === 'Escape' || k.key === 'Enter' || k.key === ' ') { k.stopPropagation(); close(); } };
  window.addEventListener('keydown', onKey, true);
  // No timeout: it stays until you tap (anywhere on it, or OK).
  el.addEventListener('click', close);
  document.body.appendChild(el);
  api.open = true; api.shown++; api.title = title; api.lines = lines;
  (api as any).close = close;
  sfx.sparkle();
  return true;
}
