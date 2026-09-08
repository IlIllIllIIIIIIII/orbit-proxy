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
  const tabs = [{ id: 'initial', url: '' }];
  let activeTab = tabs[0];
  const list = document.getElementById('tab-list');
  function renderTabs() {
    list.replaceChildren();
    for (const tab of tabs) {
      const row = document.createElement('div');
      row.className = 'tab-row' + (tab === activeTab ? ' active' : '');
      const open = document.createElement('button');
      open.className = 'tab-open';
      const title = tab.url ? new URL(tab.url).hostname : 'New tab';
      open.textContent = '◌  ' + title;
      open.title = tab.url || title;
      open.setAttribute('aria-current', tab === activeTab ? 'page' : 'false');
      open.onclick = () => selectTab(tab);
      const close = document.createElement('button');
      close.className = 'tab-close';
      close.textContent = '×';
      close.setAttribute('aria-label', 'Close ' + title);
      close.onclick = () => {
        if (tab === activeTab) {
          const next = tabs.find(item => item !== tab);
          if (next ? !selectTab(next) : !newTab()) return;
        }
        window.proxyCloseTab(tab.id);
        tabs.splice(tabs.indexOf(tab), 1);
        renderTabs();
      };
      row.append(open, close);
      list.appendChild(row);
    }
  }
  function selectTab(tab) {
    try { window.proxySelectTab(tab.id); }
    catch (error) { status.textContent = error.message; return false; }
    activeTab = tab;
    address.value = tab.url;
    welcomeAddress.value = tab.url;
    welcome.hidden = Boolean(tab.url);
    proxyView.hidden = !tab.url;
    renderTabs();
    return true;
  }
  function newTab() {
    const tab = { id: crypto.randomUUID(), url: '' };
    if (!selectTab(tab)) return false;
    tabs.push(tab);
    renderTabs();
    address.focus();
    return true;
  }
  document.getElementById('new-tab').onclick = newTab;
  document.getElementById('sidebar-toggle').onclick = event => {
    const collapsed = document.querySelector('.shell').classList.toggle('sidebar-collapsed');
    event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
  };
  renderTabs();
  document.querySelector('.brand').addEventListener('click', event => {
    event.preventDefault();
    welcome.hidden = false;
    proxyView.hidden = true;
  });

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
      activeTab.url = url;
      renderTabs();
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
      activeTab.url = url;
      renderTabs();
    }
    if (ready) status.textContent = "Ready";
  });

  window.addEventListener("proxy:error", (event) => {
    status.textContent = event.detail;
    controls.forEach((control) => (control.disabled = true));
  });
})();
