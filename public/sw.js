importScripts('/glass/glass.bundle.js', '/glass/glass.config.js', '/glass/glass.sw.js', '/poly/polygon.all.js', '/prism/prism.sw.js');
const uv = new UVServiceWorker();
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const legacy = new ScramjetServiceWorker();
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
async function handleRequest(event) {
  await legacy.loadConfig();
  if (uv.route(event)) return uv.fetch(event);
  if (legacy.route(event)) return legacy.fetch(event);
  return fetch(event.request);
}
self.addEventListener('fetch', event => {
  if (typeof $scramjetController !== 'undefined' && $scramjetController.shouldRoute(event)) {
    event.respondWith($scramjetController.route(event));
    return;
  }
  event.respondWith(handleRequest(event));
});
