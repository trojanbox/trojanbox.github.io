import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve('dist');
async function walk(dir) {
  const results = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const current = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...await walk(current)); else results.push(current);
  }
  return results;
}
const files = (await walk(root)).sort();
const toUrl = file => '/' + path.relative(root, file).split(path.sep).map(encodeURIComponent).join('/');
const hash = createHash('sha256');
const pageAssets = {};
const documents = [];
for (const file of files) {
  hash.update(toUrl(file)).update(await fs.readFile(file));
  if (!file.endsWith('/index.html')) continue;
  const url = toUrl(file).replace(/index\.html$/, '');
  documents.push(url);
  const html = await fs.readFile(file, 'utf8');
  pageAssets[url] = [...new Set([...html.matchAll(/\b(?:src|href)="(\/(?:media|_astro|icons)\/[^"?#]+|\/icon\.svg)"/g)].map(match => match[1]))];
}
const assets = files.filter(file => /\/_astro\//.test(file) || /\/icons\//.test(file) || file.endsWith('/icon.svg')).map(toUrl);
const ownedAssets = [...new Set([...assets, ...files.filter(file => /\/media\//.test(file)).map(toUrl)])];
const build = { version: hash.digest('hex').slice(0, 16), documents, assets, ownedAssets,
  shell: ['/', '/articles/', '/topics/', '/archive/', '/tags/', '/offline/', '/manifest.webmanifest'], pageAssets };
const template = await fs.readFile('scripts/sw-template.js', 'utf8');
await fs.writeFile(path.join(root, 'sw.js'), template.replace('__SITE_BUILD__', JSON.stringify(build)));
await fs.writeFile(path.join(root, 'site-build.json'), JSON.stringify({ version: build.version, documents, shell: build.shell }, null, 2));
await fs.writeFile(path.join(root, '.nojekyll'), '');
const urls = documents.filter(url => url !== '/offline/');
await fs.writeFile(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>https://trojanbox.github.io${url}</loc></url>`).join('')}</urlset>`);
console.log(`Offline build ${build.version}: ${documents.length} owned routes, ${assets.length} assets; article HTML uses runtime caching.`);
