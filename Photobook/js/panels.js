// Panels around the book: photo tray, filmstrip, page bar, inspector and the
// template picker.

import { app, emit, commit, curItem, selected, saveTemplate } from './state.js';
import { renderItem, itemSize, itemAssets, makeCanvas, pageNumbersFor, isDoubleSpread, sideOf, color, effectiveDpi } from './render.js';
import { load, peek, info, thumbURL } from './assets.js';
import { applyTemplate, newItem, templateFromItem } from './layout.js';
import { itemLabel } from './export.js';
import { h, clamp } from './util.js';
import { icon } from './icons.js';
import { LOGO_ROLE_NAMES } from './defaults.js';
import { toast, popover, closePopover, promptDialog } from './dialogs.js';

// ---------- Shared form controls ----------

export function colorField(value, onChange, { allowNone = false } = {}) {
  const wrap = h('div.color-field');
  const draw = (v) => {
    wrap.replaceChildren();
    if (allowNone) wrap.append(h('button.tok', { title: 'None', 'aria-pressed': String(!v || v === 'transparent'), style: { background: 'repeating-conic-gradient(#555 0 25%, #333 0 50%) 0 0/8px 8px' }, on: { click: () => set('transparent') } }));
    for (const c of app.book.theme.colors) {
      wrap.append(h('button.tok', { title: c.name, 'aria-pressed': String(v === '@' + c.key), style: { background: c.value }, on: { click: () => set('@' + c.key) } }));
    }
    const hex = v && v[0] === '#' ? v : color(app.book, v);
    const picker = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000', title: 'Custom colour' });
    picker.addEventListener('input', () => set(picker.value, true));
    picker.addEventListener('change', () => set(picker.value));
    wrap.append(picker);
  };
  const set = (v, live) => { onChange(v, live); if (!live) draw(v); };
  draw(value);
  return wrap;
}

function num(label, value, onChange, { step = 0.1, min = -1e6, max = 1e6, unit = '' } = {}) {
  const i = h('input.input', { type: 'number', step, min, max, value: round(value) });
  i.addEventListener('change', () => { const v = parseFloat(i.value); if (!Number.isNaN(v)) onChange(clamp(v, min, max)); });
  return h('label.field', h('span', label + (unit ? ` (${unit})` : '')), i);
}
const round = (v) => Math.round(v * 100) / 100;

function sel(label, value, options, onChange) {
  const s = h('select.input', options.map(([v, t]) => h('option', { value: v, selected: v === value }, t)));
  s.addEventListener('change', () => onChange(s.value));
  return h('label.field', h('span', label), s);
}

function range(label, value, min, max, step, onChange) {
  const i = h('input', { type: 'range', min, max, step, value });
  i.addEventListener('input', () => onChange(parseFloat(i.value), true));
  i.addEventListener('change', () => onChange(parseFloat(i.value), false));
  return h('label.field', h('span', label), i);
}

