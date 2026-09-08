(function () {
  'use strict';
  let iframe = document.getElementById('proxy-frame');
  const engineSelect = document.getElementById('proxy-engine');
  const transportSelect = document.getElementById('proxy-transport');
  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
  const wisp = window.__PROXY_CONFIG__?.wispUrl || new URL('/wisp/', location.href).href.replace(/^http/, 'ws');
  const debug = new URL(location.href).searchParams.get('debug') === '1';
  // Only fixed labels and sanitized fields are logged, never errors or URLs
  // supplied by a proxied app (which may contain credentials).
  const trace = (stage, fields = {}) => { if (debug) console.info('[Orbit]', stage, fields); };
  let ready = false, controller, prismFrame, legacy, connection, registration;
  let activeEngine = 'prism', currentTransport, pending = false;
  let legacyTransportTask = null;
  const tabs = new Map();
  let activeTab = 'initial';
  window.proxySelectTab = id => {
    if (pending) throw new Error('Please wait for the current navigation.');
    tabs.set(activeTab, { iframe, prismFrame, activeEngine });
    iframe.hidden = true;
    if (!tabs.has(id)) {
      const element = document.createElement('iframe');
      element.className = 'proxy-frame';
      element.title = 'Proxied website';
      element.allowFullscreen = true;
      element.referrerPolicy = 'no-referrer';
      document.getElementById('proxy-view').appendChild(element);
      tabs.set(id, { iframe: element, prismFrame: null, activeEngine: 'prism' });
      listenForLoad(element);
    }
    ({ iframe, prismFrame, activeEngine } = tabs.get(id));
    activeTab = id;
    iframe.hidden = false;
  };
  window.proxyCloseTab = id => {
    const tab = tabs.get(id);
    if (tab && id !== activeTab) {
      // The pinned controller keeps every frame in a public array and has no
      // removeFrame API. Release its reference when the corresponding tab closes.
      const frames = tab.prismFrame?.controller?.frames;
      if (Array.isArray(frames)) {
        const index = frames.indexOf(tab.prismFrame);
        if (index !== -1) frames.splice(index, 1);
      }
      tab.iframe.remove();
      tabs.delete(id);
    }
  };
  async function timeout(promise, ms, message) {
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      })]);
    } finally { clearTimeout(timer); }
  }

  async function initialize() {
    if (location.protocol === 'file:' || !navigator.serviceWorker) throw new Error('Open Orbit on localhost or HTTPS, not as a file.');
    const endpoint = new URL(wisp);
    if (!['ws:', 'wss:'].includes(endpoint.protocol) || (location.protocol === 'https:' && endpoint.protocol !== 'wss:')) {
      throw new Error('Wisp must use ws:// locally and wss:// on HTTPS.');
    }
    trace('wisp', { origin: endpoint.origin });
    if (debug && typeof WebSocket === 'function') {
      // Separate diagnostic handshake, not the runtime's application socket.
      const probe = new WebSocket(wisp);
      const timer = setTimeout(() => { trace('wisp-probe-timeout'); probe.close(); }, 10000);
      probe.addEventListener('open', () => trace('wisp-probe-open'));
      probe.addEventListener('message', () => { trace('wisp-probe-packet'); probe.close(); }, { once: true });
      probe.addEventListener('error', () => trace('wisp-probe-error'));
      probe.addEventListener('close', event => { clearTimeout(timer); trace('wisp-probe-close', { code: event.code }); });
    }
    emit('proxy:status', 'Starting proxy engines…');
    const { ScramjetController } = window.$scramjetLoadController();
    legacy = new ScramjetController({
      prefix: '/scramjet/',
      files: { wasm: '/poly/polygon.wasm.wasm', all: '/poly/polygon.all.js', sync: '/poly/polygon.sync.js' },
      // Legacy Scramjet serializes these functions in place. Do not share its
      // mutable codec object with Prism, which requires callable functions.
      codec: { ...window.orbitCodec }
    });
    await timeout(legacy.init(), 30000, 'Proxy storage initialization timed out. Reopen Orbit and try again.');
    registration = await timeout(navigator.serviceWorker.register('/sw.js', { scope: '/', type: 'classic', updateViaCache: 'none' }), 30000, 'Service worker registration timed out.');
    await timeout(navigator.serviceWorker.ready, 20000, 'Service worker startup timed out.');
    await new Promise((resolve, reject) => {
      const deadline = Date.now() + 20000;
      const check = () => {
        if (registration.active && !registration.installing && !registration.waiting && navigator.serviceWorker.controller) resolve();
        else if (Date.now() > deadline) reject(new Error('Close and reopen Orbit to activate its updated worker.'));
        else setTimeout(check, 100);
      };
      check();
    });
    connection = new BareMux.BareMuxConnection('/charon/worker.js');
    trace('worker-ready', { state: registration.active?.state || 'active' });
    ready = true;
    emit('proxy:ready');
    emit('proxy:status', 'Ready');
  }

  async function setupTransport(engine, selected) {
    if (engine === 'prism') {
      const choice = selected === 'epoxy' ? 'epoxy' : 'libcurlRaw';
      if (!controller || currentTransport !== choice) {
        const Constructor = choice === 'epoxy'
          ? (window.EpoxyTransport.default || window.EpoxyTransport)
          : (window.LibcurlTransport.LibcurlClient || window.LibcurlTransport.default || window.LibcurlTransport);
        const transport = new Constructor({ wisp });
        trace('transport-start', { engine, transport: choice, runtime: choice === 'epoxy' ? 'prism/libbyworse.js' : 'prism/libby.js' });
        // Time out the individual wait, not setupTransport as a whole: a late
        // transport completion must never resume frame creation/navigation.
        await timeout(transport.init(), 30000, 'Transport startup timed out. Check the relay or try another transport.');
        trace('transport-ready', { initialized: true });
        if (!controller) {
          Object.assign($scramjetController.config, {
            scramjetPath: '/prism/prism.js', injectPath: '/prism/prism.inject.js', wasmPath: '/prism/prism.wasm'
          });
          Object.assign($scramjetController.config.codec, window.orbitCodec);
          const candidate = new $scramjetController.Controller({ serviceworker: registration.active, transport });
          await timeout(candidate.wait(), 30000, 'Proxy controller startup timed out. Check the service worker and runtime assets.');
          controller = candidate;
          trace('controller-ready');
        } else await controller.setTransport(transport);
        currentTransport = choice;
      }
      if (!prismFrame) {
          // Match Galaxy's /api GeForce NOW launch: no navigation plugins.
          prismFrame = controller.createFrame(iframe);
          trace('frame-created', { engine });
      }
    } else {
      const base = selected === 'epoxy' ? '/libbybutslightlyworse/index.mjs' : '/libby/index.mjs';
      // BareMux changes shared state asynchronously. Do not race a retry against
      // an earlier switch that is still completing after its caller timed out.
      if (legacyTransportTask) await timeout(legacyTransportTask, 30000, 'The previous transport switch is still pending.');
      const task = Promise.resolve(connection.setTransport(selected === 'libcurlRaw' ? base : '/reflux/index.mjs', [{ base, wisp }]));
      legacyTransportTask = task;
      task.then(() => { if (legacyTransportTask === task) legacyTransportTask = null; }, () => { if (legacyTransportTask === task) legacyTransportTask = null; });
      await timeout(task, 30000, 'Transport startup timed out. Check the relay or try another engine.');
    }
  }

  window.proxyNavigate = async (url, options = {}) => {
    if (!ready) throw new Error('The proxy is still starting.');
    if (pending) throw new Error('Please wait for the current navigation to start.');
    pending = true;
    try {
      const engine = options.engine || engineSelect.value;
      const transport = options.transport || transportSelect.value;
      if (!['prism', 'polygon', 'glass'].includes(engine) || !['libcurlRaw', 'libcurl', 'epoxy'].includes(transport)) throw new Error('Unsupported proxy selection.');
      trace('navigation-start', { engine, transport });
      emit('proxy:status', 'Connecting…');
      await setupTransport(engine, transport);
      activeEngine = engine;
      if (engine === 'prism') prismFrame.go(url);
      else iframe.src = engine === 'glass' ? __uv$config.prefix + __uv$config.encodeUrl(url) : legacy.encodeUrl(url);
      emit('proxy:url', url);
      emit('proxy:status', 'Loading…');
    } catch (error) {
      trace('navigation-or-transport-failed', { engine: options.engine || engineSelect.value });
      throw error;
    } finally { pending = false; }
  };

  function listenForLoad(element) {
  element.addEventListener('load', () => {
    if (element !== iframe) return;
    if (!ready) return;
    try {
      const href = iframe.contentWindow.location.href;
      if (activeEngine === 'prism' && prismFrame) {
        const prefix = new URL(prismFrame.prefix, location.href).href;
        if (href.startsWith(prefix)) {
          const decoded = window.$scramjet.unrewriteUrl(href, prismFrame.context);
          if (/^https?:\/\//.test(decoded)) emit('proxy:url', decoded);
        }
      }
      if (activeEngine === 'glass' && href.includes(__uv$config.prefix)) emit('proxy:url', __uv$config.decodeUrl(href.split(__uv$config.prefix)[1]));
      if (activeEngine === 'polygon' && href.includes('/scramjet/')) emit('proxy:url', window.orbitCodec.decode(href.split('/scramjet/')[1]));
    } catch (_) { /* Cross-origin documents do not expose their URL. */ }
    emit('proxy:status', 'Ready');
  });
  }
  listenForLoad(iframe);
  const control = (method) => {
    try {
      if (activeEngine === 'prism') prismFrame?.[method]();
      else if (method === 'reload') iframe.contentWindow.location.reload();
      else iframe.contentWindow.history[method]();
    } catch (error) { emit('proxy:status', error.message); }
  };
  window.proxyBack = () => control('back');
  window.proxyForward = () => control('forward');
  window.proxyReload = () => control('reload');
  window.proxyToggleFullscreen = () => document.fullscreenElement ? document.exitFullscreen() : iframe.requestFullscreen();
  initialize().catch(error => { trace('initialization-failed'); emit('proxy:error', error.message); });
})();
