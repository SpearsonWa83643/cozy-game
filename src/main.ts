import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/Boot';
import { WorldScene } from './scenes/World';
import { UIScene } from './scenes/UI';

import { DPR } from './dpr';

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
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [BootScene, WorldScene, UIScene],
  });

  window.addEventListener('resize', () => {
    game.scale.resize(Math.round(window.innerWidth * DPR), Math.round(window.innerHeight * DPR));
    game.scale.setZoom(1 / DPR);
  });

  (window as any).__game = game;
}

void start();
