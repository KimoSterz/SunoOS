(() => {
  'use strict';
  const KEY = 'suno-settings-v1';

  const DEFAULTS = {
    wifi: true, bt: true, dnd: false, tiling: true, theme: 'dark',
    join: 'mirror', dsel: 'ext', bri: 72, vol: 48, pmode: 'bal',
    scale: '150', rot: 'Landscape', prof: 'sRGB', hdr: false,
    res: '3840 x 2160', hz: '60 Hz',
    night: true, nightWhen: 'sun', nightFrom: '19:00', nightTo: '06:30', nightT: 5000
  };

  let state;
  try {
    state = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch (e) {
    state = Object.assign({}, DEFAULTS);
  }

  const subs = new Set();
  let save = null;

  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  };

  window.Suno = window.Suno || {};

  Suno.store = {
    get: () => state,
    set(patch) {
      state = Object.assign({}, state, patch);
      clearTimeout(save);
      save = setTimeout(persist, 120);
      subs.forEach((f) => { try { f(state); } catch (e) { console.error(e); } });
    },
    sub(f) { subs.add(f); return () => subs.delete(f); },
    reset() { state = Object.assign({}, DEFAULTS); persist(); subs.forEach((f) => f(state)); }
  };
})();