export function fontOptions(book) {
  const fams = new Set();
  for (const f of book.fontFiles) fams.add(f.family);
  for (const r of Object.values(book.theme.fonts)) { fams.add(r.family); fams.add(r.fallback); }
  ['Georgia', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New'].forEach((f) => fams.add(f));
  return [
    ...Object.entries(book.theme.fonts).map(([k, r]) => ['@' + k, `${k[0].toUpperCase() + k.slice(1)} — ${r.family}`]),
    ...[...fams].map((f) => [f, f]),
  ];
}

// ---------- Photo tray ----------

export function usageMap(book) {
  const m = new Map();
  for (const it of book.items) for (const el of it.elements) if (el.type === 'image' && el.asset) m.set(el.asset, (m.get(el.asset) || 0) + 1);
  return m;
}

function lowResSet(book) {
  const s = new Set();
  for (const it of book.items) for (const el of it.elements) {
    if (el.type === 'image' && el.asset && effectiveDpi(book, it, el, info(el.asset)) < book.spec.minDpi) s.add(el.asset);
  }
  return s;
}

let trayFilter = 'all';
export function renderTray(root, actions) {
  const book = app.book;
  const used = usageMap(book);
  const low = lowResSet(book);
  const unused = book.photos.filter((id) => !used.has(id));
  const list = trayFilter === 'unused' ? unused : book.photos;
  const grid = h('div.photo-grid');
  for (const id of list) {
    const a = info(id);
    if (!a) continue;
    const img = h('img', { alt: a.name, loading: 'lazy' });
    thumbURL(id).then((u) => { img.src = u; });
    const del = h('button.del', { title: 'Remove from book', on: { click: (e) => { e.stopPropagation(); actions.removePhoto(id); } } }, '×');
    const card = h('div.photo' + (used.has(id) ? '' : '.unused'), {
      draggable: true, title: `${a.name}\n${a.w} × ${a.h} px` + (used.has(id) ? '' : '\nNot placed yet'),
      on: {
        dragstart: (e) => { e.dataTransfer.setData('text/x-photobook-asset', id); e.dataTransfer.effectAllowed = 'copy'; },
        click: () => actions.photoClicked(id),
      },
    }, img, used.has(id) ? h('span.used', String(used.get(id))) : null, low.has(id) ? h('span.lowres', { title: 'Low resolution where it is used' }) : null, del);
    grid.append(card);
  }
  root.replaceChildren(
    h('div.panel-title', `Photos · ${book.photos.length}`, h('button.txt-btn.small', { on: { click: actions.addPhotos } }, icon('plus'), 'Add')),
    h('div.drop-card', h('strong', 'Drop photos here or anywhere'), 'New photos are laid out into new pages. Drag a photo onto a frame to place it.'),
    h('div.row.wrap',
      unused.length ? h('button.txt-btn.small', { on: { click: actions.layoutUnused } }, `Lay out ${unused.length} unplaced`) : null,
      book.photos.length ? h('button.txt-btn.small', { on: { click: actions.redesign }, title: 'Lay out the whole book again from all photos, in order' }, icon('shuffle'), 'Re-design book') : null),
    h('div.row', h('div.seg',
      h('button', { 'aria-pressed': String(trayFilter === 'all'), on: { click: () => { trayFilter = 'all'; renderTray(root, actions); } } }, 'All'),
      h('button', { 'aria-pressed': String(trayFilter === 'unused'), on: { click: () => { trayFilter = 'unused'; renderTray(root, actions); } } }, `Unplaced (${unused.length})`))),
    grid,
  );
}

// ---------- Filmstrip ----------

const thumbCache = new Map(); // item id -> { key, canvas }
const THUMB_H = 56;

function thumbKey(book, item) {
  return JSON.stringify(item) + JSON.stringify(book.theme) + JSON.stringify(book.meta) + book.spec.trimW + 'x' + book.spec.trimH + item.elements.map((e) => (e.asset && peek(e.asset, 'thumb') ? 1 : 0)).join('');
}

function itemThumb(book, idx, height = THUMB_H) {
  const item = book.items[idx];
  const key = thumbKey(book, item) + idx + height;
  const hit = thumbCache.get(item.id);
  if (hit && hit.key === key) return hit.canvas;
  const { w, h: hh } = itemSize(book, item);
  const scale = (height * 2) / hh;
  const c = hit?.canvas || makeCanvas(1, 1);
  c.width = Math.round(w * scale); c.height = Math.round(hh * scale);
  c.style.height = height + 'px';
  c.style.width = (w / hh) * height + 'px';
  renderItem(c.getContext('2d'), book, item, { scale, bleed: false, quality: 'thumb', pageNumbers: pageNumbersFor(book, idx) });
  thumbCache.set(item.id, { key, canvas: c });
  const missing = itemAssets(book, item).filter((id) => !peek(id, 'thumb'));
  if (missing.length) Promise.all(missing.map((id) => load(id, 'thumb'))).then(() => emit('thumbs'));
  return c;
}

export function renderFilmstrip(root, actions) {
  const book = app.book;
  const nodes = book.items.map((item, idx) => {
    const movable = item.kind === 'spread';
    const btn = h('button.thumb', {
      'aria-current': String(idx === app.cur), title: itemLabel(book, idx), draggable: movable,
      on: {
        click: () => actions.goTo(idx),
        dragstart: (e) => { e.dataTransfer.setData('text/x-photobook-item', String(idx)); btn.classList.add('dragging'); },
        dragend: () => btn.classList.remove('dragging'),
        dragover: (e) => { if ([...e.dataTransfer.types].includes('text/x-photobook-item') && movable) { e.preventDefault(); btn.classList.add('drop-before'); } },
        dragleave: () => btn.classList.remove('drop-before'),
        drop: (e) => { btn.classList.remove('drop-before'); const from = +e.dataTransfer.getData('text/x-photobook-item'); if (!Number.isNaN(from)) actions.moveItem(from, idx); },
      },
    }, itemThumb(book, idx), isDoubleSpread(item) ? h('span.sp', 'SPREAD') : null, h('span.cap', item.kind === 'spread' ? itemLabel(book, idx).replace(/Inside cover/g, 'IC') : item.kind === 'cover' ? 'Cover' : 'Back'));
    return btn;
  });
  const backIdx = book.items.findIndex((it) => it.kind === 'back');
  nodes.splice(backIdx, 0, h('button.add-spread', { title: 'Add a spread after the current one', on: { click: actions.addSpread } }, icon('plus')));
  root.replaceChildren(...nodes);
  root.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// ---------- Page bar ----------

export function renderPagebar(root, editor, actions) {
  const book = app.book;
  const item = curItem();
  const isSpread = item.kind === 'spread';
  const parts = [];
  if (isSpread) {
    const spreads = book.items.filter((x) => x.kind === 'spread');
    const si = spreads.indexOf(item);
    const lbl = (side) => (si === 0 && side === 0) || (si === spreads.length - 1 && side === 1) ? 'Inside cover' : `Page ${pageNumbersFor(book, app.cur)[side]}`;
    parts.push(h('div.seg', { title: 'Page tools act on this page' },
      h('button', { 'aria-pressed': String(app.side === 0), on: { click: () => { app.side = 0; emit('side'); } } }, lbl(0)),
      h('button', { 'aria-pressed': String(app.side === 1), on: { click: () => { app.side = 1; emit('side'); } } }, lbl(1))));
  } else parts.push(h('span.label', item.kind === 'cover' ? 'Front cover' : 'Back cover'));

  parts.push(h('button.chip', { on: { click: (e) => openTemplatePicker(e.currentTarget, actions) } }, icon('layout'), 'Layout'));
  parts.push(h('button.chip', { title: 'Try another layout with the same photos', on: { click: actions.shuffle } }, icon('shuffle'), 'Shuffle'));
  parts.push(h('span.sep'));
  parts.push(h('button.chip', { on: { click: () => actions.addElement('image') } }, icon('image'), 'Frame'));
  parts.push(h('button.chip', { on: { click: () => actions.addElement('text') } }, icon('text'), 'Text'));
  parts.push(h('button.chip', { on: { click: () => actions.addElement('shape') } }, icon('shape'), 'Shape'));
  parts.push(h('button.chip', { on: { click: () => actions.addElement('logo') } }, icon('logo'), 'Logo'));
  parts.push(h('span.sep'));
  const side = isSpread ? app.side : 0;
  const bgBtn = h('button.swatch-btn', { title: 'Page colour', style: { background: color(book, item.bg[side]) } });
  bgBtn.addEventListener('click', () => {
    popover(bgBtn, h('div', { style: { padding: '6px', display: 'grid', gap: '8px' } },
      h('div.panel-title', 'Page colour'),
      colorField(item.bg[side], (v, live) => { item.bg[side] = v; if (live) editor.requestRender(); else commit('page'); }),
      isSpread ? h('button.txt-btn.small', { on: { click: () => { item.bg[1 - side] = item.bg[side]; commit('page'); closePopover(); } } }, 'Use on both pages') : null));
  });
  parts.push(bgBtn);
  const guides = h('button.icon-btn', { title: 'Show bleed, trim and safe-area guides', 'aria-pressed': String(editor.showGuides), on: { click: () => { editor.showGuides = !editor.showGuides; guides.style.color = editor.showGuides ? 'var(--accent)' : ''; } } }, icon('guides'));
  guides.style.color = editor.showGuides ? 'var(--accent)' : '';
  parts.push(guides);
  parts.push(h('button.icon-btn', { title: 'Zoom out', on: { click: () => editor.setZoom(editor.zoom / 1.25) } }, icon('zoomOut')));
  parts.push(h('button.chip', { title: 'Fit to window', on: { click: () => editor.setZoom(1) } }, Math.round(editor.zoom * 100) + '%'));
  parts.push(h('button.icon-btn', { title: 'Zoom in', on: { click: () => editor.setZoom(editor.zoom * 1.25) } }, icon('zoomIn')));
  root.replaceChildren(...parts);
}

// ---------- Template picker ----------

function templatePreview(book, tpl, item, side, height) {
  const scope = tpl.scope;
  const fake = newItem(scope === 'spread' ? 'spread' : item.kind === 'spread' ? 'cover' : item.kind);
  if (scope === 'cover') fake.kind = 'cover';
  if (scope === 'back') fake.kind = 'back';
  // Preview with the photos that would move into it.
  const photos = item.elements.filter((el) => el.type === 'image' && el.asset && (scope !== 'page' || item.kind !== 'spread' || sideOf(item, el) === side)).map((el) => el.asset);
  const tmpBook = { ...book, brand: book.brand };
  applyTemplate(tmpBook, fake, tpl);
  fake.elements.filter((e) => e.type === 'image').forEach((e, i) => { e.asset = photos[i] || book.photos[i] || null; });
  const { w, h: hh } = itemSize(book, fake);
  const scale = (height * 2) / hh;
  const c = makeCanvas(w * scale, hh * scale);
  const paint = () => renderItem(c.getContext('2d'), book, fake, { scale, bleed: false, quality: 'thumb', editor: true });
  paint();
  const missing = itemAssets(book, fake).filter((id) => !peek(id, 'thumb'));
  if (missing.length) Promise.all(missing.map((id) => load(id, 'thumb'))).then(paint);
  return c;
}

export function openTemplatePicker(anchor, actions) {
  const book = app.book;
  const item = curItem();
  const side = item.kind === 'spread' ? app.side : 0;
  const box = h('div', { style: { width: 'min(640px, 86vw)', padding: '6px' } });
  const section = (title, tpls, wide) => {
    if (!tpls.length) return null;
    return h('div.section',
      h('div.panel-title', title),
      h('div.tpl-grid' + (wide ? '.spreads' : ''), tpls.map((t) => h('button.tpl', {
        'aria-current': String(item.tpl?.[side] === t.id), title: t.name,
        on: { click: () => { actions.applyTemplate(t); closePopover(); } },
      }, templatePreview(book, t, item, side, 52), t.name))));
  };
  if (item.kind === 'spread') {
    box.append(
      section(`Page layouts — ${side === 0 ? 'left' : 'right'} page`, app.templates.filter((t) => t.scope === 'page')),
      section('Across the spread', app.templates.filter((t) => t.scope === 'spread'), true),
    );
  } else {
    box.append(section(item.kind === 'cover' ? 'Cover layouts' : 'Back cover layouts', app.templates.filter((t) => t.scope === item.kind)));
  }
  box.append(h('div.section', h('div.row',
    h('button.txt-btn.small', { on: { click: async () => {
      closePopover();
      const name = await promptDialog('Save as template', 'Template name', item.kind === 'spread' ? 'My page layout' : 'My layout');
      if (!name) return;
      const whole = item.kind !== 'spread' || isDoubleSpread(item);
      await saveTemplate(templateFromItem(book, item, whole && item.kind === 'spread' ? null : side, name));
      toast(`Saved “${name}” to your templates`);
    } } }, icon('save'), item.kind === 'spread' ? (isDoubleSpread(item) ? 'Save spread as template' : 'Save this page as template') : 'Save as template'),
    h('span.hint', 'Manage templates under Book & theme → Templates.'))));
  popover(anchor, box, { place: 'above' });
}

// ---------- Inspector ----------

export function renderInspector(root, editor, actions) {
  const book = app.book;
  const item = curItem();
  const el = selected();
  if (!el) { root.replaceChildren(); return; }
  const { w: W, h: H } = itemSize(book, item);
  const side = sideOf(item, el);
  const pageX = item.kind === 'spread' ? side * book.spec.trimW : 0;
  const set = (patch, live) => { Object.assign(el, patch); if (live) { editor.requestRender(); } else commit('element'); };

  const kids = [];
  const title = { image: 'Photo frame', text: 'Text', shape: 'Shape', logo: 'Logo' }[el.type];
  kids.push(h('div.panel-title', title, h('div.row', { style: { margin: 0 } },
    h('button.icon-btn', { title: el.locked ? 'Unlock' : 'Lock position', on: { click: () => set({ locked: !el.locked }) } }, icon(el.locked ? 'lock' : 'unlock')),
    h('button.icon-btn', { title: 'Duplicate (Ctrl/Cmd+D)', on: { click: actions.duplicate } }, icon('copy')),
    h('button.icon-btn', { title: 'Delete (Del)', on: { click: actions.remove } }, icon('trash')))));

  // Type-specific
  if (el.type === 'image') {
    const a = el.asset && info(el.asset);
    const dpi = a ? effectiveDpi(book, item, el, a) : null;
    kids.push(h('div.section',
      a ? h('div.hint', `${a.name} · ${a.w}×${a.h}px · `, h('span', { style: { color: dpi < book.spec.minDpi ? 'var(--danger)' : 'var(--ok)' } }, `${Math.round(dpi)} dpi here`)) : h('div.hint', 'Empty frame — drag a photo onto it, or pick one below.'),
      h('div.row',
        h('button.txt-btn.small', { on: { click: () => actions.pickPhotoFor(el) } }, a ? 'Replace photo' : 'Choose photo'),
        a ? h('button.txt-btn.small', { on: { click: () => (editor.cropping === el.id ? editor.exitCrop() : editor.enterCrop(el.id)) } }, icon('crop'), editor.cropping === el.id ? 'Done' : 'Reposition') : null,
        a ? h('button.txt-btn.small', { on: { click: () => set({ asset: null }) } }, 'Clear') : null),
      a ? range('Zoom', el.zoom || 1, el.fit === 'contain' ? 0.2 : 1, 6, 0.01, (v, live) => set({ zoom: v }, live)) : null,
      h('div.row', sel('Fit', el.fit || 'cover', [['cover', 'Fill frame'], ['contain', 'Whole photo']], (v) => set({ fit: v, zoom: 1, cx: 0.5, cy: 0.5 })),
        num('Corner radius', el.radius || 0, (v) => set({ radius: v }), { min: 0, step: 0.5, unit: 'mm' })),
      h('div.row', num('Border', el.strokeW || 0, (v) => set({ strokeW: v }), { min: 0, step: 0.1, unit: 'mm' })),
      (el.strokeW || 0) > 0 ? colorField(el.stroke, (v, live) => set({ stroke: v }, live)) : null,
    ));
  }
  if (el.type === 'text') {
    const ta = h('textarea.input', { rows: 4, placeholder: el.placeholder || '' });
    ta.value = el.text;
    ta.addEventListener('input', () => set({ text: ta.value }, true));
    ta.addEventListener('change', () => set({ text: ta.value }));
    kids.push(h('div.section',
      ta,
      h('div.hint', 'Fields: {title} {subtitle} {author} {year} {colophon} {page}. Double-click text on the page to type in place.'),
      sel('Font', el.font, fontOptions(book), (v) => set({ font: v })),
      h('div.row', num('Size', el.size, (v) => set({ size: v }), { min: 2, max: 200, step: 0.5, unit: 'pt' }),
        sel('Weight', String(el.weight || 400), [['300', 'Light'], ['400', 'Regular'], ['600', 'Semibold'], ['700', 'Bold'], ['900', 'Black']], (v) => set({ weight: +v }))),
      h('div.row',
        sel('Align', el.align, [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], (v) => set({ align: v })),
        sel('Vertical', el.valign || 'top', [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']], (v) => set({ valign: v }))),
      h('div.row', num('Line height', el.leading || 1.2, (v) => set({ leading: v }), { min: 0.6, max: 3, step: 0.05 }),
        num('Tracking', el.tracking || 0, (v) => set({ tracking: v }), { min: -200, max: 800, step: 10, unit: '‰' })),
      h('div.row',
        h('label.check', h('input', { type: 'checkbox', checked: !!el.upper, on: { change: (e) => set({ upper: e.target.checked }) } }), 'Capitals'),
        h('label.check', h('input', { type: 'checkbox', checked: !!el.italic, on: { change: (e) => set({ italic: e.target.checked }) } }), 'Italic')),
      h('div.field', h('span', 'Colour'), colorField(el.color, (v, live) => set({ color: v }, live))),
      h('label.field', h('span', 'Placeholder (shown while empty, never printed)'), h('input.input', { value: el.placeholder || '', on: { change: (e) => set({ placeholder: e.target.value }) } })),
    ));
  }
  if (el.type === 'shape') {
    kids.push(h('div.section',
      h('div.row', sel('Shape', el.shape, [['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['blob', 'Hand-drawn circle'], ['line', 'Line']], (v) => set({ shape: v })),
        el.shape === 'blob' ? h('button.txt-btn.small', { style: { alignSelf: 'end' }, on: { click: () => set({ seed: (el.seed || 1) + 1 }) } }, 'New outline') : null),
      h('div.field', h('span', el.shape === 'line' ? 'Colour' : 'Fill'), colorField(el.fill, (v, live) => set({ fill: v }, live), { allowNone: true })),
      h('div.row', num(el.shape === 'line' ? 'Thickness' : 'Outline', el.strokeW || 0, (v) => set({ strokeW: v }), { min: 0, step: 0.1, unit: 'mm' }),
        el.shape === 'rect' ? num('Corner radius', el.radius || 0, (v) => set({ radius: v }), { min: 0, step: 0.5, unit: 'mm' }) : null),
      el.shape !== 'line' && el.strokeW > 0 ? colorField(el.stroke, (v, live) => set({ stroke: v }, live)) : null,
    ));
  }
  if (el.type === 'logo') {
    const opts = [
      ...Object.keys(book.brand.roles).map((r) => ['@' + r, `${LOGO_ROLE_NAMES[r] || r} (follows brand)`]),
      ...book.brand.logos.map((l) => [l.key, l.name]),
    ];
    kids.push(h('div.section', sel('Logo', el.logo, opts, (v) => set({ logo: v })), h('div.hint', 'Change logo files and roles under Book & theme → Brand.')));
  }

  // Geometry, in mm from the page's top-left trim corner.
  kids.push(h('div.section',
    h('div.panel-title', 'Position'),
    h('div.grid2',
      num('X', el.x * W - pageX, (v) => set({ x: (v + pageX) / W }), { unit: 'mm' }),
      num('Y', el.y * H, (v) => set({ y: v / H }), { unit: 'mm' }),
      num('Width', el.w * W, (v) => set({ w: Math.max(1, v) / W }), { unit: 'mm', min: 1 }),
      num('Height', el.h * H, (v) => set({ h: Math.max(1, v) / H }), { unit: 'mm', min: 1 }),
      num('Rotation', el.rot || 0, (v) => set({ rot: v }), { step: 1, unit: '°', min: -180, max: 180 }),
      num('Opacity', Math.round((el.opacity ?? 1) * 100), (v) => set({ opacity: clamp(v, 0, 100) / 100 }), { step: 5, min: 0, max: 100, unit: '%' })),
    h('div.row.wrap',
      h('button.txt-btn.small', { title: 'Fill this page edge to edge (bleeds)', on: { click: () => actions.fillPage() } }, 'Fill page'),
      item.kind === 'spread' ? h('button.txt-btn.small', { title: 'Run across both pages as a double spread', on: { click: () => actions.fillSpread() } }, 'Fill spread') : null,
      h('button.txt-btn.small', { title: 'Centre on the page', on: { click: () => actions.centre() } }, 'Centre')),
    h('div.row',
      h('button.txt-btn.small', { on: { click: () => actions.layer(1) } }, icon('up'), 'Forward'),
      h('button.txt-btn.small', { on: { click: () => actions.layer(-1) } }, icon('down'), 'Back')),
  ));
  root.replaceChildren(...kids);
}

