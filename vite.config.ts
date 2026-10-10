import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

/**
 * Home-screen install support. Normal builds (GitHub Pages) emit a real manifest.webmanifest +
 * icon next to index.html with relative start_url/scope, so it installs correctly under
 * /<repo>/. The single-file build inlines both as data: URLs to stay self-contained.
 */
function pwa(single: boolean): Plugin {
  const iconBytes = () => readFileSync('src/assets/icon-180.png');
  const manifest = (icon: string) => JSON.stringify({
    name: 'Willowmere Glade', short_name: 'Willowmere', description: 'A cozy hand-painted exploration adventure.',
    display: 'fullscreen', orientation: 'landscape', background_color: '#2b3a2f', theme_color: '#2b3a2f',
    start_url: './', scope: './',
    icons: [{ src: icon, sizes: '180x180', type: 'image/png', purpose: 'any' }],
  }, null, 2);
  return {
    name: 'pwa',
    generateBundle() {
      if (single) return;
      this.emitFile({ type: 'asset', fileName: 'icon-180.png', source: iconBytes() });
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest('./icon-180.png') });
    },
    configureServer(server) {
      // Dev server: serve the same files so install can be tested with `npm run dev`.
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith('/icon-180.png')) { res.setHeader('content-type', 'image/png'); return res.end(iconBytes()); }
        if (req.url?.endsWith('/manifest.webmanifest')) { res.setHeader('content-type', 'application/manifest+json'); return res.end(manifest('./icon-180.png')); }
        next();
      });
    },
    transformIndexHtml(html) {
      let icon = './icon-180.png';
      let mUrl = './manifest.webmanifest';
      if (single) {
        icon = 'data:image/png;base64,' + iconBytes().toString('base64');
        mUrl = 'data:application/manifest+json;base64,' + Buffer.from(manifest(icon)).toString('base64');
      }
      return html.replace('<!--PWA-->',
        `<link rel="apple-touch-icon" href="${icon}" />\n    <link rel="icon" type="image/png" href="${icon}" />\n    <link rel="manifest" href="${mUrl}" />`);
    },
  };
}

// `vite build --mode single` → one self-contained HTML (JS, CSS and font inlined) that
// runs straight from disk via file://. Normal builds keep separate assets.
export default defineConfig(({ mode }) => ({
  base: './', // relative asset URLs so dist works under https://<user>.github.io/<repo>/
  plugins: [pwa(mode === 'single'), ...(mode === 'single' ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    ...(mode === 'single' ? { assetsInlineLimit: 100_000_000 } : {}),
  },
}));
