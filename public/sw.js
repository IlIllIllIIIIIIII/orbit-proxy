importScripts('/glass/glass.bundle.js', '/glass/glass.config.js', '/glass/glass.sw.js', '/poly/polygon.all.js', '/prism/prism.sw.js');
const uv = new UVServiceWorker();
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const legacy = new ScramjetServiceWorker();
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if ($scramjetController.shouldRoute(event)) {
    event.respondWith($scramjetController.route(event));
  } else if (uv.route(event)) {
    event.respondWith(uv.fetch(event));
  } else if (new URL(event.request.url).pathname.startsWith('/scramjet/')) {
    event.respondWith((async () => {
      await legacy.loadConfig();
      return legacy.route(event) ? legacy.fetch(event) : fetch(event.request);
    })());
  }
});
