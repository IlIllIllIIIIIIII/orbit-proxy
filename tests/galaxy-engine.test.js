import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('Galaxy integration selects all three engines and both transport APIs', async () => {
  const calls = [];
  const elements = {
    'proxy-frame': { addEventListener() {}, contentWindow: { location: {}, history: {} } },
    'proxy-engine': { value: 'prism' },
    'proxy-transport': { value: 'libcurlRaw' }
  };
  let finish;
  const ready = new Promise(resolve => { finish = resolve; });
  const frame = { go: url => calls.push(['go', url]) };
  class Transport { async init() { calls.push(['init']); } }
  const context = vm.createContext({
    URL, setTimeout, clearTimeout, TextEncoder, TextDecoder,
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    location: { protocol: 'https:', href: 'https://orbit.test/' },
    navigator: { serviceWorker: { controller: {}, ready: Promise.resolve(), register: async () => ({ active: {} }) } },
    document: { getElementById: id => elements[id] },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    dispatchEvent(event) { if (event.type === 'proxy:ready') finish(); if (event.type === 'proxy:error') throw Error(event.detail); },
    $scramjetLoadController: () => ({ ScramjetController: class {
      constructor(options) {
        // Match the real legacy engine's in-place serialization.
        options.codec.encode = options.codec.encode.toString();
        options.codec.decode = options.codec.decode.toString();
      }
      async init() {}
      encodeUrl(url) { return '/scramjet/' + encodeURIComponent(url); }
    } }),
    BareMux: { BareMuxConnection: class { async setTransport(...args) { calls.push(['mux', ...args]); } } },
    LibcurlTransport: { LibcurlClient: Transport }, EpoxyTransport: { default: Transport },
    $scramjetController: { config: { codec: {} }, Controller: class {
      async wait() {}
      createFrame() {
        assert.equal(typeof context.$scramjetController.config.codec.encode, 'function');
        assert.equal(typeof context.$scramjetController.config.codec.decode, 'function');
        return frame;
      }
      async setTransport() { calls.push(['switch']); }
    } },
    $scramjetUtils: { UrlWatcherPlugin: class {}, CatchEscapedLinksPlugin: class {} },
    __uv$config: { prefix: '/service/glass/', encodeUrl: encodeURIComponent }
  });
  context.window = context;
  vm.runInContext(await readFile('public/js/codec.js', 'utf8'), context);
  vm.runInContext(await readFile('public/js/engine.js', 'utf8'), context);
  await ready;
  assert.equal(typeof context.orbitCodec.encode, 'function');
  assert.equal(typeof context.orbitCodec.decode, 'function');
  const url = 'https://example.com/';
  await context.proxyNavigate(url);
  assert.deepEqual(calls.find(call => call[0] === 'go'), ['go', url]);
  elements['proxy-engine'].value = 'polygon';
  await context.proxyNavigate(url);
  assert.equal(elements['proxy-frame'].src, '/scramjet/' + encodeURIComponent(url));
  elements['proxy-engine'].value = 'glass';
  elements['proxy-transport'].value = 'epoxy';
  await context.proxyNavigate(url);
  assert.equal(elements['proxy-frame'].src, '/service/glass/' + encodeURIComponent(url));
  assert.equal(calls.at(-1)[1], '/reflux/index.mjs');
  assert.equal(calls.at(-1)[2][0].base, '/libbybutslightlyworse/index.mjs');
  for (const value of ['', url, 'https://example.com/日本語?q=🚀']) {
    assert.equal(context.orbitCodec.decode(context.orbitCodec.encode(value)), value);
  }
});
