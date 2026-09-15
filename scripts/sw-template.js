/* Generated from the current build. Never claim ownership of a different project Pages path. */
const BUILD = __SITE_BUILD__;
const SHELL_PREFIX = 'trojanbox-main:shell:';
const SHELL = SHELL_PREFIX + BUILD.version;
const DOCUMENTS = 'trojanbox-main:documents:v1';
const ASSETS = 'trojanbox-main:assets:v1';
const mainPaths = new Set(BUILD.documents);
const knownAssets = new Set(BUILD.ownedAssets ?? BUILD.assets);
const absolute = path => new URL(path, self.location.origin).href;
const isMain = url => url.origin === self.location.origin && mainPaths.has(url.pathname);
const isAsset = url => url.origin === self.location.origin && (knownAssets.has(url.pathname) || url.pathname.startsWith('/_astro/'));
async function putLimited(name, request, response, maxEntries) {
  if (!response.ok || response.type === 'opaque') return;
  const cache = await caches.open(name);
  await cache.put(request, response);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - maxEntries; i++) await cache.delete(keys[i]);
}
async function cachePage(path) {
  const response = await fetch(absolute(path), { cache: 'no-cache' });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return;
  await putLimited(DOCUMENTS, absolute(path), response, 64);
  for (const asset of BUILD.pageAssets[path] ?? []) {
    const cache = await caches.open(ASSETS);
    if (!asset.startsWith('/_astro/') || !await cache.match(absolute(asset))) {
      const data = await fetch(absolute(asset), { cache: 'no-cache' });
      await putLimited(ASSETS, absolute(asset), data, 256);
    }
  }
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await shell.addAll(BUILD.shell.map(path => new Request(absolute(path), { cache: 'reload' })));
    const assets = await caches.open(ASSETS);
    for (const path of BUILD.assets) {
      if (!path.startsWith('/_astro/') || !await assets.match(absolute(path))) {
        const response = await fetch(absolute(path), { cache: 'no-cache' });
        if (!response.ok) throw new Error(`Cannot cache ${path}`);
        await assets.put(absolute(path), response);
      }
    }
    // Wait for the reader's explicit update action when an older worker is active.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(SHELL_PREFIX) && key !== SHELL) await caches.delete(key);
    // Retain previous hashed assets used by already-cached article HTML.
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (!event.source?.url) return;
  let sender;
  try { sender = new URL(event.source.url); } catch { return; }
  if (!isMain(sender)) return;
  if (event.data?.type === 'SKIP_WAITING') { event.waitUntil(self.skipWaiting()); return; }
  if (event.data?.type !== 'CACHE_PAGE' || typeof event.data.url !== 'string') return;
  let target;
  try { target = new URL(event.data.url, self.location.origin); } catch { return; }
  if (!isMain(target) || target.pathname !== sender.pathname) return;
  event.waitUntil(cachePage(target.pathname).catch(error => console.warn('Page is not available offline yet.', error)));
});
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && isMain(url)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
          event.waitUntil(putLimited(DOCUMENTS, absolute(url.pathname), response.clone(), 64)
            .catch(error => console.warn('Unable to save article offline.', error)));
        }
        return response; // Preserve online 404/5xx instead of presenting unrelated content.
      } catch {
        const cached = await (await caches.open(DOCUMENTS)).match(absolute(url.pathname)) || await (await caches.open(SHELL)).match(absolute(url.pathname));
        if (cached) return cached;
        const offline = await (await caches.open(SHELL)).match(absolute('/offline/'));
        return offline ? new Response(await offline.text(), { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }) : new Response('暂时离线，请联网后重试。', { status: 503 });
      }
    })());
  } else if (isAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSETS);
      const cached = await cache.match(absolute(url.pathname));
      if (cached && url.pathname.startsWith('/_astro/')) return cached;
      try {
        const response = await fetch(request);
        event.waitUntil(putLimited(ASSETS, absolute(url.pathname), response.clone(), 256).catch(error => console.warn('Unable to cache asset.', error)));
        return response;
      } catch (error) {
        if (cached) return cached;
        throw error;
      }
    })());
  }
  // No respondWith for /world-history-in-progress/** or other independent project paths.
});
