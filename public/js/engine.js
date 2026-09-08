(function () {
  "use strict";
  const frame = document.getElementById("proxy-frame");
  let ready = false;
  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

  async function initialize() {
    if (location.protocol === "file:" || !navigator.serviceWorker) {
      throw new Error("Open Orbit through localhost or your HTTPS website, not a local file.");
    }
    emit("proxy:status", "Starting ChemicalJS…");
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const finish = (error) => {
        clearTimeout(timer);
        window.removeEventListener("chemicalLoaded", loaded);
        window.removeEventListener("chemicalError", failed);
        error ? reject(error) : resolve();
      };
      const loaded = () => finish();
      const failed = (event) => finish(new Error(event.detail || "ChemicalJS failed to start."));
      const timer = setTimeout(() => finish(new Error("ChemicalJS startup timed out. Check your connection.")), 30000);
      window.addEventListener("chemicalLoaded", loaded);
      window.addEventListener("chemicalError", failed);
      script.src = "/chemical.js";
      script.dataset.transport = "libcurl";
      script.dataset.wisp = window.__PROXY_CONFIG__?.wispUrl || new URL("/wisp/", location.href).href.replace(/^http/, "ws");
      script.onerror = () => finish(new Error("Unable to load ChemicalJS."));
      document.head.appendChild(script);
    });
    const registration = await navigator.serviceWorker.getRegistration("/");
    const deadline = Date.now() + 20000;
    while (!registration?.active || registration.installing || registration.waiting || !navigator.serviceWorker.controller) {
      if (Date.now() > deadline) throw new Error("Proxy service worker did not activate. Close and reopen this site.");
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    ready = true;
    emit("proxy:ready");
    emit("proxy:status", "Ready");
  }

  window.proxyNavigate = async (url) => {
    if (!ready) throw new Error("The proxy is still starting. Please wait a moment.");
    const encoded = await window.chemical.encode(url, { service: "uv", autoHttps: true });
    if (!encoded) throw new Error("Unable to encode this address.");
    frame.src = encoded;
    emit("proxy:url", url);
    emit("proxy:status", "Loading…");
  };
  frame.addEventListener("load", async () => {
    if (!ready) return;
    try {
      const url = frame.contentWindow.location.href;
      if (url.includes("/~/uv/")) emit("proxy:url", await window.chemical.decode(url, { service: "uv" }));
      emit("proxy:status", "Ready");
    } catch (_) { /* A cross-origin frame does not expose its address. */ }
  });
  const control = (action) => {
    try { action(); } catch (error) { emit("proxy:status", error.message); }
  };
  window.proxyBack = () => control(() => frame.contentWindow.history.back());
  window.proxyForward = () => control(() => frame.contentWindow.history.forward());
  window.proxyReload = () => control(() => frame.contentWindow.location.reload());
  window.proxyToggleFullscreen = () => document.fullscreenElement ? document.exitFullscreen() : frame.requestFullscreen();
  initialize().catch(error => emit("proxy:error", error.message || "Unable to start the proxy."));
})();
