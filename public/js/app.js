(function () {
  "use strict";

  const form = document.getElementById("address-form");
  const welcomeForm = document.getElementById("welcome-form");
  const address = document.getElementById("address");
  const welcomeAddress = document.getElementById("welcome-address");
  const welcome = document.getElementById("welcome");
  const proxyView = document.getElementById("proxy-view");
  const status = document.getElementById("status");
  const controls = ["back", "forward", "reload", "fullscreen"].map((id) => document.getElementById(id));
  const fullscreenButton = document.getElementById("fullscreen");
  const shortcuts = document.querySelectorAll("[data-proxy-url]");
  shortcuts.forEach((button) => {
    controls.push(button);
    button.addEventListener("click", () => navigate(button.dataset.proxyUrl));
  });
  let ready = false;

  function normalize(input) {
    const value = input.trim();
    if (!value) throw new Error("Enter a website address or search term.");

    if (/^https?:\/\//i.test(value)) return new URL(value).toString();
    if (/^[^\s.]+\.[^\s]+(?:\/.*)?$/.test(value) || value === "localhost") {
      return new URL(`https://${value}`).toString();
    }

    return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
  }

  async function navigate(value) {
    try {
      const url = normalize(value);
      await window.proxyNavigate(url);
      address.value = url;
      welcomeAddress.value = url;
      welcome.hidden = true;
      proxyView.hidden = false;
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function submit(event, input) {
    event.preventDefault();
    navigate(input.value);
  }

  form.addEventListener("submit", (event) => submit(event, address));
  welcomeForm.addEventListener("submit", (event) => submit(event, welcomeAddress));

  document.getElementById("back").addEventListener("click", () => window.proxyBack());
  document.getElementById("forward").addEventListener("click", () => window.proxyForward());
  document.getElementById("reload").addEventListener("click", () => window.proxyReload());
  fullscreenButton.addEventListener("click", async () => {
    try {
      await window.proxyToggleFullscreen();
    } catch (error) {
      status.textContent = error.message || "Fullscreen is not available in this browser.";
    }
  });

  document.addEventListener("fullscreenchange", () => {
    const active = Boolean(document.fullscreenElement);
    fullscreenButton.textContent = active ? "⛶" : "⛶";
    fullscreenButton.title = active ? "Exit fullscreen" : "Enter fullscreen";
    fullscreenButton.setAttribute("aria-label", fullscreenButton.title);
  });

  window.addEventListener("proxy:ready", () => {
    ready = true;
    controls.forEach((control) => (control.disabled = false));
    status.textContent = "Ready";
  });

  window.addEventListener("proxy:status", (event) => {
    status.textContent = event.detail;
  });

  window.addEventListener("proxy:url", (event) => {
    const url = event.detail;
    if (typeof url === "string" && /^https?:\/\//.test(url)) {
      address.value = url;
    }
    if (ready) status.textContent = "Ready";
  });

  window.addEventListener("proxy:error", (event) => {
    status.textContent = event.detail;
    controls.forEach((control) => (control.disabled = true));
  });
})();
