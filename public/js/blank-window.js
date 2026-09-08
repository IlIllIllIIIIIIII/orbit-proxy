(() => {
  "use strict";

  // The embedded proxy must not recursively create more windows.
  if (window.self !== window.top) return;

  const launcher = document.getElementById("blank-launcher");
  const message = document.getElementById("blank-message");
  const button = document.getElementById("blank-open");
  let proxyWindow;

  function openProxy() {
    try {
      if (proxyWindow && !proxyWindow.closed) {
        proxyWindow.focus();
        return;
      }

      proxyWindow = window.open("about:blank", "_blank");
      if (!proxyWindow) {
        message.textContent = "Automatic opening was blocked. Use the button to open the proxy.";
        return;
      }

      const doc = proxyWindow.document;
      doc.title = "Orbit Proxy";
      doc.documentElement.style.cssText = "width:100%;height:100%;background:#080b16";
      doc.body.style.cssText = "margin:0;width:100%;height:100%;overflow:hidden";
      const viewport = doc.createElement("meta");
      viewport.name = "viewport";
      viewport.content = "width=device-width, initial-scale=1";
      doc.head.appendChild(viewport);

      const frame = doc.createElement("iframe");
      frame.title = "Orbit Proxy";
      frame.src = location.href;
      frame.allow = "fullscreen";
      frame.allowFullscreen = true;
      frame.style.cssText = "display:block;width:100%;height:100%;border:0";
      doc.body.appendChild(frame);
      message.textContent = "Proxy opened in an about:blank tab.";
      button.textContent = "Open or focus proxy tab";
    } catch (error) {
      message.textContent = "Could not open the proxy tab. You can continue browsing here.";
      console.error("Unable to open about:blank proxy", error);
    }
  }

  launcher.hidden = false;
  button.addEventListener("click", openProxy);
  openProxy();
})();
