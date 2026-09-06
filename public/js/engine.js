(function () {
  "use strict";

  let controller;
  let frame;

  const wispUrl =
    window.__PROXY_CONFIG__?.wispUrl ||
    new URL("/wisp/", location.href).toString().replace(/^http/, "ws");

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  async function getActiveWorker(registration) {
    if (navigator.serviceWorker.controller) {
      return navigator.serviceWorker.controller;
    }

    await navigator.serviceWorker.ready;
    return navigator.serviceWorker.controller || registration.active;
  }

  async function initialize() {
    if (!("serviceWorker" in navigator)) {
      throw new Error("This browser does not support service workers.");
    }

    emit("proxy:status", "Installing service worker…");
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/"
    });
    const serviceworker = await getActiveWorker(registration);

    if (!serviceworker) {
      throw new Error("The service worker did not become active. Reload once and try again.");
    }

    emit("proxy:status", "Connecting proxy…");
    controller = new $scramjetController.Controller({
      serviceworker,
      transport: new LibcurlTransport.LibcurlClient({ wisp: wispUrl }),
      config: {
        scramjetPath: "/scram/scramjet.js",
        wasmPath: "/scram/scramjet.wasm",
        injectPath: "/controller/controller.inject.js"
      }
    });

    await controller.wait();

    const iframe = document.getElementById("proxy-frame");
    frame = controller.createFrame(iframe, {
      plugins: [
        new $scramjetUtils.HttpCachePlugin(),
        new $scramjetUtils.UrlWatcherPlugin((url) => emit("proxy:url", url)),
        new $scramjetUtils.CatchEscapedLinksPlugin((url) => {
          window.proxyNavigate(url.toString());
          return new URL(location.href);
        })
      ]
    });

    emit("proxy:ready");
    emit("proxy:status", "Ready");
  }

  window.proxyNavigate = function proxyNavigate(url) {
    if (!frame) {
      throw new Error("The proxy is still starting. Please wait a moment.");
    }

    frame.go(url);
    emit("proxy:url", url);
    emit("proxy:status", "Loading…");
  };

  window.proxyBack = () => frame?.back();
  window.proxyForward = () => frame?.forward();
  window.proxyReload = () => frame?.reload();
  window.proxyToggleFullscreen = async function proxyToggleFullscreen() {
    const iframe = document.getElementById("proxy-frame");
    if (!iframe) throw new Error("No proxied page is open.");

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await iframe.requestFullscreen();
  };

  initialize().catch((error) => {
    console.error(error);
    emit("proxy:error", error.message || "Unable to start the proxy.");
  });
})();
