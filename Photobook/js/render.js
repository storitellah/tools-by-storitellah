// One renderer for everything: the editor canvas, thumbnails, the flipbook
// and the print exports all draw through renderItem(), so what you see while
// editing is what prints.

import { MM_PER_PT, rng } from './util.js';
import { peek } from './assets.js';

export const EPS = 0.0005;

export const pagesIn = (item) => (item.kind === 'spread' ? 2 : 1);

export function itemSize(book, item) {
  return { w: book.spec.trimW * pagesIn(item), h: book.spec.trimH };
}

export function color(book, v) {
  if (!v) return 'transparent';
  if (v[0] === '@') return book.theme.colors.find((c) => c.key === v.slice(1))?.value || '#FF00FF';
  return v;
}

export function fontStack(book, f) {
  if (f && f[0] === '@') {
    const role = book.theme.fonts[f.slice(1)];
    if (role) return `"${role.family}", "${role.fallback}", sans-serif`;
  }
  return `"${f}", sans-serif`;
}

export function resolveText(book, text, ctx = {}) {
  const vars = { ...book.meta, ...ctx };
  return String(text ?? '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
}

export function logoAsset(book, ref) {
  let key = ref;
  if (ref && ref[0] === '@') key = book.brand.roles[ref.slice(1)];
  return book.brand.logos.find((l) => l.key === key)?.asset || null;
}

// Element rectangle in mm, with edges at the item boundary pushed to the bleed.
export function elementRect(book, item, el, bleedEdges = true) {
  const { w: W, h: H } = itemSize(book, item);
  let x0 = el.x * W, y0 = el.y * H, x1 = (el.x + el.w) * W, y1 = (el.y + el.h) * H;
  if (bleedEdges && !el.rot) {
    const b = book.spec.bleed;
    if (el.x <= EPS) x0 = Math.min(x0, -b);
    if (el.y <= EPS) y0 = Math.min(y0, -b);
    if (el.x + el.w >= 1 - EPS) x1 = Math.max(x1, W + b);
    if (el.y + el.h >= 1 - EPS) y1 = Math.max(y1, H + b);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Which page of the item an element sits on (by its centre). 0 or 1.
export function sideOf(item, el) {
  if (item.kind !== 'spread') return 0;
  return el.x + el.w / 2 < 0.5 ? 0 : 1;
}

// A spread is a double spread when something with real weight crosses the gutter.
export function isDoubleSpread(item) {
  if (item.kind !== 'spread') return false;
  return item.elements.some((el) => el.type === 'image' && el.x < 0.5 - 0.1 && el.x + el.w > 0.5 + 0.1);
}

// Photo placement inside a frame. Returns the drawn image rect in frame-local mm.
export function imagePlacement(el, iw, ih, fw, fh) {
  const cover = el.fit !== 'contain';
  const base = cover ? Math.max(fw / iw, fh / ih) : Math.min(fw / iw, fh / ih);
  const s = base * (el.zoom || 1);
  const dw = iw * s, dh = ih * s;
  let x = fw / 2 - (el.cx ?? 0.5) * dw;
  let y = fh / 2 - (el.cy ?? 0.5) * dh;
  if (cover) {
    x = Math.min(0, Math.max(fw - dw, x));
    y = Math.min(0, Math.max(fh - dh, y));
  }
  return { x, y, w: dw, h: dh, mmPerPx: s };
}

// Effective print resolution of a photo in its frame.
export function effectiveDpi(book, item, el, info) {
  if (!info || el.type !== 'image') return Infinity;
  const r = elementRect(book, item, el);
  const p = imagePlacement(el, info.w, info.h, r.w, r.h);
  return 25.4 / p.mmPerPx;
}

function blobPath(ctx, x, y, w, hgt, seed) {
  const rand = rng(seed || 1);
  const n = 9;
  const k = [];
  for (let i = 0; i < n; i++) k.push(0.9 + rand() * 0.12);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.2;
    pts.push([x + w / 2 + Math.cos(a) * (w / 2) * k[i], y + hgt / 2 + Math.sin(a) * (hgt / 2) * k[i]]);
  }
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const p0 = pts[i % n], p1 = pts[(i + 1) % n];
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p0[0], p0[1], mx, my);
  }
  ctx.closePath();
}

function roundRect(ctx, x, y, w, hgt, r) {
  ctx.beginPath();
  if (r > 0 && ctx.roundRect) ctx.roundRect(x, y, w, hgt, Math.min(r, w / 2, hgt / 2));
  else ctx.rect(x, y, w, hgt);
}

