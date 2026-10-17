// Boot and wiring: connects state, the stage, the panels and the dialogs.

import { db, requestPersistence } from './db.js';
import { app, on, emit, commit, undo, redo, canUndo, canRedo, curItem, selected, loadTemplates, createBook, openBook, onSaved } from './state.js';
import { loadAssetIndex, importImage, fetchAsFile, registerFonts, waitForFonts, info } from './assets.js';
import { createEditor } from './editor.js';
import { renderTray, renderFilmstrip, renderPagebar, renderInspector, usageMap } from './panels.js';
import { autoLayout, layoutMore, applyTemplate, makeElement, newItem } from './layout.js';
import { sideOf, isDoubleSpread } from './render.js';
import { openFlipbook } from './flipbook.js';
import { openDesign, addFontFiles } from './design.js';
import { openExport } from './exportui.js';
import { openBooksMenu } from './books.js';
import { initFolder, onFolder, folder, scheduleFolderSync, restoreBackup } from './backup.js';
import { toast, popover, closePopover, confirmDialog } from './dialogs.js';
import { DEMO_PHOTOS } from './defaults.js';
import { h, clone, uid, pickFiles, clamp } from './util.js';
import { ICONS } from './icons.js';
import { thumbURL } from './assets.js';

const $ = (id) => document.getElementById(id);
let editor;
let flip = null;

function bootStatus(msg, frac) {
  $('boot-msg').textContent = msg;
  if (frac != null) $('boot-bar').style.width = Math.round(frac * 100) + '%';
}

async function demoPhotoIds(progress) {
  const known = (await db.meta('demoAssets')) || {};
  const ids = [];
  for (let i = 0; i < DEMO_PHOTOS.length; i++) {
    const url = DEMO_PHOTOS[i];
    progress?.(i / DEMO_PHOTOS.length);
    let id = known[url];
    if (!id || !info(id)) {
      try { id = (await importImage(await fetchAsFile(url), 'photo')).id; known[url] = id; }
      catch (e) { console.warn('Demo photo missing', url, e); continue; }
    }
    ids.push(id);
  }
  await db.meta('demoAssets', known);
  return ids;
}

async function loadDemo() {
  const t = toast('Setting up the demo book…', { timeout: 60000 });
  const ids = await demoPhotoIds();
  const book = await createBook({ photos: ids });
  await openBook(book);
  t.remove();
  toast('Demo book ready — every page is editable');
}

// ---------- Actions ----------

