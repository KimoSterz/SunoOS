(() => {
  'use strict';
  const { esc } = Suno.rows;

  const SIDE = [
    { g: null, items: [['wifi', 'Wi-Fi', 'wifi'], ['network', 'Network', 'globe'], ['bt', 'Bluetooth', 'bluetooth']] },
    { g: 'Desktop', items: [['appearance', 'Appearance', 'sun-moon'], ['shell', 'Shell', 'layout-panel-left'], ['windows', 'Windows & Workspaces', 'app-window'], ['notifications', 'Notifications', 'bell'], ['search', 'Search', 'search']] },
    { g: 'Devices', items: [['displays', 'Displays', 'monitor'], ['sound', 'Sound', 'volume-2'], ['power', 'Power', 'battery-medium'], ['mouse', 'Mouse & Touchpad', 'mouse'], ['keyboard', 'Keyboard', 'keyboard'], ['printers', 'Printers', 'printer']] },
    { g: 'You', items: [['apps', 'Apps', 'grid-2x2'], ['accounts', 'Online Accounts', 'link']] },
    { g: null, items: [['privacy', 'Privacy & Security', 'shield'], ['wellbeing', 'Wellbeing', 'heart'], ['accessibility', 'Accessibility', 'accessibility']] },
    { g: 'System', items: [['sharing', 'Sharing', 'share-2'], ['region', 'Region & Language', 'languages'], ['datetime', 'Date & Time', 'clock'], ['users', 'Users', 'user'], ['remote', 'Remote Desktop', 'monitor-smartphone'], ['ssh', 'Secure Shell', 'square-terminal'], ['about', 'About', 'info']] }
  ];

  const mute = { wifi: 'Wi-Fi', network: 'Network', bt: 'Bluetooth', appearance: 'Appearance', shell: 'Shell', windows: 'Windows & Workspaces', notifications: 'Notifications', search: 'Search', sound: 'Sound', power: 'Power', mouse: 'Mouse & Touchpad', keyboard: 'Keyboard', printers: 'Printers', apps: 'Apps', accounts: 'Online Accounts', privacy: 'Privacy & Security', wellbeing: 'Wellbeing', accessibility: 'Accessibility', sharing: 'Sharing', region: 'Region & Language', datetime: 'Date & Time', users: 'Users', remote: 'Remote Desktop', ssh: 'Secure Shell', about: 'About' };

  let stack = ['displays'];
  let slider = null;

  const side = document.getElementById('side');
  const panelHost = document.getElementById('panel');
  const crumb = document.getElementById('crumb');

  const renderSide = (active) => {
    side.innerHTML = SIDE.map(({ g, items }) => `
      ${g ? `<div class="side-g">${g}</div>` : ''}
      ${items.map(([id, label]) => `<button type="button" class="side-i${id === active ? ' on' : ''}" data-nav="${id}">
        <span class="side-ic">${esc(label[0])}</span>${esc(label)}</button>`).join('')}`).join('');
  };

  const plabel = (id) => (Suno.panels.PANELS[id] && Suno.panels.PANELS[id].label) || mute[id] || id;

  const renderCrumb = (route) => {
    crumb.innerHTML = route.length > 1
      ? `<button type="button" class="back" data-back>&#8249;</button><span class="crumb-path">${route.map((id, i) =>
          i < route.length - 1 ? `<button type="button" data-jump="${i}">${esc(plabel(id))}</button>` : `<b>${esc(plabel(id))}</b>`).join('<i class="sep">›</i>')}</span>`
      : `<span class="crumb-path"><b>${esc(plabel(route[0]))}</b></span>`;
  };

  const mountSlider = () => {
    const host = document.getElementById('nl-slider');
    if (!host) return;
    const s = Suno.store.get();
    slider = SunoUI.nightSlider(host, {
      min: Suno.panels.K_MIN, max: Suno.panels.K_MAX, step: Suno.panels.K_STEP,
      value: s.nightT, names: Suno.panels.NIGHT_NAMES,
      onChange: (k) => Suno.store.set({ nightT: k })
    });
  };

  const render = () => {
    const route = stack;
    const id = route[route.length - 1];
    slider = null;
    const p = Suno.panels.PANELS[id] || {
      label: mute[id] || id,
      meta: () => 'This panel is not built yet',
      render: () => Suno.panels.panelStub({ label: mute[id] || id })
    };
    const s = Suno.store.get();
    renderSide(stack[0]);
    renderCrumb(route);
    panelHost.innerHTML = `<h1>${esc(p.label)}</h1><p class="sub">${esc(p.meta(s))}</p>${p.render(s, p)}`;
    mountSlider();
  };

  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      const id = nav.dataset.nav;
      stack = nav.classList.contains('side-i') || stack.includes(id)
        ? [id]
        : [...stack, id];
      render();
      return;
    }
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      stack = stack.slice(0, Number(jump.dataset.jump) + 1);
      render();
      return;
    }
    if (e.target.closest('[data-back]')) {
      if (stack.length > 1) stack.pop();
      render();
      return;
    }
    const sg = e.target.closest('[data-sgb]');
    if (sg) {
      const key = e.target.closest('[data-sg]').dataset.sg;
      const patch = { [key]: sg.dataset.sgb };
      Suno.store.set(patch);
      render();
      return;
    }
    const sw = e.target.closest('[data-sw]');
    if (sw) {
      Suno.store.set({ [sw.dataset.sw]: !Suno.store.get()[sw.dataset.sw] });
      render();
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'nightoff') {
        Suno.store.set({ night: false });
        render();
      }
      return;
    }
  });

  document.addEventListener('change', (e) => {
    const pk = e.target.closest('[data-pk]');
    if (pk) { Suno.store.set({ [pk.dataset.pk]: pk.value }); render(); return; }
    const rd = e.target.closest('[data-rd]');
    if (rd) { Suno.store.set({ [rd.dataset.rd]: rd.value }); render(); }
  });

  Suno.store.sub((s) => {
    if (slider && s.nightT !== slider.get()) slider.set(s.nightT);
  });

  render();
})();
