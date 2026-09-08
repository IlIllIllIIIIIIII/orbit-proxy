(function () {
  'use strict';
  const iframe = document.getElementById('proxy-frame');
  const engineSelect = document.getElementById('proxy-engine');
  const transportSelect = document.getElementById('proxy-transport');
  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
  const wisp = window.__PROXY_CONFIG__?.wispUrl || new URL('/wisp/', location.href).href.replace(/^http/, 'ws');
  let ready = false, controller, prismFrame, legacy, connection, registration;
  let activeEngine = 'prism', currentTransport, pending = false;
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
    emit('proxy:status', 'Starting proxy engines…');
    const { ScramjetController } = window.$scramjetLoadController();
    legacy = new ScramjetController({
      prefix: '/scramjet/',
      files: { wasm: '/poly/polygon.wasm.wasm', all: '/poly/polygon.all.js', sync: '/poly/polygon.sync.js' },
      codec: window.orbitCodec
    });
    await legacy.init();
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
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
        await transport.init();
        if (!controller) {
          Object.assign($scramjetController.config, {
            scramjetPath: '/prism/prism.js', injectPath: '/prism/prism.inject.js', wasmPath: '/prism/prism.wasm'
          });
          Object.assign($scramjetController.config.codec, window.orbitCodec);
          controller = new $scramjetController.Controller({ serviceworker: registration.active, transport });
          await controller.wait();
          prismFrame = controller.createFrame(iframe, { plugins: [
            new $scramjetUtils.UrlWatcherPlugin(url => emit('proxy:url', url)),
            new $scramjetUtils.CatchEscapedLinksPlugin(url => {
              window.proxyNavigate(url.toString()).catch(error => emit('proxy:status', error.message));
              return new URL(location.href);
            })
          ] });
        } else await controller.setTransport(transport);
        currentTransport = choice;
      }
    } else {
      const base = selected === 'epoxy' ? '/libbybutslightlyworse/index.mjs' : '/libby/index.mjs';
      await connection.setTransport(selected === 'libcurlRaw' ? base : '/reflux/index.mjs', [{ base, wisp }]);
    }
  }

  window.proxyNavigate = async url => {
    if (!ready) throw new Error('The proxy is still starting.');
    if (pending) throw new Error('Please wait for the current navigation to start.');
    pending = true;
    try {
      const engine = engineSelect.value;
      emit('proxy:status', 'Connecting…');
      await setupTransport(engine, transportSelect.value);
      activeEngine = engine;
      if (engine === 'prism') prismFrame.go(url);
      else iframe.src = engine === 'glass' ? __uv$config.prefix + __uv$config.encodeUrl(url) : legacy.encodeUrl(url);
      emit('proxy:url', url);
      emit('proxy:status', 'Loading…');
    } finally { pending = false; }
  };

  iframe.addEventListener('load', () => {
    if (!ready) return;
    try {
      const href = iframe.contentWindow.location.href;
      if (activeEngine === 'glass' && href.includes(__uv$config.prefix)) emit('proxy:url', __uv$config.decodeUrl(href.split(__uv$config.prefix)[1]));
      if (activeEngine === 'polygon' && href.includes('/scramjet/')) emit('proxy:url', window.orbitCodec.decode(href.split('/scramjet/')[1]));
    } catch (_) { /* Cross-origin documents do not expose their URL. */ }
    emit('proxy:status', 'Ready');
  });
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
  initialize().catch(error => emit('proxy:error', error.message));
})();
