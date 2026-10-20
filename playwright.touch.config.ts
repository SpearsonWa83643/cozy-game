import { defineConfig } from '@playwright/test';

// iPad touch run against the single-file build over file:// (no server needed).
export default defineConfig({
  testDir: './tests',
  testMatch: /(touch|world|village|seq|reset|wild|wild-combat|harvest|fruit|entry|whatsnew|mount|mount-picker|mood|wild-unlocks|halloween|pumpkin-default|wild-walk|scarf-coat|spring|care|stones|trail|feedfriend|berries|move|fall|mount-lunchbox)\.spec\.ts/,
  timeout: 900_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    viewport: { width: 1180, height: 820 }, // iPad Air / 10th-gen landscape (CSS px)
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: false, // iPadOS Safari presents as desktop-class
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
    },
  },
});
