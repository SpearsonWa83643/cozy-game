import base from './playwright.touch.config.ts';
import { defineConfig } from '@playwright/test';
// Low-memory variant: same iPad touch setup at 1x DPR, single renderer process.
export default defineConfig({
  ...base,
  testDir: '/workspace/cozy-game/tests',
  outputDir: '/workspace/cozy-game/test-results',
  use: { ...base.use, deviceScaleFactor: 1, launchOptions: { args: [...(base.use!.launchOptions!.args as string[]), '--renderer-process-limit=1', '--js-flags=--max-old-space-size=512'] } },
});
