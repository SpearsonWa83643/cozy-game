// 69: "Chase it!" offer. When a thief runs off with your friends, a big friendly card asks if you
// want to chase it. "Chase it!" shows big tiles of the friends you still have: tap one to fly it.
// "Not now" hides the friends in their cells, like before. Plain DOM over the canvas (like the clue card).
import type Phaser from 'phaser';
import { theme } from '../theme';
import { sfx } from '../audio';
import { repaint } from '../art';
import { mountById, type MountDef } from '../mount/defs';

const CSS = `
#chase-offer{position:fixed;inset:0;z-index:22;display:flex;align-items:center;justify-content:center;font-family:'Nunito',system-ui,sans-serif;color:#2a1d14;
  background:rgba(20,30,60,.45);touch-action:manipulation;transition:opacity .25s ease;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);box-sizing:border-box}
#chase-offer.out{opacity:0;pointer-events:none}
#chase-offer *{box-sizing:border-box}
#chase-offer .o-card{width:min(820px,94vw);max-height:94%;overflow:auto;background:#fffaf0;border:5px solid var(--edge);border-radius:34px;
  box-shadow:0 12px 0 rgba(0,0,0,.16),0 24px 60px rgba(0,0,0,.35);padding:clamp(16px,3vh,28px) clamp(18px,3vw,34px);display:flex;flex-direction:column;gap:clamp(12px,2vh,18px);align-items:stretch;
  animation:o-in .4s cubic-bezier(.2,1.4,.4,1)}
@keyframes o-in{from{transform:scale(.9)}to{transform:none}}
#chase-offer h2{margin:0;text-align:center;font-weight:900;font-size:clamp(36px,5.6vw,54px);line-height:1.1}
#chase-offer .o-pics{display:flex;justify-content:center;align-items:flex-end;gap:10px}
#chase-offer .o-pics img{width:clamp(90px,14vh,130px);height:clamp(90px,14vh,130px);object-fit:contain;animation:o-bob 1.2s ease-in-out infinite alternate}
#chase-offer .o-pics img.thief{width:clamp(80px,12vh,112px);height:clamp(80px,12vh,112px)}
@keyframes o-bob{from{transform:translateY(0)}to{transform:translateY(-8px)}}
#chase-offer p{margin:0;text-align:center;font-size:clamp(26px,3.6vw,34px);font-weight:900;line-height:1.25}
#chase-offer button{border:0;font-family:inherit;font-weight:900;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
#chase-offer button:active{transform:translateY(3px) scale(.97)}
#chase-offer .o-go{min-height:110px;border-radius:30px;background:var(--accent);color:#fffaf0;font-size:clamp(46px,6vw,60px);box-shadow:0 8px 0 var(--accentDark);display:flex;align-items:center;justify-content:center;gap:16px}
#chase-offer .o-go svg{width:64px;height:64px}
#chase-offer .o-no{min-height:76px;border-radius:24px;background:#efe3cc;color:#5a4636;font-size:clamp(28px,3.6vw,36px);box-shadow:0 6px 0 #c9b796}
#chase-offer .o-row{display:flex;align-items:center;gap:12px}
#chase-offer .o-grid{flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
#chase-offer .o-tile{min-height:clamp(140px,22vh,190px);border-radius:26px;background:#fff3d6;border:4px solid var(--edge);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px;box-shadow:0 6px 0 rgba(0,0,0,.12);color:#2a1d14;font-size:clamp(20px,2.6vw,26px)}
#chase-offer .o-tile img{width:clamp(96px,15vh,132px);height:clamp(80px,12vh,110px);object-fit:contain}
#chase-offer .o-tile.pick{background:#fff;border-color:var(--accent);box-shadow:0 6px 0 var(--accentDark)}
#chase-offer .o-arrow{flex:0 0 auto;width:82px;height:120px;border-radius:24px;background:var(--accent);color:#fffaf0;font-size:48px;box-shadow:0 6px 0 var(--accentDark)}
#chase-offer .o-arrow[disabled]{opacity:.25}
@media (prefers-reduced-motion:reduce){#chase-offer *{animation:none!important}}
`;

const NET = '<svg viewBox="0 0 64 64"><circle cx="34" cy="28" r="20" fill="rgba(160,220,255,.5)" stroke="#fffaf0" stroke-width="4"/><path d="M18 20 L50 36 M18 36 L50 20 M34 8 V48 M14 28 H54" stroke="#fffaf0" stroke-width="2.5" opacity=".9"/><path d="M20 44 L8 58" stroke="#8a5a3a" stroke-width="7" stroke-linecap="round"/></svg>';

/** Test/inspection hook: window.__chaseOffer. */
const api = { open: false, step: '' as '' | 'ask' | 'pick', tiles: [] as string[], shown: 0, page: 0 };
(window as any).__chaseOffer = api;

function pic(key: string) {
  try { return repaint(key)?.toDataURL() ?? ''; } catch { return ''; }
}

export type OfferOpts = {
  kindName: string; thiefKey: string; taken: string[]; mounts: MountDef[];
  onChase: (mountId: string) => void; onSkip: () => void;
};

