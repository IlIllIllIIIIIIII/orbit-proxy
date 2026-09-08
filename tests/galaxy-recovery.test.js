import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function harness({ init = async () => {}, wait = async () => {} } = {}) {
  const timers = new Map(), events = [], frames = [], navigations = [];
  let sequence = 0, ready;
  const started = new Promise(resolve => { ready = resolve; });
  const makeElement = () => ({
    listeners: {}, contentWindow: { location: { href: 'about:blank' } },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    remove() { this.removed = true; }
  });
  const first = makeElement();
  const elements = {
    'proxy-frame': first, 'proxy-engine': { value: 'prism' },
    'proxy-transport': { value: 'libcurlRaw' }, 'proxy-view': { appendChild() {} }
  };
  class Controller {
    frames = frames;
    wait = wait;
    createFrame(element) {
      const frame = { controller: this, prefix: '/prism/controller/' + frames.length + '/', context: {}, go: url => navigations.push(url) };
      frames.push(frame);
      return frame;
    }
  }
  const context = vm.createContext({
    URL, TextEncoder, TextDecoder,
    setTimeout(fn) { const id = ++sequence; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    location: { href: 'https://orbit.test/', protocol: 'https:' },
    navigator: { serviceWorker: { controller: {}, ready: Promise.resolve(), register: async () => ({ active: {} }) } },
    document: { getElementById: id => elements[id], createElement: makeElement },
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
    dispatchEvent(event) { events.push(event); if (event.type === 'proxy:ready') ready(); },
    orbitCodec: { encode: encodeURIComponent, decode: decodeURIComponent },
    $scramjetLoadController: () => ({ ScramjetController: class { async init() {} } }),
    BareMux: { BareMuxConnection: class {} },
    LibcurlTransport: { LibcurlClient: class { init = init; } },
    $scramjetController: { config: { codec: {} }, Controller },
    $scramjet: { unrewriteUrl: () => 'https://example.com/next' }
  });
  context.window = context;
  vm.runInContext(await readFile('public/js/engine.js', 'utf8'), context);
  await started;
  return { context, timers, events, frames, navigations, first };
}

test('transport timeout unlocks tabs and late completion cannot navigate', async () => {
  let complete;
  const late = new Promise(resolve => { complete = resolve; });
  const h = await harness({ init: () => late });
  const navigation = h.context.proxyNavigate('https://example.com/');
  const rejected = assert.rejects(navigation, /Transport startup timed out/);
  assert.equal(h.timers.size, 1);
  [...h.timers.values()][0]();
  await rejected;
  assert.doesNotThrow(() => h.context.proxySelectTab('second'));
  complete();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.frames.length, 0);
  assert.equal(h.navigations.length, 0);
  await h.context.proxyNavigate('https://example.com/retry');
  assert.deepEqual(h.navigations, ['https://example.com/retry']);
});

test('controller timeout cannot publish a late controller or navigate another tab', async () => {
  let complete;
  const h = await harness({ wait: () => new Promise(resolve => { complete = resolve; }) });
  const navigation = h.context.proxyNavigate('https://example.com/');
  const rejected = assert.rejects(navigation, /controller startup timed out/);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.timers.size, 1);
  [...h.timers.values()][0]();
  await rejected;
  h.context.proxySelectTab('second');
  complete();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.frames.length, 0);
  assert.equal(h.navigations.length, 0);
});

test('Prism load reports only its own URL and closed tabs release controller frames', async () => {
  const h = await harness();
  await h.context.proxyNavigate('https://example.com/');
  h.first.contentWindow.location.href = 'https://orbit.test' + h.frames[0].prefix + 'encoded';
  h.first.listeners.load();
  assert.equal(h.events.filter(event => event.type === 'proxy:url').at(-1).detail, 'https://example.com/next');
  const count = h.events.filter(event => event.type === 'proxy:url').length;
  h.first.contentWindow.location.href = 'https://outside.test/';
  h.first.listeners.load();
  assert.equal(h.events.filter(event => event.type === 'proxy:url').length, count);
  h.context.proxySelectTab('second');
  h.context.proxyCloseTab('initial');
  assert.equal(h.first.removed, true);
  assert.equal(h.frames.length, 0);
});
