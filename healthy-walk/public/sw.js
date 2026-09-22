/**
 * A deliberately minimal service worker.
 *
 * It caches the app shell so Healthy Walk opens instantly from the home
 * screen and still renders your saved dishes on a bad connection. It never
 * caches a search: results depend on where you're standing and whether the
 * kitchen is open, and a stale answer would send you to a closed restaurant.
 */

const SHELL = 'healthy-walk-shell-v1';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/shared/criteria.js',
  '/shared/nutrition.js',
  '/shared/schema.js',
  '/shared/scoring.js',
  '/shared/directions.js',
  '/manifest.webmanifest',
  '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Anything live stays live. Only the shell is ever served from cache.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit ?? caches.match('/index.html'))),
  );
});
