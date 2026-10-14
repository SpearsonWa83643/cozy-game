// Entry screen: a living, themed "who's playing?" card shown over the glade on load.
// Name + birthday are optional and stay on this device (localStorage only, nothing is sent).
// It is plain DOM on top of the canvas so the iPad's own keyboard works for the name field.
// Colours and drifting decorations come from theme.entry, so a new theme just plugs in.
import type Phaser from 'phaser';
import { theme, setTheme, THEMES, THEME_ORDER, themeEvents, type Theme } from './theme';
import { sfx } from './audio';

export type Player = { v: 1; name: string; dob: string | null; seen: boolean };
const KEY = 'cozy.player.v1';
export const NAME_MAX = 16;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Letters (any language), numbers, spaces and a little punctuation; trimmed, max 16. */
export function cleanName(raw: string): string {
  return raw.normalize('NFC').replace(/[^\p{L}\p{M}\p{N} '\u2019.\-]/gu, '').replace(/\s+/g, ' ').trimStart().slice(0, NAME_MAX);
}
const finalName = (raw: string) => cleanName(raw).trim();

function validDob(s: unknown): string | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m) ? s : null;
}
const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate();
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function loadPlayer(): Player {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && typeof d === 'object') return { v: 1, name: finalName(String(d.name ?? '')), dob: validDob(d.dob), seen: !!d.seen };
  } catch { /* storage unavailable or corrupt */ }
  return { v: 1, name: '', dob: null, seen: false };
}
function savePlayer(p: Player) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } }

export const player: Player = loadPlayer();

export function ageOn(dob: string, now = new Date()): number {
  const [y, m, d] = dob.split('-').map(Number);
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return a;
}
export const isBirthday = (dob: string | null, now = new Date()) => {
  if (!dob) return false;
  const [, m, d] = dob.split('-').map(Number);
  return now.getMonth() + 1 === m && now.getDate() === d;
};

