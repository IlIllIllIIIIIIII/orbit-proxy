(function () {
  'use strict';
  const sidebar = document.getElementById('sidebar');
  const toolbar = document.querySelector('.toolbar');
  const address = document.getElementById('address-form');
  const shortcuts = document.querySelector('.shortcuts');
  const label = document.querySelector('.sidebar-label');
  sidebar.insertBefore(toolbar, sidebar.firstChild);
  toolbar.prepend(document.querySelector('.sidebar-heading'));
  sidebar.insertBefore(address, label);
  sidebar.insertBefore(shortcuts, label);
  const tiles = [
    ['https://discord.com/app', 'Discord', '◕', 'discord'],
    ['https://play.geforcenow.com/mall/', 'GeForce NOW', '◈', 'geforce'],
    ['https://chatgpt.com/', 'ChatGPT', '◎', 'chatgpt'],
    ['https://reddit.com/', 'Reddit', '●', 'reddit'],
    ['https://github.com/', 'GitHub', '◉', 'github'],
    ['https://youtube.com/', 'YouTube', '▶', 'youtube']
  ];
  shortcuts.replaceChildren();
  for (const [url, name, icon, color] of tiles) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.proxyUrl = url;
    button.className = color;
    button.title = name;
    button.setAttribute('aria-label', name);
    button.textContent = icon;
    button.disabled = true;
    shortcuts.appendChild(button);
  }
  const list = document.getElementById('tab-list');
  list.after(document.getElementById('new-tab'));
  const footer = document.querySelector('.sidebar-footer');
  footer.appendChild(document.getElementById('fullscreen'));
  footer.before(document.getElementById('status'));
  const settings = document.getElementById('proxy-settings');
  settings.appendChild(document.querySelector('.proxy-options'));
  document.getElementById('settings-open').onclick = () => settings.showModal();
  const focusAddress = () => {
    document.querySelector('.shell').classList.remove('sidebar-collapsed');
    document.getElementById('sidebar-toggle').setAttribute('aria-expanded', 'true');
    document.getElementById('address').focus();
    document.getElementById('address').select();
  };
  document.getElementById('focus-address').onclick = focusAddress;
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      focusAddress();
    }
  });
})();
