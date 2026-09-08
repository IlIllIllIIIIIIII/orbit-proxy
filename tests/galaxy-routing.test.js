import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('worker routing matches Galaxy priority and has no hard-coded legacy prefix gate', async () => {
  const listeners = {}, calls = [];
  let selected;
  const context = vm.createContext({
    importScripts() {},
    self: { addEventListener: (name, handler) => { listeners[name] = handler; } },
    $scramjetController: { shouldRoute: () => selected === 'prism', route: () => 'prism' },
    UVServiceWorker: class { route() { return selected === 'glass'; } fetch() { return 'glass'; } },
    $scramjetLoadWorker: () => ({ ScramjetServiceWorker: class {
      async loadConfig() { calls.push('config'); }
      route() { return selected === 'polygon'; }
      fetch() { return 'polygon'; }
    } }),
    fetch: () => 'network'
  });
  vm.runInContext(await readFile('public/sw.js', 'utf8'), context);
  for (selected of ['prism', 'glass', 'polygon', 'network']) {
    let result;
    listeners.fetch({ request: { url: 'https://orbit.test/other-prefix/worker.js' }, respondWith: value => { result = value; } });
    assert.equal(await result, selected);
  }
  assert.equal(calls.length, 3, 'Prism takes priority before legacy config is loaded');
});
