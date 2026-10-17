// Print-ready export: high-resolution JPGs (with DPI written into the file)
// and a PDF with TrimBox/BleedBox and optional crop marks. Everything is
// rendered from the original photo files at the chosen resolution.

import { renderItem, itemSize, itemAssets, makeCanvas, pageNumbersFor, elementRect, effectiveDpi, resolveText, color, fontStack, sideOf, pagesIn } from './render.js';
import { load, release, info, familyLoaded } from './assets.js';
import { canvasToBlob, slugify, MM_PER_PT, nextFrame } from './util.js';
import { ZipWriter } from './zip.js';

const PT_PER_MM = 72 / 25.4;

// ---------- Reading order ----------

export function readingPages(book) {
  const out = [];
  const spreads = book.items.filter((it) => it.kind === 'spread').length;
  let s = 0;
  book.items.forEach((item, idx) => {
    if (item.kind === 'cover') out.push({ idx, side: 0, label: 'Front cover', short: 'cover' });
    else if (item.kind === 'back') out.push({ idx, side: 0, label: 'Back cover', short: 'back' });
    else {
      const [l, r] = pageNumbersFor(book, idx);
      out.push({ idx, side: 0, label: s === 0 ? 'Inside front cover' : `Page ${l}`, short: s === 0 ? 'inside-front' : `p${l.padStart(3, '0')}` });
      out.push({ idx, side: 1, label: s === spreads - 1 ? 'Inside back cover' : `Page ${r}`, short: s === spreads - 1 ? 'inside-back' : `p${r.padStart(3, '0')}` });
      s++;
    }
  });
  return out;
}

export function itemLabel(book, idx) {
  const it = book.items[idx];
  if (it.kind === 'cover') return 'Front cover';
  if (it.kind === 'back') return 'Back cover';
  const [l, r] = pageNumbersFor(book, idx);
  const spreads = book.items.filter((x) => x.kind === 'spread');
  const s = spreads.indexOf(it);
  const left = s === 0 ? 'Inside cover' : l;
  const right = s === spreads.length - 1 ? 'Inside cover' : r;
  return `${left} – ${right}`;
}

// ---------- Rendering at print resolution ----------

// Render an item, or one page of a spread (side 0/1), with bleed on every edge.
async function renderFull(book, idx, scale, side = null) {
  const item = book.items[idx];
  const ids = itemAssets(book, item);
  await Promise.all(ids.map((id) => load(id, 'full')));
  const { w, h } = itemSize(book, item);
  const b = book.spec.bleed;
  const single = side != null && item.kind === 'spread';
  const c = makeCanvas(((single ? book.spec.trimW : w) + 2 * b) * scale, (h + 2 * b) * scale);
  const ctx = c.getContext('2d');
  if (single) ctx.translate(-side * book.spec.trimW * scale, 0);
  renderItem(ctx, book, item, { scale, bleed: true, quality: 'full', pageNumbers: pageNumbersFor(book, idx), onlySide: single ? side : null });
  return c;
}

function releaseFull(book, item) {
  for (const id of itemAssets(book, item)) if (info(id)?.kind === 'photo') release(id, 'full');
}

// Back cover + spine + front cover in one piece, for printers that want a cover wrap.
export async function renderCoverWrap(book, scale) {
  const { trimW, trimH, bleed: b, spine } = book.spec;
  const backIdx = book.items.findIndex((it) => it.kind === 'back');
  const frontIdx = book.items.findIndex((it) => it.kind === 'cover');
  const c = makeCanvas((2 * trimW + spine + 2 * b) * scale, (trimH + 2 * b) * scale);
  const ctx = c.getContext('2d');
  if (backIdx >= 0) {
    const bc = await renderFull(book, backIdx, scale);
    releaseFull(book, book.items[backIdx]);
    ctx.drawImage(bc, 0, 0, (b + trimW) * scale, bc.height, 0, 0, (b + trimW) * scale, bc.height);
  }
  if (frontIdx >= 0) {
    const fc = await renderFull(book, frontIdx, scale);
    releaseFull(book, book.items[frontIdx]);
    const sx = b * scale;
    ctx.drawImage(fc, sx, 0, fc.width - sx, fc.height, (b + trimW + spine) * scale, 0, fc.width - sx, fc.height);
  }
  // Spine
  const x0 = (b + trimW) * scale;
  ctx.fillStyle = color(book, book.spec.spineColor || '@ink');
  ctx.fillRect(x0, 0, spine * scale, c.height);
  const text = resolveText(book, book.spec.spineText || '');
  if (text.trim() && spine >= 3) {
    const px = Math.min(spine * 0.55, 7 * MM_PER_PT) * scale;
    ctx.save();
    ctx.translate(x0 + (spine * scale) / 2, (b + trimH / 2) * scale);
    ctx.rotate(Math.PI / 2);
    ctx.font = `400 ${px}px ${fontStack(book, '@display')}`;
    ctx.fillStyle = color(book, book.spec.spineTextColor || '@paper');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), 0, 0);
    ctx.restore();
  }
  return c;
}

