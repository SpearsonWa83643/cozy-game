import Phaser from 'phaser';
import { paintAll } from '../art';
import { showEntry, afterEntry } from '../entry';
import { showWhatsNew } from '../whatsnewNote';

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
    this.scene.launch('interior');
    // After the glade is up, show the living name + birthday card (skipped in automated tests).
    // (setTimeout, not this.time: starting 'world' shuts this scene and its clock down.)
    const game = this.game;
    // Then, once the entry card is gone, the one-time "What's new" note (if this release has any).
    afterEntry(() => setTimeout(() => showWhatsNew(game), 350));
    setTimeout(() => showEntry(game), 80);
  }
}