const actions = {
  goTo(idx, elId) {
    editor.exitCrop();
    app.cur = clamp(idx, 0, app.book.items.length - 1);
    app.sel = elId || null;
    app.side = 0;
    if (elId) { const el = curItem().elements.find((e) => e.id === elId); if (el) app.side = sideOf(curItem(), el); }
    emit('nav');
  },
  moveItem(from, to) {
    const items = app.book.items;
    if (items[from]?.kind !== 'spread' || items[to]?.kind !== 'spread' || from === to) return;
    const [it] = items.splice(from, 1);
    items.splice(to > from ? to - 1 : to, 0, it);
    app.cur = items.indexOf(it);
    commit('book');
  },
  addSpread() {
    const items = app.book.items;
    const backIdx = items.findIndex((it) => it.kind === 'back');
    const at = clamp(app.cur + 1, 1, backIdx < 0 ? items.length : backIdx);
    items.splice(at, 0, newItem('spread'));
    app.cur = at;
    app.sel = null;
    commit('book');
  },
  deleteSpread: async () => {
    const it = curItem();
    if (it.kind !== 'spread') return;
    if (app.book.items.filter((x) => x.kind === 'spread').length <= 1) { toast('A book needs at least one spread'); return; }
    app.book.items.splice(app.cur, 1);
    app.cur = Math.min(app.cur, app.book.items.length - 1);
    app.sel = null;
    commit('book');
    toast('Spread deleted', { action: undo });
  },
  duplicateSpread() {
    const it = curItem();
    if (it.kind !== 'spread') return;
    const c = clone(it);
    c.id = uid('i');
    c.elements.forEach((e) => { e.id = uid('e'); });
    app.book.items.splice(app.cur + 1, 0, c);
    app.cur++;
    commit('book');
  },
  addElement(type) {
    const item = curItem();
    const spread = item.kind === 'spread';
    const pw = spread ? 0.5 : 1;
    const px = spread ? app.side * 0.5 : 0;
    const base = {
      image: { w: 0.6, h: 0.6 },
      text: { w: 0.7, h: 0.14, text: '', placeholder: 'Type something', size: 9 },
      shape: { w: 0.3, h: 0.3, shape: 'blob' },
      logo: { w: 0.3, h: 0.3, logo: '@mark' },
    }[type];
    const el = makeElement(type, { ...base, w: base.w * pw, x: px + (pw - base.w * pw) / 2, y: (1 - base.h) / 2 });
    item.elements.push(el);
    app.sel = el.id;
    commit('element');
    if (type === 'text') setTimeout(() => editor.startTextEdit(el.id), 30);
  },
  applyTemplate(tpl) {
    const item = curItem();
    const side = item.kind === 'spread' && tpl.scope === 'page' ? app.side : undefined;
    if (item.kind === 'spread' && tpl.scope === 'page' && isDoubleSpread(item)) {
      // Turning a double spread back into two pages: re-lay both sides.
      const photos = item.elements.filter((e) => e.type === 'image' && e.asset).map((e) => e.asset);
      item.elements = [];
      item.tpl = [null, null];
      const blank = app.templates.find((t) => t.id === 'page-blank');
      if (blank) applyTemplate(app.book, item, blank, 1 - app.side);
      applyTemplate(app.book, item, tpl, app.side);
      item.elements.filter((e) => e.type === 'image').forEach((e, i) => { e.asset = photos[i] || null; });
    } else {
      const left = applyTemplate(app.book, item, tpl, side);
      if (left.length) toast(`${left.length} photo${left.length > 1 ? 's' : ''} no longer on this page — still in Photos`);
    }
    app.sel = null;
    commit('page');
  },
  shuffle() {
    const item = curItem();
    const side = item.kind === 'spread' ? app.side : 0;
    const whole = item.kind !== 'spread' || isDoubleSpread(item);
    const scope = item.kind === 'cover' ? 'cover' : item.kind === 'back' ? 'back' : whole ? 'spread' : 'page';
    const onPage = item.elements.filter((e) => e.type === 'image' && (whole || sideOf(item, e) === side));
    const n = onPage.length;
    const pool = app.templates.filter((t) => t.scope === scope && t.elements.filter((e) => e.type === 'image').length === n && (n > 0 || scope !== 'page' || !(t.tags || []).includes('title')));
    if (pool.length < 2 && !(pool.length === 1 && pool[0].id !== item.tpl?.[whole ? 0 : side])) { toast('No other layouts with this many photos'); return; }
    const curId = item.tpl?.[whole ? 0 : side];
    const next = pool[(pool.findIndex((t) => t.id === curId) + 1) % pool.length];
    applyTemplate(app.book, item, next, whole ? undefined : side);
    app.sel = null;
    commit('page');
  },
  duplicate() {
    const el = selected();
    if (!el) return;
    const c = { ...clone(el), id: uid('e'), x: el.x + 3 / (app.book.spec.trimW * (curItem().kind === 'spread' ? 2 : 1)), y: el.y + 3 / app.book.spec.trimH };
    curItem().elements.push(c);
    app.sel = c.id;
    commit('element');
  },
  remove() {
    const item = curItem();
    const i = item.elements.findIndex((e) => e.id === app.sel);
    if (i < 0) return;
    item.elements.splice(i, 1);
    app.sel = null;
    commit('element');
  },
  layer(d) {
    const els = curItem().elements;
    const i = els.findIndex((e) => e.id === app.sel);
    const j = clamp(i + d, 0, els.length - 1);
    if (i < 0 || i === j) return;
    els.splice(j, 0, els.splice(i, 1)[0]);
    commit('element');
  },
  fillPage() {
    const el = selected(); const item = curItem();
    if (!el) return;
    const spread = item.kind === 'spread';
    Object.assign(el, { x: spread ? sideOf(item, el) * 0.5 : 0, y: 0, w: spread ? 0.5 : 1, h: 1, rot: 0 });
    commit('element');
  },
  fillSpread() {
    const el = selected();
    if (!el) return;
    Object.assign(el, { x: 0, y: 0, w: 1, h: 1, rot: 0 });
    commit('element');
  },
  centre() {
    const el = selected(); const item = curItem();
    if (!el) return;
    const spread = item.kind === 'spread';
    const px = spread ? sideOf(item, el) * 0.5 : 0, pw = spread ? 0.5 : 1;
    el.x = px + (pw - el.w) / 2;
    el.y = (1 - el.h) / 2;
    commit('element');
  },
  pickPhotoFor(el) {
    const grid = h('div.photo-grid', { style: { width: '300px' } }, app.book.photos.map((id) => {
      const img = h('img', { alt: info(id)?.name || '' });
      thumbURL(id).then((u) => { img.src = u; });
      return h('div.photo', { on: { click: () => { el.asset = id; el.cx = 0.5; el.cy = 0.5; el.zoom = 1; closePopover(); commit('element'); } } }, img);
    }));
    popover($('inspector'), h('div', h('div.panel-title', 'Choose a photo', h('button.txt-btn.small', { on: { click: async () => { closePopover(); const files = await pickFiles(); handleFiles(files, { target: el.id }); } } }, 'From computer')), grid));
  },
  photoClicked(id) {
    const el = selected();
    if (el && el.type === 'image') { el.asset = id; el.cx = 0.5; el.cy = 0.5; el.zoom = 1; commit('element'); return; }
    // Otherwise jump to where it's used.
    const idx = app.book.items.findIndex((it) => it.elements.some((e) => e.asset === id));
    if (idx >= 0) actions.goTo(idx, app.book.items[idx].elements.find((e) => e.asset === id).id);
    else toast('Drag it onto a frame, or use “Lay out unplaced”');
  },
  async addPhotos() { handleFiles(await pickFiles({ accept: 'image/*', multiple: true })); },
  async removePhoto(id) {
    const n = usageMap(app.book).get(id) || 0;
    if (n && !(await confirmDialog('Remove photo', `This photo is used ${n} time${n > 1 ? 's' : ''}. Remove it from the book and leave those frames empty?`, 'Remove', { danger: true }))) return;
    app.book.photos = app.book.photos.filter((x) => x !== id);
    for (const it of app.book.items) for (const e of it.elements) if (e.asset === id) e.asset = null;
    commit('book');
  },
  layoutUnused() {
    const used = usageMap(app.book);
    const unused = app.book.photos.filter((id) => !used.has(id));
    addSpreadsFor(unused);
  },
  redesign(message = 'Book re-designed from all photos') {
    const items = app.book.items;
    const cover = items.find((i) => i.kind === 'cover');
    const back = items.find((i) => i.kind === 'back');
    app.book.items = autoLayout(app.book, app.templates, app.book.photos, { coverTemplate: cover?.tpl?.[0], backTemplate: back?.tpl?.[0] });
    app.cur = 0; app.sel = null;
    commit('book');
    toast(typeof message === 'string' ? message : 'Book re-designed from all photos', { action: undo });
  },
};

