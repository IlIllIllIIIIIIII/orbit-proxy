import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('pinned Prism worker owns nested worker routes only after controller registration', async () => {
  const handlers = {};
  const context = vm.createContext({
    URL, console, setTimeout() {},
    addEventListener(name, fn) { (handlers[name] ??= []).push(fn); },
    self: { skipWaiting() {} }, clients: { claim() {}, matchAll: async () => [] }
  });
  vm.runInContext(await readFile('public/prism/prism.sw.js', 'utf8'), context);
  const owns = (url, destination) => context.$scramjetController.shouldRoute({ request: { url, destination } });
  assert.equal(owns('https://orbit.test/prism/owner/frame/worker.js', 'worker'), false);
  for (const handler of handlers.message) handler({
    data: { $controller$init: { id: 'owner', prefix: '/prism/owner/' } },
    ports: [{ postMessage() {} }]
  });
  for (const destination of ['iframe', 'worker', 'sharedworker', 'serviceworker', 'script', '']) {
    assert.equal(owns('https://orbit.test/prism/owner/frame/worker.js', destination), true);
    assert.equal(owns('https://orbit.test/unrelated/worker.js', destination), false);
  }
  assert.ok(handlers.install.length);
  assert.ok(handlers.activate.length);
});

test('routing diagnostics are opt-in, sanitized, and preserve Prism failure responses', async () => {
  const handlers = {}, messages = [];
  const response = { status: 500 };
  const context = vm.createContext({
    URL, importScripts() {},
    self: {
      location: { origin: 'https://orbit.test' },
      addEventListener(name, fn) { handlers[name] = fn; },
      clients: { get: async () => ({ postMessage: message => messages.push(message) }) }
    },
    $scramjetController: { shouldRoute: () => true, route: async () => response },
    UVServiceWorker: class {},
    $scramjetLoadWorker: () => ({ ScramjetServiceWorker: class {} })
  });
  vm.runInContext(await readFile('public/sw.js', 'utf8'), context);
  const run = async () => {
    let result;
    handlers.fetch({ clientId: 'child', request: { url: 'https://orbit.test/prism/owner/frame/private?token=SECRET', destination: 'worker' }, respondWith: value => { result = value; } });
    assert.equal(await result, response);
  };
  await run();
  assert.equal(messages.length, 0);
  const data = { type: 'orbit:debug', prefixes: ['/prism/owner/frame/'] };
  handlers.message({ source: { id: 'owner', url: 'https://orbit.test/prism/owner/frame/?debug=1' }, data });
  await run();
  assert.equal(messages.length, 0, 'Proxied apps must not enable diagnostics');
  handlers.message({ source: { id: 'owner', url: 'https://orbit.test/?debug=1' }, data });
  await run();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].engine, 'prism');
  assert.equal(messages[0].destination, 'worker');
  assert.equal(messages[0].failed, true);
  assert.equal(JSON.stringify(messages).includes('SECRET'), false);
  assert.equal(JSON.stringify(messages).includes('private'), false);
});
