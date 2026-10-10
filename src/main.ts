import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/Boot';
import { WorldScene } from './scenes/World';
import { UIScene } from './scenes/UI';

import { DPR } from './dpr';
import { sfx } from './audio';

// ---- Touch hygiene: no page scroll, pinch/double-tap zoom, selection or callouts.
const stop = (e: Event) => { if (e.cancelable) e.preventDefault(); };
document.addEventListener('touchmove', stop, { passive: false });
document.addEventListener('gesturestart', stop as EventListener, { passive: false } as any);
document.addEventListener('gesturechange', stop as EventListener, { passive: false } as any);
document.addEventListener('dblclick', stop, { passive: false });
document.addEventListener('contextmenu', stop);
document.addEventListener('selectstart', stop);
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 320) stop(e); // iOS double-tap zoom
  lastTouchEnd = now;
}, { passive: false });

// ---- Audio unlock: iOS Safari only allows it inside a real gesture (touchend/click/keydown).
for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) {
  window.addEventListener(ev, () => sfx.unlock(), { capture: true, passive: true });
}

const params = new URLSearchParams(location.search);

async function start() {
  try {
    await Promise.race([
      document.fonts.load('700 20px Nunito'),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch { /* fall back to system font */ }

  const w = window.innerWidth;
  const h = window.innerHeight;
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    backgroundColor: '#2b3a2f',
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.round(w * DPR),
      height: Math.round(h * DPR),
      zoom: 1 / DPR,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
      powerPreference: 'high-performance',
      // One texture unit per batch: everything lives in one atlas anyway, and multi-texture
      // batching produced triangle dropouts on some GL backends (seen on SwiftShader).
      maxTextures: params.get('tex') ? Number(params.get('tex')) : 1,
      mipmapFilter: params.get('mip') === '0' ? '' : 'LINEAR_MIPMAP_LINEAR',
    },
    fps: { target: 60 },
    input: { activePointers: 3, touch: { capture: true } },
    disableContextMenu: true,
    audio: { noAudio: true }, // we use our own WebAudio synth
    banner: false,
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [BootScene, WorldScene, UIScene],
  });

  let lastW = w, lastH = h;
  const onResize = () => {
    const nw = window.innerWidth, nh = window.innerHeight;
    if (nw === lastW && nh === lastH) return;
    lastW = nw; lastH = nh;
    game.scale.resize(Math.round(nw * DPR), Math.round(nh * DPR));
    game.scale.setZoom(1 / DPR);
    window.scrollTo(0, 0);
  };
  window.addEventListener('resize', onResize);
  // iOS reports the new size a beat after rotating.
  window.addEventListener('orientationchange', () => { setTimeout(onResize, 120); setTimeout(onResize, 500); });
  window.visualViewport?.addEventListener('resize', onResize);

  (window as any).__game = game;
}

void start();
