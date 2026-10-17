// App state, undo history and autosave.

import { db } from './db.js';
import { uid, clone, debounce } from './util.js';
import { DEFAULT_SPEC, DEFAULT_META, DEFAULT_THEME, DEFAULT_FONT_FILES, DEFAULT_LOGOS, DEFAULT_LOGO_ROLES } from './defaults.js';
import { BUILTIN_TEMPLATES } from './templates.js';
import { importImage, fetchAsFile, info } from './assets.js';
import { autoLayout } from './layout.js';

export const app = {
  book: null,
  templates: [],
  cur: 0,          // index of the item (cover, spread, back) on the stage
  sel: null,       // selected element id
  side: 0,         // which page of a spread the page tools act on
  saving: false,
  lastSaved: 0,
};

const listeners = new Set();
export const on = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export function emit(what = 'all') { for (const fn of listeners) fn(what); }

// ---------- History ----------
const undoStack = [];
const redoStack = [];
let snapshot = null;
const HISTORY = 120;

function resetHistory() { undoStack.length = 0; redoStack.length = 0; snapshot = JSON.stringify(app.book); }

export function commit(what = 'book') {
  const now = JSON.stringify(app.book);
  if (now === snapshot) { emit(what); return; }
  undoStack.push(snapshot);
  if (undoStack.length > HISTORY) undoStack.shift();
  redoStack.length = 0;
  snapshot = now;
  app.book.updatedAt = Date.now();
  save();
  emit(what);
}

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot);
  snapshot = undoStack.pop();
  app.book = JSON.parse(snapshot);
  fixCursor();
  save();
  emit('all');
}

export function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot);
  snapshot = redoStack.pop();
  app.book = JSON.parse(snapshot);
  fixCursor();
  save();
  emit('all');
}

export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;

function fixCursor() {
  app.cur = Math.min(app.cur, app.book.items.length - 1);
  if (app.sel && !curItem()?.elements.some((e) => e.id === app.sel)) app.sel = null;
}

// ---------- Persistence ----------
const saveHooks = new Set();
export const onSaved = (fn) => saveHooks.add(fn);

export const save = debounce(async () => {
  if (!app.book) return;
  app.saving = true;
  emit('saving');
  await db.put('books', app.book);
  await db.meta('currentBook', app.book.id);
  app.saving = false;
  app.lastSaved = Date.now();
  emit('saved');
  for (const fn of saveHooks) fn(app.book);
}, 350);

export async function loadTemplates() {
  if (!(await db.meta('templatesSeeded'))) {
    await db.putMany('templates', BUILTIN_TEMPLATES.map((t, i) => ({ ...clone(t), builtin: true, order: i })));
    await db.meta('templatesSeeded', true);
  }
  app.templates = (await db.all('templates')).sort((a, b) => (a.order ?? 1e6) - (b.order ?? 1e6) || a.name.localeCompare(b.name));
}

export async function saveTemplate(tpl) {
  if (tpl.order == null) tpl.order = 1000 + app.templates.length;
  await db.put('templates', tpl);
  await loadTemplates();
  emit('templates');
}

export async function deleteTemplate(id) {
  await db.del('templates', id);
  await loadTemplates();
  emit('templates');
}

export async function restoreDefaultTemplates() {
  await db.putMany('templates', BUILTIN_TEMPLATES.map((t, i) => ({ ...clone(t), builtin: true, order: i })));
  await loadTemplates();
  emit('templates');
}

// ---------- Books ----------
export const curItem = () => app.book?.items[app.cur];
export const selected = () => curItem()?.elements.find((e) => e.id === app.sel) || null;

async function defaultLogos() {
  // Logos are imported once per device and shared by new books.
  const known = (await db.meta('defaultLogoAssets')) || {};
  const logos = [];
  for (const l of DEFAULT_LOGOS) {
    let asset = known[l.key];
    if (!asset || !info(asset)) {
      try { asset = (await importImage(await fetchAsFile(l.url), 'logo')).id; known[l.key] = asset; }
      catch (e) { console.warn('Logo not found', l.url, e); continue; }
    }
    logos.push({ key: l.key, name: l.name, asset });
  }
  await db.meta('defaultLogoAssets', known);
  return logos;
}

export async function createBook({ photos = [], title } = {}) {
  const book = {
    id: uid('b_'),
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    meta: { ...clone(DEFAULT_META), ...(title ? { title } : {}) },
    spec: clone(DEFAULT_SPEC),
    theme: clone(DEFAULT_THEME),
    brand: { logos: await defaultLogos(), roles: clone(DEFAULT_LOGO_ROLES) },
    fontFiles: DEFAULT_FONT_FILES.map((f) => ({ id: uid('ff'), ...f })),
    photos: [...photos],
    items: [],
  };
  book.items = autoLayout(book, app.templates, photos);
  await db.put('books', book);
  return book;
}

export async function openBook(book) {
  app.book = book;
  app.cur = 0;
  app.sel = null;
  app.side = 0;
  resetHistory();
  await db.meta('currentBook', book.id);
  emit('all');
}

export async function listBooks() {
  return (await db.all('books')).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteBook(id) {
  await db.del('books', id);
}

export function replaceBook(book) {
  app.book = book;
  fixCursor();
  resetHistory();
  save();
  emit('all');
}

export async function duplicateBook(book) {
  const copy = clone(book);
  copy.id = uid('b_');
  copy.meta.title = book.meta.title + ' (copy)';
  copy.createdAt = copy.updatedAt = Date.now();
  await db.put('books', copy);
  return copy;
}
