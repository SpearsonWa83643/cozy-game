import Phaser from 'phaser';
import { paintAll } from '../art';
import { showEntry } from '../entry';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    const t0 = performance.now();
    paintAll(this);
    console.info(`[cozy] painted textures in ${(performance.now() - t0).toFixed(0)}ms`);
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.opacity = '0';
      setTimeout(() => loading.remove(), 700);
    }
    this.scene.start('world');
    this.scene.launch('ui');
    this.scene.launch('vui');
    this.scene.launch('menu');
    // After the glade is up, show the living name + birthday card (skipped in automated tests).
    this.time.delayedCall(80, () => showEntry(this.game));
  }
}