// ---------- JPEG with real DPI ----------

export async function jpegWithDpi(canvas, quality, dpi) {
  const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const d = Math.round(dpi);
  const isJfif = bytes[2] === 0xff && bytes[3] === 0xe0 && String.fromCharCode(...bytes.subarray(6, 10)) === 'JFIF';
  if (isJfif) {
    bytes[13] = 1; // dots per inch
    bytes[14] = d >> 8; bytes[15] = d & 255;
    bytes[16] = d >> 8; bytes[17] = d & 255;
    return bytes;
  }
  const app0 = new Uint8Array([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, d >> 8, d & 255, d >> 8, d & 255, 0, 0]);
  const out = new Uint8Array(bytes.length + app0.length);
  out.set(bytes.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(bytes.subarray(2), 2 + app0.length);
  return out;
}

// ---------- PDF ----------

function pdfString(s) {
  let hex = 'FEFF';
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0);
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      hex += (0xd800 + (v >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0');
    } else hex += cp.toString(16).padStart(4, '0');
  }
  return `<${hex.toUpperCase()}>`;
}

const n2 = (v) => (Math.round(v * 1000) / 1000).toString();

function jpegSize(bytes) {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const m = bytes[i + 1];
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
      return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    i += 2 + len;
  }
  throw new Error('Could not read JPEG size');
}

export class PdfWriter {
  constructor(meta = {}) {
    this.parts = [];
    this.offsets = [];
    this.size = 0;
    this.pageIds = [];
    this.meta = meta;
    this.nextId = 4; // 1 catalog, 2 pages, 3 info
    this.push('%PDF-1.6\n%\xE2\xE3\xCF\xD3\n');
  }

  push(x) {
    if (typeof x === 'string') {
      const b = new Uint8Array(x.length);
      for (let i = 0; i < x.length; i++) b[i] = x.charCodeAt(i) & 255;
      x = b;
    }
    this.parts.push(x);
    this.size += x.length;
  }

  obj(id, body, stream) {
    this.offsets[id] = this.size;
    if (stream) {
      this.push(`${id} 0 obj\n${body}\nstream\n`);
      this.push(stream);
      this.push('\nendstream\nendobj\n');
    } else this.push(`${id} 0 obj\n${body}\nendobj\n`);
  }

  /**
   * Add one page: a JPEG covering trim + bleed, with boxes and optional crop marks.
   * All sizes in mm.
   */
  addPage({ jpeg, trimW, trimH, bleed, marks, markOffset = 3, markLength = 5 }) {
    const { w: pw, h: ph } = jpegSize(jpeg);
    const m = marks ? bleed + markOffset + markLength + 1 : bleed; // media margin outside the trim
    const W = (trimW + 2 * m) * PT_PER_MM;
    const H = (trimH + 2 * m) * PT_PER_MM;
    const tx = m * PT_PER_MM, ty = m * PT_PER_MM, tw = trimW * PT_PER_MM, th = trimH * PT_PER_MM;
    const b = bleed * PT_PER_MM;
    let content = `q\n${n2(tw + 2 * b)} 0 0 ${n2(th + 2 * b)} ${n2(tx - b)} ${n2(ty - b)} cm\n/Im0 Do\nQ\n`;
    if (marks) {
      const d1 = (bleed + markOffset) * PT_PER_MM;
      const d2 = d1 + markLength * PT_PER_MM;
      const L = [];
      for (const [x, sx] of [[tx, -1], [tx + tw, 1]]) {
        for (const [y, sy] of [[ty, -1], [ty + th, 1]]) {
          L.push(`${n2(x + sx * d1)} ${n2(y)} m ${n2(x + sx * d2)} ${n2(y)} l S`); // horizontal mark on the trim line
          L.push(`${n2(x)} ${n2(y + sy * d1)} m ${n2(x)} ${n2(y + sy * d2)} l S`); // vertical mark
        }
      }
      content += `q\n0.25 w\n1 1 1 1 K\n${L.join('\n')}\nQ\n`;
    }
    const img = this.nextId++, cont = this.nextId++, page = this.nextId++;
    this.obj(img, `<< /Type /XObject /Subtype /Image /Width ${pw} /Height ${ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
    const cbytes = new TextEncoder().encode(content);
    this.obj(cont, `<< /Length ${cbytes.length} >>`, cbytes);
    this.obj(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(W)} ${n2(H)}] /BleedBox [${n2(tx - b)} ${n2(ty - b)} ${n2(tx + tw + b)} ${n2(ty + th + b)}] /TrimBox [${n2(tx)} ${n2(ty)} ${n2(tx + tw)} ${n2(ty + th)}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${cont} 0 R >>`);
    this.pageIds.push(page);
  }

