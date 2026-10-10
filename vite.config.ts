import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

/**
 * Inlines the home-screen icon and a web-app manifest as data: URLs so the single-file
 * build stays self-contained ("Add to Home Screen" on iPad uses the apple-* meta + icon).
 */
function pwaInline(): Plugin {
  return {
    name: 'pwa-inline',
    transformIndexHtml(html) {
      const icon = 'data:image/png;base64,' + readFileSync('src/assets/icon-180.png').toString('base64');
      const manifest = {
        name: 'Willowmere Glade', short_name: 'Willowmere', display: 'fullscreen', orientation: 'landscape',
        background_color: '#2b3a2f', theme_color: '#2b3a2f', start_url: '.',
        icons: [{ src: icon, sizes: '180x180', type: 'image/png', purpose: 'any' }],
      };
      const mUrl = 'data:application/manifest+json;base64,' + Buffer.from(JSON.stringify(manifest)).toString('base64');
      return html.replace('<!--PWA-->',
        `<link rel="apple-touch-icon" href="${icon}" />\n    <link rel="icon" type="image/png" href="${icon}" />\n    <link rel="manifest" href="${mUrl}" />`);
    },
  };
}

// `vite build --mode single` → one self-contained HTML (JS, CSS and font inlined) that
// runs straight from disk via file://. Normal builds keep separate assets.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [pwaInline(), ...(mode === 'single' ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    ...(mode === 'single' ? { assetsInlineLimit: 100_000_000 } : {}),
  },
}));
