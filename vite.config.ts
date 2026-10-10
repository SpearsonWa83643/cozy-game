import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode single` → one self-contained HTML (JS, CSS and font inlined) that
// runs straight from disk via file://. Normal builds keep separate assets.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile({ removeViteModuleLoader: true })] : [],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    ...(mode === 'single' ? { assetsInlineLimit: 100_000_000 } : {}),
  },
}));