// ------------------------------------------------------------------ decorations
const SHAPES: Record<EntryShape, (c: string) => string> = {
  leaf: (c) => `<svg viewBox="0 0 40 40"><path d="M6 34 C6 14 20 5 35 5 C35 22 26 34 6 34Z" fill="${c}"/><path d="M7 33 L27 13" stroke="rgba(0,0,0,0.22)" stroke-width="2" stroke-linecap="round"/></svg>`,
  petal: (c) => `<svg viewBox="0 0 40 40"><ellipse cx="20" cy="20" rx="9" ry="16" fill="${c}"/></svg>`,
  snow: (c) => `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="9" fill="${c}"/></svg>`,
  bat: (c) => `<svg viewBox="0 0 60 30"><path d="M30 12 C27 6 22 6 20 10 C16 4 8 4 2 10 C8 12 10 18 12 22 C16 18 22 18 26 22 L30 18 L34 22 C38 18 44 18 48 22 C50 18 52 12 58 10 C52 4 44 4 40 10 C38 6 33 6 30 12Z" fill="${c}"/><circle cx="27.5" cy="12" r="1.3" fill="#ffcf7a"/><circle cx="32.5" cy="12" r="1.3" fill="#ffcf7a"/></svg>`,
};
type EntryShape = Theme['entry']['drift']['shape'];

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const CSS = `
#entry{position:fixed;inset:0;z-index:20;font-family:'Nunito',system-ui,sans-serif;color:var(--ink);display:flex;align-items:center;justify-content:center;
  overflow:hidden;touch-action:manipulation;transition:opacity .5s ease;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);box-sizing:border-box}
#entry.out{opacity:0;pointer-events:none}
#entry *{box-sizing:border-box}
#entry .e-sky{position:absolute;inset:0;background:linear-gradient(180deg,var(--sky1),var(--sky2) 55%,var(--sky3));transition:background .6s}
#entry .e-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#entry .e-d{position:absolute;top:-60px;width:var(--s);height:var(--s);animation:e-fall var(--t) linear var(--dl) infinite;opacity:.9}
#entry .e-d>i{display:block;width:100%;height:100%;animation:e-sway calc(var(--t)/4) ease-in-out var(--dl) infinite alternate}
#entry .e-d svg{width:100%;height:100%;display:block}
#entry .e-d.bat{top:var(--y);left:-90px;width:calc(var(--s)*1.6);animation:e-fly var(--t) linear var(--dl) infinite}
#entry .e-d.bat>i{animation:e-flap .32s ease-in-out infinite alternate}
#entry .e-g{position:absolute;width:var(--s);height:var(--s);border-radius:50%;background:var(--c);box-shadow:0 0 10px 4px var(--c);left:var(--x);top:var(--y);
  animation:e-float var(--t) ease-in-out var(--dl) infinite alternate,e-blink calc(var(--t)/2.5) ease-in-out var(--dl) infinite alternate}
@keyframes e-fall{from{transform:translate3d(var(--x),0,0) rotate(0)}to{transform:translate3d(calc(var(--x) + var(--dx)),calc(100vh + 120px),0) rotate(var(--r))}}
@keyframes e-sway{from{transform:translateX(-18px) rotate(-14deg)}to{transform:translateX(18px) rotate(14deg)}}
@keyframes e-fly{from{transform:translate3d(0,0,0)}50%{transform:translate3d(55vw,var(--dy),0)}to{transform:translate3d(calc(100vw + 180px),0,0)}}
@keyframes e-flap{from{transform:scaleY(1)}to{transform:scaleY(.45)}}
@keyframes e-float{from{transform:translate(0,0)}to{transform:translate(var(--dx),var(--dy))}}
@keyframes e-blink{from{opacity:.15}to{opacity:1}}
#entry .e-wrap{position:relative;display:flex;flex-direction:column;align-items:center;gap:min(2.2vh,18px);width:min(780px,94vw);max-height:100%;padding:12px 0}
#entry .e-title{margin:0;font-weight:900;font-size:clamp(40px,min(8.5vw,10vh),88px);line-height:1.05;color:var(--title);white-space:nowrap;text-align:center;
  -webkit-text-stroke:3px var(--titleEdge);paint-order:stroke fill;text-shadow:0 6px 0 var(--titleEdge),0 10px 24px rgba(0,0,0,.35);animation:e-swing 5s ease-in-out infinite alternate;transform-origin:50% 0}
#entry .e-title span{display:inline-block;animation:e-bob 2.4s ease-in-out infinite;animation-delay:calc(var(--i)*-0.16s)}
#entry .e-title .sp{width:.3em}
@keyframes e-swing{from{transform:rotate(-1.6deg)}to{transform:rotate(1.6deg)}}
@keyframes e-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-.09em)}}
#entry .e-card{width:100%;background:var(--card);border:3px solid var(--cardEdge);border-radius:30px;box-shadow:0 12px 0 rgba(0,0,0,.14),0 22px 50px rgba(0,0,0,.3);
  padding:clamp(16px,2.6vh,26px) clamp(18px,3vw,32px);display:flex;flex-direction:column;gap:clamp(10px,1.8vh,16px);animation:e-in .5s cubic-bezier(.2,1.4,.4,1)}
@keyframes e-in{from{transform:translateY(24px) scale(.96);opacity:0}to{transform:none;opacity:1}}
#entry .e-lab{font-size:22px;font-weight:900;color:var(--soft);display:flex;align-items:center;justify-content:space-between;min-height:30px}
#entry .e-namebox{position:relative}
#entry input.e-name{width:100%;height:84px;border-radius:22px;border:3px solid var(--cardEdge);background:var(--field);color:var(--ink);font:900 46px 'Nunito',system-ui,sans-serif;
  padding:0 84px 0 24px;outline:none;-webkit-user-select:text;user-select:text;touch-action:manipulation;letter-spacing:.02em}
#entry input.e-name:focus{border-color:var(--accent);box-shadow:0 0 0 5px color-mix(in srgb,var(--accent) 30%,transparent)}
#entry input.e-name::placeholder{color:var(--soft);opacity:.55;font-weight:800}
#entry button{font-family:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;border:0;color:inherit;user-select:none;-webkit-user-select:none}
#entry button:active{transform:translateY(3px) scale(.97)}
#entry .e-x{position:absolute;right:12px;top:12px;width:60px;height:60px;border-radius:50%;background:rgba(0,0,0,.08);font-size:34px;font-weight:900;color:var(--soft);line-height:1}
#entry .e-x[hidden]{display:none}
#entry .e-pill{min-height:48px;padding:0 20px;border-radius:24px;background:rgba(0,0,0,.07);font-size:18px;font-weight:800;color:var(--soft)}
#entry .e-dob{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:12px}
#entry .e-step{display:flex;flex-direction:column;align-items:center;gap:6px}
#entry .e-steplab{font-size:17px;font-weight:800;color:var(--soft)}
#entry .e-row{display:flex;align-items:center;gap:6px;width:100%}
#entry .e-pm{flex:0 0 auto;width:64px;height:76px;border-radius:20px;background:var(--accent);color:#fffaf0;font-size:44px;font-weight:900;line-height:1;box-shadow:0 5px 0 var(--accentDark)}
#entry .e-val{flex:1;min-width:0;height:76px;border-radius:18px;background:var(--field);border:3px solid var(--cardEdge);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
#entry .e-val b{font-size:38px;font-weight:900}
#entry .e-val small{font-size:15px;font-weight:800;color:var(--soft);margin-top:2px}
#entry .e-val.unset b{color:var(--soft);opacity:.5}
#entry .e-age{text-align:center;font-size:24px;font-weight:900;color:var(--accentDark);min-height:30px}
#entry .e-btns{display:flex;gap:16px;align-items:stretch}
#entry .e-play{flex:1;min-height:92px;border-radius:28px;background:var(--accent);color:#fffaf0;font-size:44px;font-weight:900;box-shadow:0 7px 0 var(--accentDark);display:flex;align-items:center;justify-content:center;gap:14px;
  animation:e-pulse 1.8s ease-in-out infinite}
#entry .e-play svg{width:38px;height:38px}
@keyframes e-pulse{0%,100%{box-shadow:0 7px 0 var(--accentDark),0 0 0 0 color-mix(in srgb,var(--accent) 45%,transparent)}50%{box-shadow:0 7px 0 var(--accentDark),0 0 0 12px transparent}}
#entry .e-alt{flex:0 0 auto;min-width:170px;min-height:92px;border-radius:28px;background:rgba(0,0,0,.07);font-size:28px;font-weight:900;color:var(--soft);display:flex;align-items:center;justify-content:center;gap:10px}
#entry .e-alt svg{width:28px;height:28px}
#entry .e-hello{font-size:clamp(36px,6vw,58px);font-weight:900;text-align:center;line-height:1.1;padding:8px 0}
#entry .e-hello span{color:var(--accentDark);display:inline-block;animation:e-bob 2.4s ease-in-out infinite}
#entry .e-sub{text-align:center;font-size:24px;font-weight:800;color:var(--soft);min-height:30px}
#entry .e-themes{position:absolute;top:calc(14px + env(safe-area-inset-top));right:calc(14px + env(safe-area-inset-right));display:flex;gap:10px;z-index:2}
#entry .e-th{width:68px;height:68px;border-radius:22px;background:rgba(255,255,255,.55);border:3px solid transparent;padding:10px;box-shadow:0 4px 0 rgba(0,0,0,.18)}
#entry .e-th.on{background:#fffaf0;border-color:var(--accent)}
#entry .e-th svg{width:100%;height:100%;display:block}
@media (max-height:600px){#entry .e-title{font-size:40px}#entry input.e-name{height:68px;font-size:36px}#entry .e-play,#entry .e-alt{min-height:72px}}
@media (prefers-reduced-motion:reduce){#entry *{animation:none!important}}
`;

