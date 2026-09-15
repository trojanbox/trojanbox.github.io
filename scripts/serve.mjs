import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.xml': 'application/xml', '.txt': 'text/plain' };
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) && file !== root) throw new Error('Invalid path');
    let info;
    try { info = await stat(file); } catch { /* Use the site's actual 404 document. */ }
    if (info?.isDirectory()) file = path.join(file, 'index.html');
    let data;
    try { data = await readFile(file); } catch { file = path.join(root, '404.html'); data = await readFile(file); res.statusCode = 404; }
    res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(data);
  } catch { res.writeHead(400).end('Bad request'); }
}).listen(4321, '127.0.0.1', () => console.log('Serving static production build at http://127.0.0.1:4321'));
