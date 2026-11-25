(() => {
  'use strict';
  const { esc, rSec, rSw, rNav, rSg, rPk, rRd, rBtn } = Suno.rows;

  const K_MIN = 2000, K_MAX = 8000, K_STEP = 1000;
  const NIGHT_NAMES = {
    2000: 'Candle', 3000: 'Incandescent', 4000: 'Warm', 5000: 'Daylight',
    6000: 'Overcast', 7000: 'Cool', 8000: 'Cold'
  };

  const DISP = {
    int: { n: 'Built-in display', res: '3072 x 1920', hz: '120 Hz' },
    ext: { n: 'Dell U2723QE', res: '3840 x 2160', hz: '60 Hz' }
  };

  const clockStr = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const nightSchedule = (s) => {
    if (!s.night) return '';
    const toH = (t) => Number(t.slice(0, 2)) + Number(t.slice(3)) / 60;
    const [a, b] = s.nightWhen === 'sun' ? [18.87, 6.97] : [toH(s.nightFrom), toH(s.nightTo)];
    const P = (x) => (x / 24) * 100;
    const bars = a > b
      ? `<i style="left:${P(a)}%;right:0"></i><i style="left:0;width:${P(b)}%"></i>`
      : `<i style="left:${P(a)}%;width:${P(b - a)}%"></i>`;
    const now = `<b style="left:${P(new Date().getHours() + new Date().getMinutes() / 60)}%"></b>`;
    return `<div class="nl"><div class="nl-day">${bars}${now}</div><div class="nl-dayl"><span>Midnight</span><span>6 AM</span><span>Noon</span><span>6 PM</span><span>Midnight</span></div></div>`;
  };

  const panelDisplays = (s) => {
    const d = DISP[s.dsel];
    return [
      `<section class="card hero"><div class="arr">
        <div class="arr-gfx"><span class="mon${s.join === 'join' ? ' two' : ''}"><i data-nl="${s.night ? 1 : 0}"></i></span></div>
        <span class="sg" data-sg="join" data-refresh="displays">
          <button type="button" class="sg-b${s.join === 'join' ? ' on' : ''}" data-sgb="join">Join</button>
          <button type="button" class="sg-b${s.join === 'mirror' ? ' on' : ''}" data-sgb="mirror">Mirror</button>
        </span>
        <p class="hint">${s.join === 'join' ? 'Two displays side by side' : 'Both displays show the same picture'}</p>
      </div></section>`,
      rSec([rPk('dsel', 'Display', [['int', DISP.int.n], ['ext', DISP.ext.n]]),
        rPk('res', 'Resolution', [d.res]),
        rPk('hz', 'Refresh rate', [d.hz]),
        rSg('scale', 'Scale', [['100', '100%'], ['125', '125%'], ['150', '150%'], ['175', '175%'], ['200', '200%']]),
        rPk('rot', 'Orientation', ['Landscape', 'Portrait right', 'Portrait left']),
        rSw('hdr', 'HDR', 'Brighter highlights in videos and photos that support it'),
        rPk('prof', 'Colour profile', ['sRGB', 'Display P3', 'Factory calibrated'])]),
      rSec([rNav('nightlight', 'Night Light', s.night ? 'On' : 'Off')])
    ].join('');
  };

  const panelNightLight = (s) => [
    rSec([rSw('night', 'Night Light', 'Warmer colours at night, easier on the eyes')]),
    `<section class="card hero">${nightSchedule(s)}<div class="nl-slider" id="nl-slider"></div></section>`,
    rSec([rRd('nightWhen', 'sun', 'Sunset to sunrise', 'Follows the sun where you are'),
      rRd('nightWhen', 'manual', 'Set times'),
      rPk('nightFrom', 'From', ['19:00', '20:00', '21:00', '22:00', '23:00'], s.nightWhen !== 'manual'),
      rPk('nightTo', 'To', ['05:30', '06:00', '06:30', '07:00', '08:00'], s.nightWhen !== 'manual')]),
    rSec([rBtn('nightoff', 'Turn off until tomorrow', 'Turn off')])
  ].join('');

  const panelStub = (s, panel) => `<section class="card"><div class="empty">
    <b>${esc(panel.label)}</b><em>This panel is not built yet.</em></div></section>`;

  const PANELS = {
    displays: { label: 'Displays', icon: 'monitor', group: 'Devices', meta: (s) => `Two displays · ${s.join === 'join' ? 'one desk across both' : 'showing the same thing'}`, render: panelDisplays },
    nightlight: { label: 'Night Light', icon: 'moon', group: 'Devices', up: 'displays', meta: (s) => !s.night ? 'Off' : (s.nightWhen === 'sun' ? 'From sunset to sunrise' : `From ${s.nightFrom} to ${s.nightTo}`), render: panelNightLight }
  };

  window.Suno = window.Suno || {};
  Suno.panels = { PANELS, panelStub, NIGHT_NAMES, K_MIN, K_MAX, K_STEP, clockStr };
})();
