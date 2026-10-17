// Photos, logos and fonts. Originals are stored untouched in IndexedDB; the
// editor draws from a smaller preview and exports read the original.

import { db } from './db.js';
import { uid, canvasToBlob } from './util.js';

const PREVIEW_PX = 2000;
const THUMB_PX = 360;

const cache = new Map();      // `${id}:${quality}` -> ImageBitmap
const pending = new Map();    // same key -> Promise<ImageBitmap>
const records = new Map();    // id -> record without blobs (w, h, name…)

async function scaled(bitmap, maxPx, type, quality) {
  const s = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * s));
  const hgt = Math.max(1, Math.round(bitmap.height * s));
  const c = new OffscreenCanvasOr(w, hgt);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, hgt);
  return c.convertToBlob ? c.convertToBlob({ type, quality }) : canvasToBlob(c, type, quality);
}

function OffscreenCanvasOr(w, hgt) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, hgt);
  const c = document.createElement('canvas');
  c.width = w; c.height = hgt;
  return c;
}

export async function importImage(file, kind = 'photo', id = null) {
  const bitmap = await createImageBitmap(file);
  const alpha = kind === 'logo' || /png|webp|gif|svg/.test(file.type);
  const type = alpha ? 'image/png' : 'image/jpeg';
  const rec = {
    id: id || uid(kind[0] + '_'),
    kind,
    name: file.name || 'image',
    type: file.type || 'image/jpeg',
    size: file.size,
    w: bitmap.width,
    h: bitmap.height,
    blob: file,
    preview: bitmap.width > PREVIEW_PX || bitmap.height > PREVIEW_PX ? await scaled(bitmap, PREVIEW_PX, type, 0.9) : null,
    thumb: await scaled(bitmap, THUMB_PX, type, 0.82),
    addedAt: Date.now(),
  };
  bitmap.close?.();
  await db.put('assets', rec);
  remember(rec);
  return info(rec.id);
}

export async function importFont(file, id = null) {
  const rec = { id: id || uid('f_'), kind: 'font', name: file.name, type: file.type || 'font/otf', size: file.size, blob: file, addedAt: Date.now() };
  await db.put('assets', rec);
  remember(rec);
  return rec.id;
}

function remember(rec) {
  const { blob, preview, thumb, ...meta } = rec;
  records.set(rec.id, meta);
}

export async function loadAssetIndex() {
  records.clear();
  for (const rec of await db.all('assets')) remember(rec);
}

export const info = (id) => records.get(id) || null;
export const allAssets = () => [...records.values()];

export async function getBlob(id, which = 'blob') {
  const rec = await db.get('assets', id);
  if (!rec) return null;
  return (which === 'preview' && (rec.preview || rec.blob)) || (which === 'thumb' && (rec.thumb || rec.preview || rec.blob)) || rec.blob;
}

// Returns a cached bitmap synchronously, or null and starts loading it.
export function peek(id, quality = 'preview') {
  return cache.get(id + ':' + quality) || null;
}

export function load(id, quality = 'preview') {
  const key = id + ':' + quality;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (pending.has(key)) return pending.get(key);
  const p = (async () => {
    const blob = await getBlob(id, quality === 'full' ? 'blob' : quality);
    if (!blob) return null;
    const bm = await createImageBitmap(blob);
    cache.set(key, bm);
    return bm;
  })().catch((e) => { console.warn('Could not load image', id, e); return null; }).finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

export function release(id, quality) {
  const key = id + ':' + quality;
  cache.get(key)?.close?.();
  cache.delete(key);
}

export async function deleteAsset(id) {
  for (const q of ['preview', 'thumb', 'full']) release(id, q);
  records.delete(id);
  await db.del('assets', id);
}

const urlCache = new Map();
export async function thumbURL(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const b = await getBlob(id, 'thumb');
  if (!b) return '';
  const u = URL.createObjectURL(b);
  urlCache.set(id, u);
  return u;
}

export async function fetchAsFile(url, name) {
  // The single-file build (dist/photobook.html) carries its logos and demo
  // photos inline as data: URLs, keyed by their usual path.
  const r = await fetch(globalThis.PHOTOBOOK_EMBEDDED?.[url] || url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const b = await r.blob();
  return new File([b], name || url.split('/').pop(), { type: b.type });
}

// ---------- Fonts ----------

const fontState = new Map(); // family|weight|style|source -> 'ok' | 'missing'

export async function registerFonts(fontFiles) {
  const jobs = fontFiles.map(async (f) => {
    const key = `${f.family}|${f.weight}|${f.style}|${f.asset || f.url}`;
    if (fontState.has(key)) return; // loaded, or already known to be missing
    try {
      let src;
      if (f.asset) src = await (await getBlob(f.asset)).arrayBuffer();
      else {
        const r = await fetch(f.url);
        if (!r.ok) throw new Error(r.status);
        src = await r.arrayBuffer();
      }
      const face = new FontFace(f.family, src, { weight: String(f.weight), style: f.style });
      await face.load();
      document.fonts.add(face);
      fontState.set(key, 'ok');
    } catch {
      fontState.set(key, 'missing');
    }
  });
  await Promise.all(jobs);
}

export const fontStatus = (f) => fontState.get(`${f.family}|${f.weight}|${f.style}|${f.asset || f.url}`) || 'loading';
export const familyLoaded = (family) => [...fontState.entries()].some(([k, v]) => k.startsWith(family + '|') && v === 'ok');

export async function waitForFonts(families) {
  try {
    await Promise.all(families.flatMap((fam) => [400, 700].map((w) => document.fonts.load(`${w} 24px "${fam}"`))));
    await document.fonts.ready;
  } catch { /* fonts are best-effort; the fallback still renders */ }
}
