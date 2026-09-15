import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync('scripts/sw-template.js', 'utf8');
function worker() {
  const listeners = {};
  const manifest = { version: 'test', documents: ['/', '/articles/a/', '/offline/'], assets: ['/icon.svg'], shell: ['/', '/offline/'], pageAssets: {} };
  vm.runInNewContext(source.replace('__SITE_BUILD__', JSON.stringify(manifest)), {
    self: { location: { origin: 'https://trojanbox.github.io' }, addEventListener: (type, fn) => { listeners[type] = fn; } }, URL, Set, Response,
  });
  return listeners;
}
for (const [name, url, method, mode] of [
  ['independent serial homepage', 'https://trojanbox.github.io/world-history-in-progress/', 'GET', 'navigate'],
  ['independent serial asset', 'https://trojanbox.github.io/world-history-in-progress/assets/reader.js', 'GET', 'cors'],
  ['a future independent project', 'https://trojanbox.github.io/another-project/', 'GET', 'navigate'],
  ['cross origin', 'https://example.com/', 'GET', 'navigate'],
  ['write request', 'https://trojanbox.github.io/', 'POST', 'navigate'],
]) test(`worker does not intercept ${name}`, () => {
  let intercepted = false;
  worker().fetch({ request: { url, method, mode }, respondWith() { intercepted = true; } });
  assert.equal(intercepted, false);
});
test('independent project cannot request main-site offline caching', () => {
  let handled = false;
  worker().message({ source: { url: 'https://trojanbox.github.io/world-history-in-progress/' }, data: { type: 'CACHE_PAGE', url: 'https://trojanbox.github.io/' }, waitUntil() { handled = true; } });
  assert.equal(handled, false);
});
test('cache deletion and preference reset are restricted to owned namespace', () => {
  assert.match(source, /key\.startsWith\(SHELL_PREFIX\)/);
  const site = readFileSync('src/scripts/site.ts', 'utf8');
  assert.doesNotMatch(site, /localStorage\.clear|\.unregister\(/);
});

test('independent project cannot activate a waiting main-site worker', () => {
  let handled = false;
  worker().message({ source: { url: 'https://trojanbox.github.io/world-history-in-progress/' }, data: { type: 'SKIP_WAITING' }, waitUntil() { handled = true; } });
  assert.equal(handled, false);
});
