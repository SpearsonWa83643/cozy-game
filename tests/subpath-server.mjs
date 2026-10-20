// Serves dist/ under /cozy-game/ to check relative assets work under a subpath.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = new URL('../dist/', import.meta.url).pathname;
const prefix = '/cozy-game/';
const port = Number(process.env.PORT ?? 4183);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (!url.startsWith(prefix)) { res.writeHead(404); return res.end('not under ' + prefix); }
  let f = path.join(root, url.slice(prefix.length) || 'index.html');
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`serving dist at http://localhost:${port}${prefix}`));
