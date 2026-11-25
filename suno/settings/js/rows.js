(() => {
  'use strict';
  window.Suno = window.Suno || {};

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const rRow = (inner, extra = '') => `<div class="row" ${extra}>${inner}</div>`;
  const rSec = (rows, head = '') => rows.length ? `<section class="card">${head ? `<div class="card-h">${head}</div>` : ''}${rows.join('')}</section>` : '';

  const rSw = (key, label, sub = '', extra = '') => rRow(
    `${sub ? `<span class="cft"><b>${esc(label)}</b><em>${esc(sub)}</em></span>` : `<span class="cft"><b>${esc(label)}</b></span>`}
     <span class="cfc"><button type="button" class="sw${Suno.store.get()[key] ? ' on' : ''}" data-sw="${esc(key)}" role="switch" aria-checked="${!!Suno.store.get()[key]}" aria-label="${esc(label)}"><i></i></button></span>`,
    [extra, `data-rowfor="${esc(key)}"`].filter(Boolean).join(' ')
  );

  const rNav = (panel, label, value) => rRow(
    `<span class="cft"><b>${esc(label)}</b></span>
      <span class="cfc nv"><em>${esc(value)}</em><i class="chev"></i></span>`,
    `data-nav="${esc(panel)}"`
  );

  const rSg = (key, label, opts, sub = '') => {
    const v = String(Suno.store.get()[key]);
    return rRow(
      `<span class="cft"><b>${esc(label)}</b>${sub ? `<em>${esc(sub)}</em>` : ''}</span>
       <span class="cfc"><span class="sg" data-sg="${esc(key)}">${opts.map(([val, name]) =>
        `<button type="button" class="sg-b${val === v ? ' on' : ''}" data-sgb="${esc(val)}" aria-pressed="${val === v}">${esc(name)}</button>`).join('')}</span></span>`
    );
  };

  const rPk = (key, label, values, hide = false) => {
    const v = String(Suno.store.get()[key]);
    const opts = values.map((x) => Array.isArray(x) ? x : [x, x]);
    const cur = opts.find(([val]) => val === v);
    return `<div class="row${hide ? ' hide' : ''}" data-rowfor="${esc(key)}">
      <span class="cft"><b>${esc(label)}</b></span>
      <span class="cfc"><label class="pk"><select data-pk="${esc(key)}">${opts.map(([val, name]) =>
        `<option value="${esc(val)}"${val === v ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select><i class="chev"></i></label></span>
    </div>`;
  };

  const rRd = (key, value, label, sub = '') => {
    const v = String(Suno.store.get()[key]);
    return rRow(
      `<span class="cfc radio"><input type="radio" id="rd-${esc(key)}-${esc(value)}" name="rd-${esc(key)}" data-rd="${esc(key)}" value="${esc(value)}"${v === value ? ' checked' : ''}><label for="rd-${esc(key)}-${esc(value)}"></label></span>
       <span class="cft"><b>${esc(label)}</b>${sub ? `<em>${esc(sub)}</em>` : ''}</span>`,
      `data-rdfor="${esc(key)}"`
    );
  };

  const rBtn = (action, label, value) => rRow(
    `<span class="cft"><b>${esc(label)}</b></span>
     <span class="cfc"><button type="button" class="bt" data-act="${esc(action)}">${esc(value)}</button></span>`
  );

  Suno.rows = { esc, rRow, rSec, rSw, rNav, rSg, rPk, rRd, rBtn };
})();