  blob() {
    this.obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    this.obj(2, `<< /Type /Pages /Kids [${this.pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${this.pageIds.length} >>`);
    const d = new Date();
    const pad = (x) => String(x).padStart(2, '0');
    const date = `D:${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    this.obj(3, `<< /Title ${pdfString(this.meta.title || '')} /Author ${pdfString(this.meta.author || '')} /Creator ${pdfString('Photobook')} /Producer ${pdfString('Photobook')} /CreationDate (${date}) >>`);
    const xref = this.size;
    const count = this.nextId;
    let x = `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (let i = 1; i < count; i++) x += `${String(this.offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`;
    x += `trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    this.push(x);
    return new Blob(this.parts, { type: 'application/pdf' });
  }
}

// ---------- Preflight ----------

export function preflight(book) {
  const issues = [];
  const { safe, minDpi, trimW } = book.spec;
  book.items.forEach((item, idx) => {
    const where = itemLabel(book, idx);
    const { w: W, h: H } = itemSize(book, item);
    for (const el of item.elements) {
      if (el.hidden) continue;
      if (el.type === 'image') {
        if (!el.asset) { issues.push({ level: 'warn', idx, el: el.id, msg: `${where}: empty photo frame (prints as background colour)` }); continue; }
        const inf = info(el.asset);
        const dpi = effectiveDpi(book, item, el, inf);
        if (dpi < minDpi) issues.push({ level: 'warn', idx, el: el.id, msg: `${where}: “${inf?.name || 'photo'}” is ${Math.round(dpi)} dpi at this size (aim for ${minDpi})` });
      }
      if (el.type === 'text') {
        const text = resolveText(book, el.text);
        if (!text.trim()) continue;
        if (/\{\w+\}/.test(text)) issues.push({ level: 'info', idx, el: el.id, msg: `${where}: text has an unfilled field ${text.match(/\{\w+\}/)[0]}` });
        const r = elementRect(book, item, el, false);
        const px0 = sideOf(item, el) * trimW;
        if (r.x < px0 + safe - 0.01 || r.y < safe - 0.01 || r.x + r.w > px0 + trimW - safe + 0.01 || r.y + r.h > H - safe + 0.01) {
          if (!(item.kind === 'spread' && r.x < W / 2 && r.x + r.w > W / 2)) issues.push({ level: 'warn', idx, el: el.id, msg: `${where}: text box reaches outside the ${safe} mm safe area` });
        }
        if (item.kind === 'spread' && r.x < W / 2 - 1 && r.x + r.w > W / 2 + 1) issues.push({ level: 'warn', idx, el: el.id, msg: `${where}: text crosses the gutter and may be lost in the binding` });
      }
    }
  });
  for (const role of Object.values(book.theme.fonts)) {
    if (!familyLoaded(role.family)) issues.push({ level: 'info', msg: `Font “${role.family}” isn't installed in the tool — text uses ${role.fallback}. Add the font file under Book & theme → Fonts.` });
  }
  const interior = readingPages(book).length - 4;
  const mult = book.spec.pageMultiple | 0;
  if (mult > 1 && interior % mult) issues.push({ level: 'warn', msg: `${interior} interior pages — your printer wants a multiple of ${mult}.` });
  return issues;
}

