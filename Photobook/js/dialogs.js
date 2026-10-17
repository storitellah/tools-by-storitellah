// Toasts, popovers and modal dialogs.

import { h } from './util.js';
import { icon } from './icons.js';

export function toast(msg, { action, actionLabel, error = false, timeout = 4200 } = {}) {
  const root = document.getElementById('toasts');
  const t = h('div.toast' + (error ? '.error' : ''), h('span', msg), action ? h('button', { on: { click: () => { action(); t.remove(); } } }, actionLabel || 'Undo') : null);
  root.append(t);
  setTimeout(() => t.remove(), timeout);
  return t;
}

let pop = null;
let popCleanup = null;
export function popover(anchor, content, { place = 'below' } = {}) {
  closePopover();
  pop = h('div.pop', content);
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const pr = pop.getBoundingClientRect();
  let left = Math.min(window.innerWidth - pr.width - 8, Math.max(8, r.left + r.width / 2 - pr.width / 2));
  let top = place === 'above' ? r.top - pr.height - 8 : r.bottom + 8;
  if (top < 8) top = r.bottom + 8;
  if (top + pr.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - pr.height - 8);
  if (anchor.closest('.tb-left')) left = Math.max(8, r.left);
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
  const onDown = (e) => { if (!pop?.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
  const onKey = (e) => { if (e.key === 'Escape') closePopover(); };
  setTimeout(() => { document.addEventListener('pointerdown', onDown, true); document.addEventListener('keydown', onKey); });
  popCleanup = () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey); };
  return pop;
}
export function closePopover() { pop?.remove(); pop = null; popCleanup?.(); popCleanup = null; }

export function modal(title, body, { footer = [], wide = false, onClose } = {}) {
  const back = h('div.modal-back');
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const box = h('div.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title, style: wide ? { width: 'min(980px, 100%)' } : {} },
    h('header', h('h2', title), h('button.icon-btn', { 'aria-label': 'Close', on: { click: close } }, icon('close'))),
    body,
    footer.length ? h('footer', footer) : null);
  back.append(box);
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  return { close, box, back };
}

export function confirmDialog(title, msg, okLabel = 'OK', { danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; m.close(); resolve(v); };
    const m = modal(title, h('div.body', h('p', { style: { margin: 0 } }, msg)), {
      footer: [
        h('button.txt-btn', { on: { click: () => finish(false) } }, 'Cancel'),
        h('button.txt-btn' + (danger ? '.danger' : '.primary'), { on: { click: () => finish(true) } }, okLabel),
      ],
      onClose: () => finish(false),
    });
  });
}

export function promptDialog(title, label, value = '') {
  return new Promise((resolve) => {
    let done = false;
    const input = h('input.input', { value });
    const finish = (v) => { if (done) return; done = true; m.close(); resolve(v); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(input.value.trim() || null); });
    const m = modal(title, h('div.body', h('label.field', h('span', label), input)), {
      footer: [h('button.txt-btn', { on: { click: () => finish(null) } }, 'Cancel'), h('button.txt-btn.primary', { on: { click: () => finish(input.value.trim() || null) } }, 'Save')],
      onClose: () => finish(null),
    });
    setTimeout(() => { input.focus(); input.select(); });
  });
}
