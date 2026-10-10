import { defineConfig } from '@playwright/test';

// Loads the regular dist/ build under a /cozy-game/ subpath, exactly like GitHub Pages
// project hosting. Set BASE_URL=https://spearsonwa83643.github.io/cozy-game/ to check the live site.
const live = process.env.BASE_URL;
export default defineConfig({
  testDir: './tests',
  testMatch: /subpath\.spec\.ts/,
  timeout: 300_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: live ?? 'http://127.0.0.1:4183/cozy-game/',
    viewport: { width: 1180, height: 820 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: false,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: live ? undefined : {
    command: 'PORT=4183 node tests/subpath-server.mjs',
    url: 'http://127.0.0.1:4183/cozy-game/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