/** Open the offer card. Exactly one of onChase / onSkip is called. */
export function showChaseOffer(o: OfferOpts) {
  const game: Phaser.Game | undefined = (window as any).__game;
  document.getElementById('chase-offer')?.remove();
  if (!document.getElementById('chase-offer-css')) {
    const st = document.createElement('style'); st.id = 'chase-offer-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const e = theme.entry;
  const el = document.createElement('div');
  el.id = 'chase-offer';
  el.setAttribute('role', 'dialog');
  el.style.setProperty('--edge', e.cardEdge); el.style.setProperty('--accent', e.accent); el.style.setProperty('--accentDark', e.accentDark);
  const card = document.createElement('div'); card.className = 'o-card';
  el.appendChild(card);
  for (const ev of ['touchstart', 'touchend', 'touchcancel', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'keypress', 'click']) el.addEventListener(ev, (x) => x.stopPropagation());
  const kb = game?.input?.keyboard as any;
  if (kb) kb.enabled = false;
  let done = false;
  const finish = (fn: () => void) => {
    if (done) return;
    done = true;
    api.open = false; api.step = '';
    el.classList.add('out');
    if (kb) kb.enabled = true;
    window.removeEventListener('keydown', onKey, true);
    setTimeout(() => el.remove(), 260);
    fn();
  };
  const go = (id: string) => finish(() => { sfx.solve?.(); o.onChase(id); });
  const skip = () => finish(() => { sfx.blip?.(); o.onSkip(); });
  const names = o.taken.map((id) => mountById(id)?.name ?? 'friend');
  const one = names.length === 1;

  const ask = () => {
    api.step = 'ask';
    card.innerHTML = '';
    const h = document.createElement('h2'); h.textContent = `Chase the ${o.kindName}?`; card.appendChild(h);
    const pics = document.createElement('div'); pics.className = 'o-pics';
    const tp = pic(o.thiefKey);
    if (tp) { const im = document.createElement('img'); im.src = tp; im.className = 'thief'; im.alt = o.kindName; pics.appendChild(im); }
    for (const id of o.taken) { const m = mountById(id); const src = m ? pic(m.body) : ''; if (src) { const im = document.createElement('img'); im.src = src; im.alt = m!.name; pics.appendChild(im); } }
    card.appendChild(pics);
    const p = document.createElement('p'); p.textContent = one ? `It has your ${names[0]}! Fly after it and catch it with bubble nets!` : `It has ${names.length} of your friends! Fly after it and catch it with bubble nets!`;
    card.appendChild(p);
    const b = document.createElement('button'); b.className = 'o-go'; b.setAttribute('aria-label', 'Chase it!'); b.innerHTML = `${NET}<span>Chase it!</span>`;
    b.addEventListener('click', () => { if (o.mounts.length === 1) go(o.mounts[0].id); else { sfx.blip?.(); pick(); } });
    card.appendChild(b);
    const n = document.createElement('button'); n.className = 'o-no'; n.textContent = 'Not now'; n.addEventListener('click', skip);
    card.appendChild(n);
  };

  const PER = 6;
  const pick = () => {
    api.step = 'pick';
    card.innerHTML = '';
    const h = document.createElement('h2'); h.textContent = 'Who will fly?'; card.appendChild(h);
    const row = document.createElement('div'); row.className = 'o-row';
    const prev = document.createElement('button'); prev.className = 'o-arrow'; prev.textContent = '◀'; prev.setAttribute('aria-label', 'More friends');
    const grid = document.createElement('div'); grid.className = 'o-grid';
    const next = document.createElement('button'); next.className = 'o-arrow'; next.textContent = '▶'; next.setAttribute('aria-label', 'More friends');
    const pages = Math.ceil(o.mounts.length / PER);
    const draw = () => {
      grid.innerHTML = '';
      const list = o.mounts.slice(api.page * PER, api.page * PER + PER);
      api.tiles = list.map((m) => m.id);
      list.forEach((m, i) => {
        const t = document.createElement('button'); t.className = 'o-tile' + (api.page === 0 && i === 0 ? ' pick' : ''); t.dataset.mount = m.id; t.setAttribute('aria-label', `Fly the ${m.name}`);
        const src = pic(m.body);
        if (src) { const im = document.createElement('img'); im.src = src; im.alt = ''; t.appendChild(im); }
        const s = document.createElement('span'); s.textContent = m.name; t.appendChild(s);
        t.addEventListener('click', () => go(m.id));
        grid.appendChild(t);
      });
      prev.disabled = api.page <= 0; next.disabled = api.page >= pages - 1;
    };
    prev.addEventListener('click', () => { if (api.page > 0) { api.page--; sfx.blip?.(); draw(); } });
    next.addEventListener('click', () => { if (api.page < pages - 1) { api.page++; sfx.blip?.(); draw(); } });
    if (pages > 1) row.appendChild(prev);
    row.appendChild(grid);
    if (pages > 1) row.appendChild(next);
    card.appendChild(row);
    draw();
    const n = document.createElement('button'); n.className = 'o-no'; n.textContent = 'Not now'; n.addEventListener('click', skip);
    card.appendChild(n);
  };

  const onKey = (k: KeyboardEvent) => {
    if (k.key === 'Escape') { k.stopPropagation(); skip(); }
    else if (k.key === 'Enter' || k.key === ' ') { k.stopPropagation(); if (api.step === 'ask') (card.querySelector('.o-go') as HTMLButtonElement)?.click(); else go(api.tiles[0]); }
  };
  window.addEventListener('keydown', onKey, true);
  api.page = 0; api.tiles = o.mounts.map((m) => m.id).slice(0, PER);
  ask();
  document.body.appendChild(el);
  api.open = true; api.shown++;
  Object.assign(api, { chase: (id?: string) => go(id ?? o.mounts[0].id), skip });
  sfx.whistle?.();
  return true;
}