function addSpreadsFor(ids) {
  if (!ids.length) return;
  const spreads = layoutMore(app.book, app.templates, ids);
  const items = app.book.items;
  // New spreads go before the closing spread (colophon / inside back cover).
  let at = items.findIndex((it) => it.kind === 'back');
  const lastSpread = at - 1;
  if (items[lastSpread]?.kind === 'spread' && items.filter((i) => i.kind === 'spread').length > 1) at = lastSpread;
  items.splice(at, 0, ...spreads);
  app.cur = at;
  app.sel = null;
  commit('book');
  toast(`Laid out ${ids.length} photo${ids.length > 1 ? 's' : ''} on ${spreads.length} new spread${spreads.length > 1 ? 's' : ''}`, { action: undo });
}

async function handleFiles(files, { target } = {}) {
  if (!files?.length) return;
  const backups = files.filter((f) => /\.photobook$/i.test(f.name));
  const fonts = files.filter((f) => /\.(otf|ttf|woff2?)$/i.test(f.name));
  const images = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|avif|gif|tiff?)$/i.test(f.name));
  for (const b of backups) { try { await openBook(await restoreBackup(b)); toast('Backup restored'); } catch (e) { toast(e.message, { error: true }); } }
  if (fonts.length) await addFontFiles(fonts);
  if (!images.length) return;
  const t = toast(`Importing ${images.length} photo${images.length > 1 ? 's' : ''}…`, { timeout: 600000 });
  const ids = [];
  for (const [i, f] of images.entries()) {
    t.firstChild.textContent = `Importing ${i + 1} of ${images.length}…`;
    try { ids.push((await importImage(f, 'photo')).id); }
    catch (e) { console.warn(e); toast(`Couldn't read ${f.name} — is it an image this browser supports?`, { error: true }); }
  }
  t.remove();
  if (!ids.length) return;
  const book = app.book;
  const firstPhotos = book.photos.length === 0;
  book.photos.push(...ids.filter((id) => !book.photos.includes(id)));
  let rest = ids;
  if (target) {
    const el = curItem().elements.find((e) => e.id === target);
    if (el) { el.asset = ids[0]; el.cx = 0.5; el.cy = 0.5; el.zoom = 1; app.sel = el.id; rest = ids.slice(1); }
  }
  if (!rest.length) { commit('book'); return; }
  if (firstPhotos && !target) {
    actions.redesign(`Designed a book from ${ids.length} photo${ids.length > 1 ? 's' : ''}`);
  } else addSpreadsFor(rest);
}

