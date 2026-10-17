// Flipbook preview. Every physical leaf has a front and a back face; turning
// a leaf rotates it around the spine. Pages come from the same renderer as the
// print files, trimmed (no bleed), so double spreads meet across the gutter
// exactly as they will in the bound book.

import { renderItem, itemSize, itemAssets, makeCanvas, pageNumbersFor, isDoubleSpread } from './render.js';
import { load } from './assets.js';
import { readingPages } from './export.js';
import { h, canvasToBlob, clamp } from './util.js';

const ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>';

export function openFlipbook(root, book, startItem = 0, onClose) {
  const urls = [];
  let leaves = [];
  let underL, underR; // shadows under the visible left and right pages
  let k = 0; // leaves turned
  let pagePx = 0;
  let disposed = false;

  const stageEl = h('div.fb-stage');
  const bookEl = h('div.fb-book');
  const where = h('span.where', 'Preparing pages…');
  const prev = h('button.icon-btn', { 'aria-label': 'Previous page', title: 'Previous (←)', on: { click: () => turn(-1) } });
  const next = h('button.icon-btn', { 'aria-label': 'Next page', title: 'Next (→)', on: { click: () => turn(1) } });
  prev.innerHTML = ICON_PREV;
  next.innerHTML = ICON_NEXT;
  const close = h('button.txt-btn.small', { on: { click: () => onClose?.() } }, 'Back to design');
  stageEl.append(bookEl);
  root.replaceChildren(stageEl, h('div.fb-bar', prev, where, next, close));
  root.hidden = false;

  const pages = readingPages(book);
  const L = pages.length / 2;

  function size() {
    const vw = stageEl.clientWidth || window.innerWidth;
    const vh = stageEl.clientHeight || window.innerHeight - 140;
    const ratio = book.spec.trimW / book.spec.trimH;
    const pw = Math.min((vw - 80) / 2, (vh - 60) * ratio);
    return { pw, ph: pw / ratio };
  }

  async function build() {
    const { pw } = size();
    pagePx = Math.round(pw * Math.min(window.devicePixelRatio || 1, 2));
    const scale = pagePx / book.spec.trimW;
    const faces = [];
    for (let idx = 0; idx < book.items.length; idx++) {
      if (disposed) return;
      const item = book.items[idx];
      await Promise.all(itemAssets(book, item).map((id) => load(id, 'preview')));
      const { w, h: hh } = itemSize(book, item);
      const c = makeCanvas(w * scale, hh * scale);
      renderItem(c.getContext('2d'), book, item, { scale, bleed: false, quality: 'preview', pageNumbers: pageNumbersFor(book, idx) });
      const sides = item.kind === 'spread' ? [0, 1] : [0];
      const spread = isDoubleSpread(item);
      for (const side of sides) {
        let pc = c;
        if (item.kind === 'spread') {
          pc = makeCanvas(c.width / 2, c.height);
          pc.getContext('2d').drawImage(c, -side * (c.width / 2), 0);
        }
        const u = URL.createObjectURL(await canvasToBlob(pc, 'image/jpeg', 0.9));
        urls.push(u);
        faces.push({ url: u, kind: item.kind, spread });
      }
    }
    if (disposed) return;
    underL = h('div.fb-under.l');
    underR = h('div.fb-under.r');
    bookEl.replaceChildren(underL, underR);
    leaves = [];
    for (let i = 0; i < L; i++) {
      const f = faces[2 * i], b = faces[2 * i + 1];
      const front = h('div.fb-face.front' + (f.kind === 'cover' ? '.cover' : '') + (f.spread ? '.spread' : ''), h('img', { src: f.url, alt: pages[2 * i].label, draggable: false }));
      const back = h('div.fb-face.back' + (b.spread ? '.spread' : ''), h('img', { src: b.url, alt: pages[2 * i + 1].label, draggable: false }));
      const leaf = h('div.fb-leaf', front, back);
      bookEl.append(leaf);
      leaves.push(leaf);
    }
    k = clamp(startLeaf(), 0, L);
    layout(false);
  }

  // Open at the spread being edited.
  function startLeaf() {
    const item = book.items[startItem];
    if (!item || item.kind === 'cover') return 0;
    if (item.kind === 'back') return L;
    const first = pages.findIndex((p) => p.idx === startItem);
    return Math.ceil(first / 2);
  }

  function layout(animate = true) {
    const { pw, ph } = size();
    bookEl.style.width = pw * 2 + 'px';
    bookEl.style.height = ph + 'px';
    // Centre the closed book on its visible half.
    const shift = k === 0 ? -pw / 2 : k === L ? pw / 2 : 0;
    if (!animate) bookEl.style.transition = 'none';
    bookEl.style.transform = `translateX(${shift}px)`;
    if (!animate) requestAnimationFrame(() => { bookEl.style.transition = ''; });
    if (underL) { underL.style.opacity = k > 0 ? 1 : 0; underR.style.opacity = k < L ? 1 : 0; }
    leaves.forEach((leaf, i) => {
      const turned = i < k;
      leaf.style.transform = `rotateY(${turned ? -180 : 0}deg)`;
      leaf.style.zIndex = turned ? i + 1 : L - i;
      if (!animate) { leaf.style.transition = 'none'; requestAnimationFrame(() => { leaf.style.transition = ''; }); }
    });
    const left = k > 0 ? pages[2 * k - 1] : null;
    const right = k < L ? pages[2 * k] : null;
    const spreadItem = left && right && left.idx === right.idx && isDoubleSpread(book.items[left.idx]);
    where.replaceChildren([left?.label, right?.label].filter(Boolean).join('  ·  '), spreadItem ? h('span.tag', 'DOUBLE SPREAD') : '');
    prev.disabled = k === 0;
    next.disabled = k === L;
  }

  function turn(d) {
    const nk = clamp(k + d, 0, L);
    if (nk === k) return;
    const leaf = leaves[d > 0 ? k : k - 1];
    if (leaf) leaf.style.zIndex = L + 2;
    k = nk;
    layout(true);
    if (leaf) setTimeout(() => layout(false), 820);
  }

  // Drag a page to turn it.
  let drag = null;
  stageEl.addEventListener('pointerdown', (e) => {
    const r = bookEl.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    const rightHalf = e.clientX > r.left + r.width / 2;
    const idx = rightHalf ? k : k - 1;
    const leaf = leaves[idx];
    if (!leaf) return;
    drag = { x: e.clientX, leaf, rightHalf, w: r.width / 2, moved: false };
    leaf.classList.add('dragging');
    leaf.style.zIndex = L + 2;
    stageEl.setPointerCapture(e.pointerId);
  });
  stageEl.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) drag.moved = true;
    const t = drag.rightHalf ? clamp(-dx / (drag.w * 1.6), 0, 1) : clamp(1 - dx / (drag.w * 1.6), 0, 1);
    drag.t = t;
    drag.leaf.style.transform = `rotateY(${-180 * t}deg)`;
  });
  const end = () => {
    if (!drag) return;
    const { leaf, rightHalf, moved, t = rightHalf ? 0 : 1 } = drag;
    leaf.classList.remove('dragging');
    drag = null;
    if (!moved) { turn(rightHalf ? 1 : -1); return; }
    if (rightHalf && t > 0.3) turn(1);
    else if (!rightHalf && t < 0.7) turn(-1);
    else layout(true);
  };
  stageEl.addEventListener('pointerup', end);
  stageEl.addEventListener('pointercancel', end);

  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); turn(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1); }
    else if (e.key === 'Home') { k = 0; layout(true); }
    else if (e.key === 'End') { k = L; layout(true); }
    else if (e.key === 'Escape') onClose?.();
  };
  window.addEventListener('keydown', onKey);
  const ro = new ResizeObserver(() => leaves.length && layout(false));
  ro.observe(stageEl);

  build();

  return {
    close() {
      disposed = true;
      window.removeEventListener('keydown', onKey);
      ro.disconnect();
      root.hidden = true;
      root.replaceChildren();
      urls.forEach((u) => URL.revokeObjectURL(u));
    },
  };
}
