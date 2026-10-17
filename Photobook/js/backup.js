// Backups. Photos live in this browser's storage; these give you a copy
// outside it:
//   - a .photobook archive (a ZIP of the book, templates and original files)
//   - continuous backup into a folder you choose (Chromium browsers), updated
//     shortly after every change.

import { db } from './db.js';
import { ZipWriter, readZip } from './zip.js';
import { importImage, importFont, info, getBlob, loadAssetIndex } from './assets.js';
import { app, saveTemplate } from './state.js';
import { slugify, uid, clone, debounce } from './util.js';

const FORMAT = 'photobook-backup';

const extFor = (type, name) => (name && /\.[a-z0-9]{2,5}$/i.test(name) ? name.match(/\.[a-z0-9]{2,5}$/i)[0].toLowerCase() : type === 'image/png' ? '.png' : type?.includes('font') ? '.otf' : '.jpg');

export function bookAssetIds(book) {
  const ids = new Set(book.photos);
  for (const l of book.brand.logos) if (l.asset) ids.add(l.asset);
  for (const f of book.fontFiles) if (f.asset) ids.add(f.asset);
  for (const it of book.items) for (const el of it.elements) if (el.type === 'image' && el.asset) ids.add(el.asset);
  return [...ids];
}

function manifest(book) {
  const assets = bookAssetIds(book).map((id) => {
    const a = info(id);
    return a && { id, kind: a.kind, name: a.name, type: a.type, w: a.w, h: a.h, file: `files/${id}${extFor(a.type, a.name)}` };
  }).filter(Boolean);
  return { format: FORMAT, version: 1, savedAt: new Date().toISOString(), book, templates: app.templates.filter((t) => !t.builtin), assets };
}

export async function backupBlob(book, progress = () => {}) {
  const m = manifest(book);
  const zip = new ZipWriter();
  await zip.add('manifest.json', JSON.stringify(m, null, 1));
  let i = 0;
  for (const a of m.assets) {
    progress(++i, m.assets.length);
    const blob = await getBlob(a.id);
    if (blob) await zip.add(a.file, blob);
  }
  return zip.blob('application/zip');
}

export const backupName = (book) => `${slugify(book.meta.title)}-${new Date().toISOString().slice(0, 10)}.photobook`;

export async function restoreBackup(file, progress = () => {}) {
  const z = await readZip(file);
  const m = JSON.parse((await z.text('manifest.json')) || 'null');
  if (!m || m.format !== FORMAT) throw new Error('This file is not a Photobook backup.');
  let i = 0;
  for (const a of m.assets) {
    progress(++i, m.assets.length);
    if (info(a.id)) continue;
    const blob = await z.blob(a.file, a.type);
    if (!blob) continue;
    const f = new File([blob], a.name, { type: a.type });
    if (a.kind === 'font') await importFont(f, a.id);
    else await importImage(f, a.kind, a.id);
  }
  for (const t of m.templates || []) await saveTemplate(t);
  const book = clone(m.book);
  if (await db.get('books', book.id)) { book.id = uid('b_'); book.meta.title += ' (restored)'; }
  book.updatedAt = Date.now();
  await db.put('books', book);
  await loadAssetIndex();
  return book;
}

// ---------- Folder backup ----------

export const folderBackupSupported = () => typeof window.showDirectoryPicker === 'function';

export const folder = { handle: null, state: 'off', last: 0, error: '' }; // state: off | ready | needs-permission | writing | error
const folderListeners = new Set();
export const onFolder = (fn) => folderListeners.add(fn);
const folderEmit = () => folderListeners.forEach((fn) => fn(folder));

export async function initFolder() {
  folder.handle = (await db.meta('backupDir')) || null;
  if (!folder.handle) { folder.state = 'off'; return folderEmit(); }
  try {
    const p = await folder.handle.queryPermission({ mode: 'readwrite' });
    folder.state = p === 'granted' ? 'ready' : 'needs-permission';
  } catch { folder.state = 'needs-permission'; }
  folderEmit();
}

export async function chooseFolder() {
  folder.handle = await window.showDirectoryPicker({ id: 'photobook-backup', mode: 'readwrite' });
  await db.meta('backupDir', folder.handle);
  folder.state = 'ready';
  folderEmit();
  await syncFolder(app.book);
}

export async function reconnectFolder() {
  if (!folder.handle) return chooseFolder();
  const p = await folder.handle.requestPermission({ mode: 'readwrite' });
  folder.state = p === 'granted' ? 'ready' : 'needs-permission';
  folderEmit();
  if (folder.state === 'ready') await syncFolder(app.book);
}

export async function stopFolder() {
  await db.meta('backupDir', null);
  folder.handle = null;
  folder.state = 'off';
  folderEmit();
}

async function writeFile(dir, name, data) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

async function exists(dir, name) {
  try { await dir.getFileHandle(name); return true; } catch { return false; }
}

export async function syncFolder(book) {
  if (!book || !folder.handle || folder.state === 'needs-permission' || folder.state === 'off') return;
  folder.state = 'writing';
  folderEmit();
  try {
    const dir = await folder.handle.getDirectoryHandle(`${slugify(book.meta.title)}-${book.id.slice(-6)}`, { create: true });
    const files = await dir.getDirectoryHandle('files', { create: true });
    const m = manifest(book);
    for (const a of m.assets) {
      const name = a.file.slice('files/'.length);
      if (await exists(files, name)) continue;
      const blob = await getBlob(a.id);
      if (blob) await writeFile(files, name, blob);
    }
    await writeFile(dir, 'manifest.json', JSON.stringify(m, null, 1));
    folder.state = 'ready';
    folder.last = Date.now();
    folder.error = '';
  } catch (e) {
    folder.state = 'error';
    folder.error = e.message;
  }
  folderEmit();
}

export const scheduleFolderSync = debounce((book) => syncFolder(book), 4000);

// A backup folder can be restored by picking its manifest.json and files folder
// with restoreFromFolder (reads the same layout the sync writes).
export async function restoreFromFolder() {
  const dir = await window.showDirectoryPicker({ id: 'photobook-backup', mode: 'read' });
  const m = JSON.parse(await (await (await dir.getFileHandle('manifest.json')).getFile()).text());
  if (m.format !== FORMAT) throw new Error('No Photobook manifest in that folder.');
  const files = await dir.getDirectoryHandle('files');
  const zip = new ZipWriter();
  await zip.add('manifest.json', JSON.stringify(m));
  for (const a of m.assets) {
    try { await zip.add(a.file, await (await files.getFileHandle(a.file.slice(6))).getFile()); } catch { /* missing file: skipped */ }
  }
  return restoreBackup(zip.blob());
}
