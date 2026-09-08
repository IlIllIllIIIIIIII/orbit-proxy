importScripts('/glass/glass.bundle.js', '/glass/glass.config.js', '/glass/glass.sw.js', '/poly/polygon.all.js', '/prism/prism.sw.js');
const uv = new UVServiceWorker();
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const legacy = new ScramjetServiceWorker();
// The unchanged prism.sw.js already installs skipWaiting/clients.claim and
// revives controller connections. Do not install a second set of listeners.
const debugOwners = new Map();
self.addEventListener('message', event => {
  if (event.data?.type !== 'orbit:debug' || !event.source?.id) return;
  const source = new URL(event.source.url);
  // Accept opt-in only from Orbit's own shell, not from proxied app documents.
  if (source.origin !== self.location.origin || !['/', '/index.html'].includes(source.pathname) || source.searchParams.get('debug') !== '1') return;
  const prefixes = Array.isArray(event.data.prefixes) ? event.data.prefixes : [];
  debugOwners.set(event.source.id, prefixes.filter(prefix => typeof prefix === 'string' && /^\/prism\/[^/]+\/[^/]+\/$/.test(prefix)).slice(0, 100));
});

async function reportRoute(event, engine, response, failed) {
  if (!debugOwners.size) return;
  const path = new URL(event.request.url).pathname;
  for (const [id, prefixes] of debugOwners) {
    const client = await self.clients.get(id);
    if (!client) { debugOwners.delete(id); continue; }
    if (id !== event.clientId && !prefixes.some(prefix => path.startsWith(prefix))) continue;
    const destination = ['document', 'iframe', 'worker', 'sharedworker', 'serviceworker', 'script', 'style', 'image', 'font', 'audio', 'video', ''].includes(event.request.destination) ? event.request.destination : 'other';
    client.postMessage({ type: 'orbit:route', engine, destination,
      status: typeof response?.status === 'number' ? response.status : 0,
      failed: failed || response?.status >= 400 });
  }
}
function observe(event, engine, result) {
  const promise = Promise.resolve(result);
  if (!debugOwners.size) return promise;
  return promise.then(async response => {
    try { await reportRoute(event, engine, response, false); } catch (_) {}
    return response;
  }, async error => {
    try { await reportRoute(event, engine, null, true); } catch (_) {}
    throw error;
  });
}
async function handleRequest(event) {
  await legacy.loadConfig();
  if (uv.route(event)) return observe(event, 'glass', uv.fetch(event));
  if (legacy.route(event)) return observe(event, 'polygon', legacy.fetch(event));
  return observe(event, 'network', fetch(event.request));
}
self.addEventListener('fetch', event => {
  if (typeof $scramjetController !== 'undefined' && $scramjetController.shouldRoute(event)) {
    event.respondWith(observe(event, 'prism', $scramjetController.route(event)));
    return;
  }
  event.respondWith(handleRequest(event));
});