export function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    if (!para) { out.push(''); continue; }
    const words = para.split(/(\s+)/).filter((s) => s.length);
    let line = '';
    for (const w of words) {
      const test = line + w;
      if (ctx.measureText(test.trimEnd()).width <= maxW || !line.trim()) {
        if (!line.trim() && ctx.measureText(w).width > maxW) {
          // A single word wider than the box: break it by characters.
          let chunk = '';
          for (const ch of w) {
            if (ctx.measureText(chunk + ch).width > maxW && chunk) { out.push(chunk); chunk = ''; }
            chunk += ch;
          }
          line = chunk;
        } else line = test;
      } else {
        out.push(line.trimEnd());
        line = /^\s+$/.test(w) ? '' : w;
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

function drawText(ctx, book, el, r, s, vars, editor) {
  let text = resolveText(book, el.text, vars);
  let placeholder = false;
  if (!text.trim()) {
    if (!editor || !el.placeholder) return;
    text = el.placeholder;
    placeholder = true;
  }
  if (el.upper) text = text.toUpperCase();
  const px = el.size * MM_PER_PT * s;
  ctx.font = `${el.italic ? 'italic ' : ''}${el.weight || 400} ${px}px ${fontStack(book, el.font)}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${((el.tracking || 0) / 1000) * px}px`;
  ctx.fillStyle = color(book, el.color);
  if (placeholder) ctx.globalAlpha *= 0.35;
  ctx.textBaseline = 'alphabetic';
  const lines = wrapLines(ctx, text, r.w);
  const lh = px * (el.leading || 1.2);
  const m = ctx.measureText('Hg');
  const ascent = m.fontBoundingBoxAscent ?? px * 0.8;
  const descent = m.fontBoundingBoxDescent ?? px * 0.2;
  const total = lh * (lines.length - 1) + ascent + descent;
  let y = r.y + ascent;
  if (el.valign === 'middle') y = r.y + (r.h - total) / 2 + ascent;
  else if (el.valign === 'bottom') y = r.y + r.h - total + ascent;
  ctx.textAlign = el.align === 'center' ? 'center' : el.align === 'right' ? 'right' : 'left';
  const x = el.align === 'center' ? r.x + r.w / 2 : el.align === 'right' ? r.x + r.w : r.x;
  for (const line of lines) {
    // Canvas letter-spacing adds space after the last glyph too; shift to keep centring true.
    const shift = el.tracking && 'letterSpacing' in ctx ? (el.align === 'center' ? ((el.tracking / 1000) * px) / 2 : el.align === 'right' ? (el.tracking / 1000) * px : 0) : 0;
    ctx.fillText(line, x + shift, y);
    y += lh;
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function drawPlaceholder(ctx, r, s) {
  ctx.fillStyle = '#ECEAE6';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = '#D6D2CB';
  ctx.lineWidth = Math.max(1, 0.25 * s);
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const step = 3 * s;
  ctx.beginPath();
  for (let d = -r.h; d < r.w; d += step) { ctx.moveTo(r.x + d, r.y + r.h); ctx.lineTo(r.x + d + r.h, r.y); }
  ctx.stroke();
  ctx.restore();
  const c = Math.min(r.w, r.h);
  ctx.fillStyle = '#A9A39A';
  ctx.font = `600 ${Math.max(9, c * 0.07)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Drop a photo', r.x + r.w / 2, r.y + r.h / 2);
}

/**
 * Draw an item (cover, spread or back) onto ctx.
 * opts.scale       px per mm
 * opts.bleed       true: canvas origin is the bleed corner; false: the trim corner
 * opts.quality     'thumb' | 'preview' | 'full' — which cached bitmaps to use
 * opts.editor      draw placeholders for empty frames and unfilled text
 * opts.pageNumbers [left, right] folio numbers for {page}
 * opts.skip        element id not to draw (used while editing text in place)
 * opts.onlySide    0/1: draw a single page of a spread for print. Its own
 *                  background fills the gutter bleed and only elements that
 *                  overlap the page are drawn, so a neighbour's photo that
 *                  merely touches the gutter doesn't show in the bleed, while
 *                  a photo running across the spread continues correctly.
 */
export function renderItem(ctx, book, item, opts) {
  const s = opts.scale;
  const b = book.spec.bleed;
  const { w: W, h: H } = itemSize(book, item);
  const ox = opts.bleed ? b : 0;
  const n = pagesIn(item);
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(ox, ox);
  // Backgrounds, each page out to its bleed.
  if (opts.onlySide != null) {
    ctx.fillStyle = color(book, item.bg[opts.onlySide] ?? item.bg[0]);
    ctx.fillRect(-b, -b, W + 2 * b, H + 2 * b);
  } else for (let i = 0; i < n; i++) {
    const pw = W / n;
    const x0 = i === 0 ? -b : i * pw;
    const x1 = i === n - 1 ? W + b : (i + 1) * pw;
    ctx.fillStyle = color(book, item.bg[i] ?? item.bg[0]);
    ctx.fillRect(x0, -b, x1 - x0, H + 2 * b);
  }
  ctx.restore();

  for (const el of item.elements) {
    if (el.id === opts.skip || el.hidden) continue;
    if (opts.onlySide != null) {
      const p0 = opts.onlySide * 0.5, p1 = p0 + 0.5;
      if (Math.min(el.x + el.w, p1) - Math.max(el.x, p0) <= 0.0005) continue;
    }
    const rm = elementRect(book, item, el);
    const r = { x: (rm.x + ox) * s, y: (rm.y + ox) * s, w: rm.w * s, h: rm.h * s };
    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;
    if (el.rot) {
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate((el.rot * Math.PI) / 180);
      ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    }
    const side = sideOf(item, el);
    const vars = { page: opts.pageNumbers?.[side] ?? '' };
    if (el.type === 'image') {
      const radius = (el.radius || 0) * s;
      const bm = el.asset ? peek(el.asset, opts.quality) || peek(el.asset, 'preview') || peek(el.asset, 'thumb') : null;
      if (bm) {
        roundRect(ctx, r.x, r.y, r.w, r.h, radius);
        ctx.save();
        ctx.clip();
        const p = imagePlacement(el, bm.width, bm.height, r.w, r.h);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bm, r.x + p.x, r.y + p.y, p.w, p.h);
        ctx.restore();
      } else if (opts.editor) {
        drawPlaceholder(ctx, r, s);
      }
      if (el.strokeW > 0) {
        ctx.strokeStyle = color(book, el.stroke);
        ctx.lineWidth = el.strokeW * s;
        roundRect(ctx, r.x + (el.strokeW * s) / 2, r.y + (el.strokeW * s) / 2, r.w - el.strokeW * s, r.h - el.strokeW * s, radius);
        ctx.stroke();
      }
    } else if (el.type === 'text') {
      drawText(ctx, book, el, r, s, vars, opts.editor);
    } else if (el.type === 'shape') {
      if (el.shape === 'ellipse') { ctx.beginPath(); ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2); }
      else if (el.shape === 'blob') blobPath(ctx, r.x, r.y, r.w, r.h, el.seed);
      else if (el.shape === 'line') { ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h / 2); ctx.lineTo(r.x + r.w, r.y + r.h / 2); }
      else roundRect(ctx, r.x, r.y, r.w, r.h, (el.radius || 0) * s);
      if (el.shape === 'line') {
        ctx.strokeStyle = color(book, el.fill);
        ctx.lineWidth = Math.max(0.1, el.strokeW || 0.5) * s;
        ctx.stroke();
      } else {
        ctx.fillStyle = color(book, el.fill);
        ctx.fill();
        if (el.strokeW > 0) { ctx.strokeStyle = color(book, el.stroke); ctx.lineWidth = el.strokeW * s; ctx.stroke(); }
      }
    } else if (el.type === 'logo') {
      const id = logoAsset(book, el.logo);
      const bm = id ? peek(id, opts.quality) || peek(id, 'preview') : null;
      if (bm) {
        const k = Math.min(r.w / bm.width, r.h / bm.height);
        const dw = bm.width * k, dh = bm.height * k;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bm, r.x + (r.w - dw) / 2, r.y + (r.h - dh) / 2, dw, dh);
      } else if (opts.editor) {
        ctx.strokeStyle = '#C8C2B8'; ctx.setLineDash([4, 4]); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }
}

// Asset ids an item needs drawn (photos and logos).
export function itemAssets(book, item) {
  const ids = new Set();
  for (const el of item.elements) {
    if (el.type === 'image' && el.asset) ids.add(el.asset);
    if (el.type === 'logo') { const a = logoAsset(book, el.logo); if (a) ids.add(a); }
  }
  return [...ids];
}

export function makeCanvas(w, hgt) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(hgt));
  return c;
}

// Page numbers: the reading order is cover, inside front, 1…n, inside back, back.
// Interior folios start at 1 on the page after the inside front cover.
export function pageNumbersFor(book, itemIndex) {
  const item = book.items[itemIndex];
  if (item.kind !== 'spread') return ['', ''];
  let spreadIdx = 0;
  for (let i = 0; i < itemIndex; i++) if (book.items[i].kind === 'spread') spreadIdx++;
  const totalSpreads = book.items.filter((it) => it.kind === 'spread').length;
  const left = spreadIdx === 0 ? '' : String(spreadIdx * 2);
  const right = spreadIdx === totalSpreads - 1 ? '' : String(spreadIdx * 2 + 1);
  return [left, right];
}