const PLAY_SVG = '<svg viewBox="0 0 40 40"><path d="M11 6 L34 20 L11 34Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>';
const SKIP_SVG = '<svg viewBox="0 0 40 40"><path d="M8 8 L24 20 L8 32Z M22 8 L38 20 L22 32Z" fill="currentColor"/></svg>';
const EDIT_SVG = '<svg viewBox="0 0 40 40"><path d="M8 32 L10 24 L26 8 L32 14 L16 30Z" fill="currentColor"/></svg>';

type View = 'form' | 'welcome';

class EntryScreen {
  el!: HTMLDivElement;
  view: View;
  name = player.name;
  dob: { y: number; m: number; d: number } | null = null;
  private repeat = 0;
  private onTheme = () => this.paintTheme();

  constructor(private game: Phaser.Game) {
    this.view = player.seen ? 'welcome' : 'form';
    if (player.dob) { const [y, m, d] = player.dob.split('-').map(Number); this.dob = { y, m, d }; }
  }

  open() {
    if (!document.getElementById('entry-css')) {
      const st = document.createElement('style'); st.id = 'entry-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    this.el = document.createElement('div');
    this.el.id = 'entry';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Who is playing?');
    // Keys typed here must not reach the game (Phaser captures W/A/S/D/space...).
    for (const ev of ['keydown', 'keyup', 'keypress']) this.el.addEventListener(ev, (e) => {
      e.stopPropagation();
      if (ev === 'keydown' && (e as KeyboardEvent).key === 'Enter' && document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
    });
    this.el.innerHTML = `<div class="e-sky"></div><div class="e-fx"></div><div class="e-themes"></div>
      <div class="e-wrap"><h1 class="e-title" aria-label="Willowmere Glade"></h1><div class="e-card"></div></div>`;
    const title = this.el.querySelector('.e-title')!;
    [...'Willowmere Glade'].forEach((ch, i) => {
      const s = document.createElement('span'); s.setAttribute('aria-hidden', 'true');
      if (ch === ' ') s.className = 'sp'; else s.textContent = ch;
      s.style.setProperty('--i', String(i));
      title.appendChild(s);
    });
    document.body.appendChild(this.el);
    const kb = this.game.input?.keyboard as any;
    if (kb) kb.enabled = false;
    themeEvents.on('change', this.onTheme);
    this.paintTheme();
    this.render();
  }

  // ---------------------------------------------------------------- theme
  paintTheme() {
    const e = theme.entry;
    const vars: Record<string, string> = {
      '--sky1': e.sky[0], '--sky2': e.sky[1], '--sky3': e.sky[2], '--title': e.title, '--titleEdge': e.titleEdge, '--card': e.card, '--cardEdge': e.cardEdge,
      '--ink': e.ink, '--soft': e.soft, '--accent': e.accent, '--accentDark': e.accentDark, '--field': e.field,
    };
    for (const [k, v] of Object.entries(vars)) this.el.style.setProperty(k, v);
    this.el.dataset.theme = theme.id;
    // Theme toggle (only when there is more than one).
    const box = this.el.querySelector('.e-themes')!;
    box.innerHTML = '';
    if (THEME_ORDER.length > 1) for (const id of THEME_ORDER) {
      const b = document.createElement('button');
      b.className = `e-th${theme.id === id ? ' on' : ''}`;
      b.dataset.theme = id;
      b.setAttribute('aria-label', `${THEMES[id].name} look`);
      b.innerHTML = THEMES[id].entry.iconSvg;
      b.addEventListener('click', () => { if (theme.id !== id) { setTheme(id); sfx.sparkle(); } });
      box.appendChild(b);
    }
    this.decorate();
  }

  decorate() {
    const fx = this.el.querySelector('.e-fx')!;
    fx.innerHTML = '';
    if (reduceMotion()) return;
    const { drift, glow } = theme.entry;
    const bat = drift.shape === 'bat';
    for (let i = 0; i < drift.count; i++) {
      const d = document.createElement('div');
      d.className = `e-d${bat ? ' bat' : ''}`;
      const t = bat ? rnd(9, 16) : rnd(10, 19);
      const st = d.style;
      st.setProperty('--s', `${Math.round(bat ? rnd(30, 52) : rnd(22, 40))}px`);
      st.setProperty('--t', `${t.toFixed(1)}s`);
      st.setProperty('--dl', `${(-rnd(0, t)).toFixed(1)}s`);
      st.setProperty('--x', `${rnd(-5, 100).toFixed(1)}vw`);
      st.setProperty('--dx', `${rnd(-12, 12).toFixed(1)}vw`);
      st.setProperty('--y', `${rnd(4, 70).toFixed(1)}vh`);
      st.setProperty('--dy', `${rnd(-12, 12).toFixed(1)}vh`);
      st.setProperty('--r', `${Math.round(rnd(-540, 540))}deg`);
      d.innerHTML = `<i>${SHAPES[drift.shape](pick(drift.colors))}</i>`;
      fx.appendChild(d);
    }
    for (let i = 0; i < glow.count; i++) {
      const g = document.createElement('div');
      g.className = 'e-g';
      const st = g.style;
      st.setProperty('--s', `${Math.round(rnd(4, 8))}px`);
      st.setProperty('--c', pick(glow.colors));
      st.setProperty('--x', `${rnd(2, 98).toFixed(1)}%`);
      st.setProperty('--y', `${rnd(30, 98).toFixed(1)}%`);
      st.setProperty('--dx', `${rnd(-60, 60).toFixed(0)}px`);
      st.setProperty('--dy', `${rnd(-70, 30).toFixed(0)}px`);
      const t = rnd(3, 7);
      st.setProperty('--t', `${t.toFixed(1)}s`);
      st.setProperty('--dl', `${(-rnd(0, t)).toFixed(1)}s`);
      fx.appendChild(g);
    }
  }

  // ---------------------------------------------------------------- views
  render() {
    const card = this.el.querySelector('.e-card') as HTMLDivElement;
    card.innerHTML = '';
    // Restart the pop-in animation.
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    card.dataset.view = this.view;
    if (this.view === 'welcome') {
      const n = player.name;
      const bday = isBirthday(player.dob);
      card.innerHTML = `<div class="e-hello">${bday ? 'Happy birthday' : 'Welcome back'}${n ? ', <span class="e-who"></span>' : ''}!</div>
        <div class="e-sub"></div>
        <div class="e-btns"><button class="e-alt e-edit" aria-label="Edit name and birthday">${EDIT_SVG}Edit</button><button class="e-play">${PLAY_SVG}Play</button></div>`;
      if (n) card.querySelector('.e-who')!.textContent = n;
      const age = player.dob ? ageOn(player.dob) : -1;
      card.querySelector('.e-sub')!.textContent = age >= 1 && age < 120 ? (bday ? `You are ${age} today!` : `Age ${age}`) : 'Ready for an adventure?';
      card.querySelector('.e-edit')!.addEventListener('click', () => { sfx.blip(); this.view = 'form'; this.render(); });
      card.querySelector('.e-play')!.addEventListener('click', () => this.play(false));
      return;
    }
    card.innerHTML = `<div class="e-lab"><label for="e-name">Your name</label></div>
      <div class="e-namebox"><input id="e-name" class="e-name" type="text" inputmode="text" enterkeyhint="done" autocomplete="off" autocorrect="off"
        autocapitalize="words" spellcheck="false" maxlength="${NAME_MAX}" placeholder="Tap to type" aria-label="Your name">
        <button class="e-x" aria-label="Clear name">\u00D7</button></div>
      <div class="e-lab"><span>Birthday</span><button class="e-pill e-clear">No birthday</button></div>
      <div class="e-dob">${(['m', 'd', 'y'] as const).map((k) => `<div class="e-step" data-k="${k}"><div class="e-steplab">${k === 'm' ? 'Month' : k === 'd' ? 'Day' : 'Year'}</div>
        <div class="e-row"><button class="e-pm" data-k="${k}" data-s="-1" aria-label="${k} down">\u2212</button><div class="e-val" data-k="${k}"><b></b><small></small></div><button class="e-pm" data-k="${k}" data-s="1" aria-label="${k} up">+</button></div></div>`).join('')}</div>
      <div class="e-age"></div>
      <div class="e-btns"><button class="e-alt e-skip">${player.seen ? 'Back' : `${SKIP_SVG}Skip`}</button><button class="e-play">${PLAY_SVG}Play</button></div>`;
    const input = card.querySelector('input') as HTMLInputElement;
    const x = card.querySelector('.e-x') as HTMLButtonElement;
    input.value = this.name;
    x.hidden = !this.name;
    input.addEventListener('input', () => {
      const c = cleanName(input.value);
      if (c !== input.value) { const pos = Math.min(input.selectionStart ?? c.length, c.length); input.value = c; try { input.setSelectionRange(pos, pos); } catch { /* */ } }
      this.name = c; x.hidden = !c;
    });
    input.addEventListener('blur', () => { input.value = this.name = finalName(input.value); x.hidden = !this.name; });
    x.addEventListener('click', () => { this.name = ''; input.value = ''; x.hidden = true; sfx.blip(); input.focus(); });
    card.querySelector('.e-clear')!.addEventListener('click', () => { this.dob = null; sfx.blip(); this.paintDob(); });
    card.querySelectorAll<HTMLButtonElement>('.e-pm').forEach((b) => {
      const k = b.dataset.k as 'm' | 'd' | 'y', s = Number(b.dataset.s);
      const stop = () => { clearTimeout(this.repeat); clearInterval(this.repeat); this.repeat = 0; };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
        stop();
        this.step(k, s); sfx.tock();
        // Hold to keep counting (handy for the year).
        this.repeat = window.setTimeout(() => { this.repeat = window.setInterval(() => this.step(k, s), k === 'y' ? 70 : 110); }, 420);
      });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, stop);
    });
    card.querySelector('.e-skip')!.addEventListener('click', () => this.play(true));
    card.querySelector('.e-play')!.addEventListener('click', () => this.play(false));
    this.paintDob();
  }

  step(k: 'm' | 'd' | 'y', s: number) {
    const now = new Date(), ny = now.getFullYear();
    if (!this.dob) { this.dob = { y: ny - 6, m: now.getMonth() + 1, d: 1 }; this.paintDob(); return; }
    const b = this.dob;
    if (k === 'm') b.m = ((b.m - 1 + s + 12) % 12) + 1;
    else if (k === 'y') b.y = Math.max(ny - 99, Math.min(ny, b.y + s));
    else { const n = daysIn(b.y, b.m); b.d = ((b.d - 1 + s + n) % n) + 1; }
    b.d = Math.min(b.d, daysIn(b.y, b.m));
    this.paintDob();
  }

  paintDob() {
    const b = this.dob;
    for (const k of ['m', 'd', 'y'] as const) {
      const v = this.el.querySelector(`.e-val[data-k="${k}"]`);
      if (!v) continue;
      v.classList.toggle('unset', !b);
      v.querySelector('b')!.textContent = b ? String(b[k]) : '?';
      v.querySelector('small')!.textContent = b && k === 'm' ? MONTHS[b.m - 1] : '';
    }
    const clear = this.el.querySelector('.e-clear') as HTMLButtonElement | null;
    if (clear) clear.style.visibility = b ? 'visible' : 'hidden';
    const age = this.el.querySelector('.e-age');
    if (age) {
      const a = b ? ageOn(iso(b.y, b.m, b.d)) : -1;
      age.textContent = !b ? 'Tap + to pick your birthday (you can skip it)' : a >= 1 ? `You are ${a}!` : a === 0 ? 'A brand-new baby!' : '';
      (age as HTMLElement).style.color = b ? '' : 'var(--soft)';
      (age as HTMLElement).style.fontSize = b ? '' : '18px';
    }
  }

  // ---------------------------------------------------------------- go
  play(skip: boolean) {
    if (this.el.classList.contains('out')) return;
    sfx.sparkle();
    if (!skip) {
      player.name = finalName(this.name);
      player.dob = this.dob ? iso(this.dob.y, this.dob.m, this.dob.d) : null;
    }
    player.seen = true;
    savePlayer(player);
    this.close();
    const n = player.name;
    if (n) setTimeout(() => this.game.events.emit('toast', isBirthday(player.dob) ? `Happy birthday, ${n}!` : `Hi, ${n}!`, 'title'), 450);
  }

  close() {
    this.el.classList.add('out');
    themeEvents.off('change', this.onTheme);
    clearTimeout(this.repeat); clearInterval(this.repeat);
    const kb = this.game.input?.keyboard as any;
    if (kb) kb.enabled = true;
    setTimeout(() => { this.el.remove(); active = null; }, 520);
  }
}

let active: EntryScreen | null = null;

/** Show the entry screen over the game. Automated test browsers skip it unless the URL has ?entry=1. */
export function showEntry(game: Phaser.Game) {
  const q = new URLSearchParams(location.search).get('entry');
  if (q === '0' || (navigator.webdriver && q !== '1')) return;
  if (active) return;
  active = new EntryScreen(game);
  active.open();
  (window as any).__entry = {
    get open() { return !!active && !active.el.classList.contains('out'); },
    get view() { return active?.view ?? null; },
    get player() { return { ...player }; },
  };
}
