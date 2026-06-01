const VERSION = 'v3';
const STATIC_CACHE = `xrossstars-static-${VERSION}`;
const RUNTIME_CACHE = `xrossstars-runtime-${VERSION}`;
const OFFLINE_FALLBACK = '/offline.html';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

const notifyClients = async (message) => {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => client.postMessage(message));
};

const cacheOfflineAssets = async () => {
  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(APP_SHELL);
};

const refreshOfflineAssets = async () => {
  await caches.delete(STATIC_CACHE);
  await caches.delete(RUNTIME_CACHE);
  await cacheOfflineAssets();
};

self.addEventListener('install', (event) => {
  event.waitUntil(cacheOfflineAssets());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
    await notifyClients({ type: 'OFFLINE_CACHE_READY' });
  })());
});

self.addEventListener('message', (event) => {
  const messageType = event.data?.type;
  if (!['CACHE_OFFLINE_ASSETS', 'REFRESH_OFFLINE_CACHE'].includes(messageType)) return;

  event.waitUntil((async () => {
    try {
      if (messageType === 'REFRESH_OFFLINE_CACHE') {
        await refreshOfflineAssets();
        await notifyClients({ type: 'OFFLINE_CACHE_REFRESHED' });
        return;
      }

      await cacheOfflineAssets();
      await notifyClients({ type: 'OFFLINE_CACHE_READY' });
    } catch (error) {
      await notifyClients({ type: 'OFFLINE_CACHE_FAILED' });
    }
  })());
});

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.status === 200 && response.type === 'basic') {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }
  return response;
};

const staleWhileRevalidate = async (request) => {
  const cached = await caches.match(request);
  const networkFetch = fetch(request)
    .then(async (response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || networkFetch || caches.match('/');
};

const networkFirstPage = async (request) => {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return (await caches.match(request)) || (await caches.match('/')) || (await caches.match(OFFLINE_FALLBACK));
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  const isStaticAsset = request.destination === 'style'
    || request.destination === 'script'
    || request.destination === 'worker'
    || request.destination === 'font'
    || request.destination === 'image'
    || url.pathname.startsWith('/assets/')
    || url.pathname.startsWith('/icons/')
    || url.pathname.endsWith('.webmanifest');

  if (isStaticAsset) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