// ---------- UI refresh ----------

function refresh(what) {
  if (!app.book) return;
  if (flip) return;
  const full = !['live', 'selection', 'side', 'saving', 'saved', 'thumbs', 'crop', 'zoom', 'templates'].includes(what);
  if (what === 'saving' || what === 'saved') return updateSaveState();
  if (what === 'live') { editor.requestRender(); return; }
  if (what === 'thumbs') { renderFilmstrip($('filmstrip'), actions); return; }
  if (full || what === 'selection' || what === 'crop') renderInspector($('inspector'), editor, actions);
  if (full || what === 'side' || what === 'zoom') renderPagebar($('pagebar'), editor, actions);
  if (full) {
    if (document.activeElement !== $('book-title')) $('book-title').value = app.book.meta.title;
    document.title = `${app.book.meta.title} — Photobook`;
    renderFilmstrip($('filmstrip'), actions);
    if (!$('tray').hidden) renderTray($('tray'), actions);
    $('btn-undo').disabled = !canUndo();
    $('btn-redo').disabled = !canRedo();
  }
  if (what === 'design' || what === 'all') registerFonts(app.book.fontFiles).then(() => waitForFonts(fontFamilies())).then(() => { editor.requestRender(); renderFilmstrip($('filmstrip'), actions); });
  editor.requestRender();
}

const fontFamilies = () => [...new Set(Object.values(app.book.theme.fonts).flatMap((r) => [r.family, r.fallback]))];

function updateSaveState() {
  const f = folder.state === 'ready' && folder.last ? ' · backed up' : folder.state === 'needs-permission' ? ' · backup folder needs reconnecting' : folder.state === 'error' ? ' · backup folder error' : '';
  $('save-state').textContent = (app.saving ? 'Saving…' : app.lastSaved ? 'Saved on this device' : '') + f;
}

function setMode(preview) {
  $('mode-edit').setAttribute('aria-selected', String(!preview));
  $('mode-preview').setAttribute('aria-selected', String(preview));
  if (preview && !flip) {
    editor.exitCrop();
    editor.finishTextEdit();
    flip = openFlipbook($('preview'), app.book, app.cur, () => setMode(false));
  } else if (!preview && flip) {
    flip.close();
    flip = null;
    refresh('all');
  }
}

// ---------- Boot ----------

async function boot() {
  bootStatus('Opening your photobook…', 0.05);
  await loadAssetIndex();
  await loadTemplates();
  const id = await db.meta('currentBook');
  let book = id ? await db.get('books', id) : null;
  if (!book) {
    bootStatus('Preparing the demo book…', 0.1);
    const ids = await demoPhotoIds((f) => bootStatus('Preparing the demo book…', 0.1 + f * 0.8));
    book = await createBook({ photos: ids });
  }
  bootStatus('Loading fonts…', 0.92);
  await registerFonts(book.fontFiles);
  const fams = [...new Set(Object.values(book.theme.fonts).flatMap((r) => [r.family, r.fallback]))];
  await waitForFonts(fams);

  editor = createEditor({
    scroller: $('stage-scroll'), stage: $('stage'), canvas: $('stage-canvas'), overlay: $('overlay'),
    onFilesDropped: (files, opts) => handleFiles(files, opts),
  });
  on(refresh);
  on((what) => { if (what === 'nav' || what === 'all') editor.exitCrop(); });
  wireChrome();
  await openBook(book);
  bootStatus('Ready', 1);
  $('boot').remove();

  onSaved((b) => scheduleFolderSync(b));
  onFolder(updateSaveState);
  initFolder();
  requestPersistence();
}

