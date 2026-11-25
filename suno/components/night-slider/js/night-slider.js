(() => {
  'use strict';
  const NAMES = {
    2000: 'Candle', 3000: 'Incandescent', 4000: 'Warm', 5000: 'Daylight',
    6000: 'Overcast', 7000: 'Cool', 8000: 'Cold'
  };

  const kelvinToRgb = (k) => {
    const t = k / 100;
    let r, g, b;
    if (t <= 66) {
      r = 255;
      g = 99.4708025861 * Math.log(t) - 161.1195681661;
      b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    } else {
      r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
      g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
      b = 255;
    }
    const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return [cl(r), cl(g), cl(b)];
  };

  window.SunoUI = window.SunoUI || {};

  SunoUI.nightSlider = (host, opts) => {
    const o = Object.assign({
      min: 2000, max: 8000, step: 1000, value: 5000,
      ariaLabel: 'Colour temperature', names: NAMES, onChange: null
    }, opts);

    const wrap = document.createElement('div');
    wrap.className = 'ns';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = o.min; input.max = o.max; input.step = o.step; input.value = o.value;
    input.setAttribute('aria-label', o.ariaLabel);
    const grooves = document.createElement('div');
    grooves.className = 'ns-grooves';
    grooves.setAttribute('aria-hidden', 'true');
    wrap.append(input, grooves);
    host.appendChild(wrap);

    for (let k = o.min; k <= o.max; k += o.step) {
      const g = document.createElement('span');
      g.className = 'ns-g' + (k === o.max ? ' flip' : '');
      g.dataset.k = String(k);
      const line = document.createElement('i');
      const label = document.createElement('em');
      label.textContent = k;
      g.append(line, label);
      grooves.appendChild(g);
    }

    const stopAt = (k) => grooves.querySelector(`.ns-g[data-k="${k}"]`);

    const paint = () => {
      const k = Number(input.value);
      const [r, g, b] = kelvinToRgb(k);
      const p = ((k - o.min) / (o.max - o.min)) * 100;
      input.style.setProperty('--ns-pos', p + '%');
      input.style.setProperty('--ns-rgb', `rgb(${r},${g},${b})`);
      input.setAttribute('aria-valuetext', `${k} kelvin, ${o.names[k] || ''}`);
      grooves.querySelectorAll('.ns-g').forEach((n) => {
        n.classList.toggle('on', Number(n.dataset.k) === k);
      });
      if (o.onChange) o.onChange(k);
      return k;
    };

    input.addEventListener('input', paint);
    paint();

    return {
      get: () => Number(input.value),
      set: (k) => { input.value = k; paint(); },
      name: () => o.names[Number(input.value)] || '',
      rgb: () => kelvinToRgb(Number(input.value)),
      input
    };
  };
})();