// ---------- Export runs ----------

/**
 * opts: { format: 'pdf'|'jpg', dpi, quality, layout: 'pages'|'spreads', marks, wrap, only: itemIndex|null }
 * progress(done, total, label); isCancelled() -> bool
 */
export async function exportBook(book, opts, progress = () => {}, isCancelled = () => false) {
  const scale = opts.dpi / 25.4;
  const { trimW, trimH, bleed, markOffset, markLength } = book.spec;
  const slug = slugify(book.meta.title);
  const indices = opts.only != null ? [opts.only] : book.items.map((_, i) => i);
  const total = indices.length + (opts.wrap ? 1 : 0);
  const pdf = opts.format === 'pdf' ? new PdfWriter({ title: book.meta.title, author: book.meta.author }) : null;
  const zip = opts.format === 'jpg' ? new ZipWriter() : null;
  const files = [];
  const pages = readingPages(book);
  let done = 0;

  for (const idx of indices) {
    if (isCancelled()) throw new Error('cancelled');
    const item = book.items[idx];
    progress(done, total, itemLabel(book, idx));
    await nextFrame();
    const sides = item.kind === 'spread' && opts.layout !== 'spreads' ? [0, 1] : [null];
    for (const side of sides) {
      const pageCanvas = await renderFull(book, idx, scale, side);
      const jpeg = await jpegWithDpi(pageCanvas, opts.quality, opts.dpi);
      const pagesWide = side == null ? pagesIn(item) : 1;
      const ref = pages.find((p) => p.idx === idx && (side == null ? true : p.side === side));
      const name = side == null && item.kind === 'spread'
        ? `${slug}-spread-${String(book.items.slice(0, idx).filter((x) => x.kind === 'spread').length + 1).padStart(2, '0')}.jpg`
        : `${slug}-${String(pages.indexOf(ref) + 1).padStart(2, '0')}-${ref.short}.jpg`;
      if (pdf) pdf.addPage({ jpeg, trimW: trimW * pagesWide, trimH, bleed, marks: opts.marks, markOffset, markLength });
      if (zip) await zip.add(name, jpeg);
      files.push(name);
      pageCanvas.width = pageCanvas.height = 0;
    }
    releaseFull(book, item);
    done++;
  }

  let wrapBlob = null;
  if (opts.wrap) {
    progress(done, total, 'Cover wrap');
    await nextFrame();
    const wc = await renderCoverWrap(book, scale);
    const jpeg = await jpegWithDpi(wc, opts.quality, opts.dpi);
    if (zip) await zip.add(`${slug}-cover-wrap.jpg`, jpeg);
    if (pdf) {
      const w = new PdfWriter({ title: book.meta.title + ' — cover wrap', author: book.meta.author });
      w.addPage({ jpeg, trimW: 2 * trimW + book.spec.spine, trimH, bleed, marks: opts.marks, markOffset, markLength });
      wrapBlob = w.blob();
    }
    wc.width = wc.height = 0;
    done++;
  }
  progress(total, total, 'Finishing');

  if (zip) {
    const spec = [
      `${book.meta.title}`,
      `Trim ${trimW} × ${trimH} mm, bleed ${bleed} mm on every edge (files are ${trimW + 2 * bleed} × ${trimH + 2 * bleed} mm per page).`,
      `${opts.dpi} dpi, sRGB JPEG, quality ${Math.round(opts.quality * 100)}.`,
      opts.layout === 'spreads' ? 'Interior pages are exported as two-page spreads.' : 'One file per page, in reading order.',
      opts.wrap ? `Cover wrap: back + ${book.spec.spine} mm spine + front.` : '',
      '',
      ...files,
    ].filter((l) => l !== null).join('\n');
    await zip.add('README.txt', spec);
    return { main: zip.blob(), mainName: `${slug}-${opts.dpi}dpi-jpg.zip` };
  }
  return {
    main: pdf.blob(),
    mainName: `${slug}-print${opts.layout === 'spreads' ? '-spreads' : ''}.pdf`,
    extra: wrapBlob,
    extraName: `${slug}-cover-wrap.pdf`,
  };
}