function wireChrome() {
  $('btn-books').innerHTML = ICONS.menu;
  $('btn-undo').innerHTML = ICONS.undo;
  $('btn-redo').innerHTML = ICONS.redo;
  $('btn-undo').onclick = undo;
  $('btn-redo').onclick = redo;
  $('btn-books').onclick = (e) => openBooksMenu(e.currentTarget, { loadDemo, openDesign });
  $('btn-design').onclick = () => openDesign();
  $('btn-export').onclick = () => { setMode(false); openExport({ goTo: actions.goTo }); };
  $('btn-photos').onclick = () => {
    const tray = $('tray');
    tray.hidden = !tray.hidden;
    $('btn-photos').setAttribute('aria-pressed', String(!tray.hidden));
    if (!tray.hidden) renderTray(tray, actions);
  };
  $('mode-edit').onclick = () => setMode(false);
  $('mode-preview').onclick = () => setMode(true);
  const title = $('book-title');
  title.addEventListener('change', () => { app.book.meta.title = title.value.trim() || 'Untitled'; commit('design'); });
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') title.blur(); });

  // Files dropped anywhere in the window.
  let depth = 0;
  const veil = $('dropveil');
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { depth++; veil.hidden = false; } });
  window.addEventListener('dragleave', (e) => { if (hasFiles(e) && --depth <= 0) { depth = 0; veil.hidden = true; } });
  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    veil.hidden = !!e.target.closest?.('#stage'); // frames light up instead
  });
  window.addEventListener('drop', (e) => {
    depth = 0; veil.hidden = true;
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (flip) setMode(false);
    handleFiles([...e.dataTransfer.files]);
  });
  document.addEventListener('dragend', () => { depth = 0; veil.hidden = true; });
  window.addEventListener('paste', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) handleFiles(files);
  });

  // Spread context menu on the filmstrip
  $('filmstrip').addEventListener('contextmenu', (e) => {
    const t = e.target.closest('.thumb');
    if (!t) return;
    e.preventDefault();
    t.click();
    if (curItem().kind !== 'spread') return;
    popover(t, h('div',
      h('button.menu-item', { on: { click: () => { closePopover(); actions.duplicateSpread(); } } }, 'Duplicate spread'),
      h('button.menu-item', { on: { click: () => { closePopover(); actions.addSpread(); } } }, 'Add spread after'),
      h('button.menu-item', { on: { click: () => { closePopover(); actions.deleteSpread(); } } }, 'Delete spread')), { place: 'above' });
  });

  window.addEventListener('keydown', onKey);
}

let nudgeTimer;
function onKey(e) {
  if (flip) return;
  if (document.querySelector('.modal-back')) return;
  const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { if (typing) return; e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { if (typing) return; e.preventDefault(); redo(); return; }
  if (typing) return;
  const el = selected();
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); actions.duplicate(); return; }
  if (e.key === 'Escape') {
    if (editor.cropping) editor.exitCrop();
    else if (app.sel) { app.sel = null; emit('selection'); }
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && el) { e.preventDefault(); actions.remove(); return; }
  if (e.key === 'Enter' && el) {
    if (el.type === 'text') editor.startTextEdit(el.id);
    else if (el.type === 'image' && el.asset) editor.enterCrop(el.id);
    e.preventDefault();
    return;
  }
  if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    if (el && !el.locked) {
      const step = e.shiftKey ? 5 : 0.5; // mm
      const W = app.book.spec.trimW * (curItem().kind === 'spread' ? 2 : 1), H = app.book.spec.trimH;
      if (e.key === 'ArrowLeft') el.x -= step / W;
      if (e.key === 'ArrowRight') el.x += step / W;
      if (e.key === 'ArrowUp') el.y -= step / H;
      if (e.key === 'ArrowDown') el.y += step / H;
      editor.requestRender();
      clearTimeout(nudgeTimer);
      nudgeTimer = setTimeout(() => commit('element'), 350);
    } else if (!el) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') actions.goTo(app.cur + 1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') actions.goTo(app.cur - 1);
    }
  }
  if (e.key === 'PageDown') actions.goTo(app.cur + 1);
  if (e.key === 'PageUp') actions.goTo(app.cur - 1);
}

boot().catch((e) => {
  console.error(e);
  bootStatus('Something went wrong opening the tool: ' + e.message);
});
