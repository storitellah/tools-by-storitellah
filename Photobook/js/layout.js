// Auto-layout: turns a list of photos into a designed book using whatever is
// in the template library. Templates are scored by how well their frames fit
// each photo's shape; panoramas become double spreads.

import { uid, clone } from './util.js';
import { ELEMENT_DEFAULTS } from './defaults.js';
import { info } from './assets.js';
import { sideOf, isDoubleSpread } from './render.js';

export function makeElement(type, props = {}) {
  return { id: uid('e'), type, x: 0.2, y: 0.2, w: 0.6, h: 0.6, rot: 0, opacity: 1, ...clone(ELEMENT_DEFAULTS[type] || {}), ...props };
}

const aspectOf = (id) => { const i = info(id); return i ? i.w / i.h : 1; };
const slotsOf = (tpl) => tpl.elements.filter((e) => e.type === 'image');

function frameAspect(book, tpl, el) {
  const span = tpl.scope === 'spread' ? 2 : 1;
  return (el.w * book.spec.trimW * span) / (el.h * book.spec.trimH);
}

// Map template elements (fractions of a page or a spread) into an item.
// side: 0/1 for a page template on a spread; null when the template fills the item.
export function instantiate(tpl, item, side, photos = []) {
  let k = 0;
  return tpl.elements.map((src) => {
    const el = makeElement(src.type, clone(src));
    el.id = uid('e');
    if (item.kind === 'spread' && side != null && tpl.scope !== 'spread') {
      el.x = side * 0.5 + src.x * 0.5;
      el.w = src.w * 0.5;
    }
    if (el.type === 'image') el.asset = photos[k++] || null;
    return el;
  });
}

export function newItem(kind, bg) {
  return { id: uid('i'), kind, bg: bg || (kind === 'spread' ? ['@paper', '@paper'] : ['@paper']), elements: [], tpl: kind === 'spread' ? [null, null] : [null] };
}

// Apply a template to one page of an item (side 0/1), or to the whole item.
// Photos already on that page move into the new frames, in order.
export function applyTemplate(book, item, tpl, side) {
  const whole = tpl.scope !== 'page' || item.kind !== 'spread';
  const onTarget = (el) => whole || sideOf(item, el) === side;
  const photos = item.elements.filter((el) => onTarget(el) && el.type === 'image' && el.asset).map((el) => el.asset);
  item.elements = item.elements.filter((el) => !onTarget(el));
  const added = instantiate(tpl, item, whole ? null : side, photos);
  item.elements.push(...added);
  if (whole) {
    item.bg = item.kind === 'spread' ? [tpl.bg[0], tpl.bg[1] ?? tpl.bg[0]] : [tpl.bg[0]];
    item.tpl = item.kind === 'spread' ? [tpl.id, tpl.id] : [tpl.id];
  } else {
    item.bg[side] = tpl.bg[0];
    item.tpl[side] = tpl.id;
  }
  return photos.slice(slotsOf(tpl).length); // photos that no longer have a frame
}

// What the Layout panel does when a template is chosen for the current page:
// a page template on a spread replaces one side; on a double spread it turns
// the spread back into two pages. Used for both the preview and the real thing.
export function applyLayout(book, item, tpl, side, templates) {
  if (item.kind === 'spread' && tpl.scope === 'page' && isDoubleSpread(item)) {
    const photos = item.elements.filter((e) => e.type === 'image' && e.asset).map((e) => e.asset);
    item.elements = [];
    item.tpl = [null, null];
    const blank = templates.find((t) => t.id === 'page-blank');
    if (blank) applyTemplate(book, item, blank, 1 - side);
    applyTemplate(book, item, tpl, side);
    const frames = item.elements.filter((e) => e.type === 'image');
    frames.forEach((e, i) => { e.asset = photos[i] || null; });
    return photos.slice(frames.length);
  }
  return applyTemplate(book, item, tpl, item.kind === 'spread' && tpl.scope === 'page' ? side : undefined);
}

const byTag = (templates, scope, tag) => templates.filter((t) => t.scope === scope && (t.tags || []).includes(tag));

function pickTemplate(book, candidates, photos, recent) {
  let best = null;
  for (const tpl of candidates) {
    const slots = slotsOf(tpl);
    if (!slots.length || slots.length > photos.length) continue;
    let cost = 0;
    slots.forEach((sl, i) => { cost += Math.abs(Math.log(frameAspect(book, tpl, sl) / aspectOf(photos[i]))); });
    cost /= slots.length;
    // Small pages read better with fewer photos; nudge towards one or two.
    cost += [0, 0, 0.16, 0.42, 0.55][slots.length] ?? 0.7;
    const age = recent.lastIndexOf(tpl.id);
    if (age !== -1) cost += age === recent.length - 1 ? 0.5 : 0.18;
    if (!best || cost < best.cost) best = { tpl, cost, n: slots.length };
  }
  return best;
}

const BLANK = { id: null, elements: [], bg: ['@paper'], scope: 'page' };
const blankOf = (templates) => templates.find((t) => t.id === 'page-blank') || BLANK;

// Plan interior pages for photos. Page 0 of the result is a left-hand page.
// Each entry is { tpl, photos } for one page, or { tpl, photos, spread: true }
// for a double spread occupying a left+right pair.
function planPages(book, templates, photoIds) {
  const spec = book.spec;
  const pageTpls = byTag(templates, 'page', 'photo');
  const spreadTpls = byTag(templates, 'spread', 'photo');
  const queue = [...photoIds];
  const recent = [];
  const pages = [];
  const leftNext = () => pages.reduce((n, p) => n + (p.spread ? 2 : 1), 0) % 2 === 0;
  const pano = (id) => spreadTpls.length > 0 && aspectOf(id) >= spec.spreadAspect;
  const fillerTpl = byTag(templates, 'page', 'filler')[0] || blankOf(templates);

  while (queue.length) {
    if (pano(queue[0])) {
      if (!leftNext()) {
        // Keep the panorama on a left page: pull the next ordinary photo forward, or add a filler page.
        const j = queue.findIndex((id) => !pano(id));
        const pick = j !== -1 && pickTemplate(book, pageTpls, [queue[j]], recent);
        if (pick) { pages.push({ tpl: pick.tpl, photos: queue.splice(j, 1) }); recent.push(pick.tpl.id); }
        else pages.push({ tpl: fillerTpl, photos: [] });
        continue;
      }
      const pick = pickTemplate(book, spreadTpls, [queue[0]], recent);
      if (pick) { pages.push({ tpl: pick.tpl, photos: queue.splice(0, 1), spread: true }); recent.push(pick.tpl.id); continue; }
    }
    // Look at the next few ordinary photos and choose the best-fitting page.
    const run = [];
    for (const id of queue) { if (pano(id)) break; run.push(id); if (run.length === 4) break; }
    const pick = run.length && pickTemplate(book, pageTpls, run, recent);
    if (!pick) { queue.shift(); continue; }
    const used = run.slice(0, pick.n);
    for (const id of used) queue.splice(queue.indexOf(id), 1);
    pages.push({ tpl: pick.tpl, photos: used });
    recent.push(pick.tpl.id);
  }
  return pages;
}

const pageCount = (list) => list.reduce((n, p) => n + (p.spread ? 2 : 1), 0);

// Pair a page list (starting on a left page, even length) into spread items.
function pairPages(book, templates, seq) {
  const items = [];
  let i = 0;
  while (i < seq.length) {
    const it = newItem('spread');
    const a = seq[i];
    if (a.spread) {
      applyTemplate(book, it, a.tpl);
      it.elements.filter((e) => e.type === 'image').forEach((e, k) => { e.asset = a.photos[k] || null; });
      i += 1;
    } else {
      const b = seq[i + 1];
      placePage(book, it, a, 0);
      if (b && !b.spread) { placePage(book, it, b, 1); i += 2; } else { placePage(book, it, { tpl: blankOf(templates), photos: [] }, 1); i += 1; }
    }
    items.push(it);
  }
  return items;
}

/**
 * Lay out a whole book from photos (asset ids, in order).
 * Returns new items: cover, spreads, back.
 */
export function autoLayout(book, templates, photoIds, opts = {}) {
  const spec = book.spec;
  const queue = [...photoIds];

  const coverTpl = templates.find((t) => t.id === opts.coverTemplate) || byTag(templates, 'cover', 'default')[0] || templates.find((t) => t.scope === 'cover');
  const cover = newItem('cover');
  if (coverTpl) {
    const n = slotsOf(coverTpl).length;
    // With only a handful of photos the cover photo is used inside as well.
    const coverPhotos = queue.length > 4 ? queue.splice(0, n) : queue.slice(0, n);
    applyTemplate(book, cover, coverTpl);
    cover.elements.filter((e) => e.type === 'image').forEach((e, i) => { e.asset = coverPhotos[i] || null; });
  }

  const pages = planPages(book, templates, queue);
  const title = byTag(templates, 'page', 'title')[0];
  const endpaper = byTag(templates, 'page', 'endpaper')[0] || blankOf(templates);
  const colophon = byTag(templates, 'page', 'colophon')[0];
  const blank = blankOf(templates);

  // Reading order: inside front cover | title, then the photo pages (which
  // therefore begin on a left page), optional colophon, inside back cover.
  const interior = [];
  if (title) interior.push({ tpl: title, photos: [] });
  else interior.push({ tpl: blank, photos: [] });
  interior.push(...pages);
  const tail = spec.colophon && colophon ? 1 : 0;
  const multiple = Math.max(1, spec.pageMultiple | 0);
  const total = () => pageCount(interior) + tail;
  while (total() % multiple !== 0 || total() % 2 !== 0 || total() < (spec.minPages | 0)) interior.push({ tpl: blank, photos: [] });
  if (tail) interior.push({ tpl: colophon, photos: [] });

  const seq = [{ tpl: endpaper, photos: [] }, ...interior, { tpl: endpaper, photos: [] }];
  const items = [cover, ...pairPages(book, templates, seq)];

  const backTpl = templates.find((t) => t.id === opts.backTemplate) || byTag(templates, 'back', 'default')[0] || templates.find((t) => t.scope === 'back');
  const back = newItem('back');
  if (backTpl) applyTemplate(book, back, backTpl);
  items.push(back);
  return items;
}

function placePage(book, item, page, side) {
  if (!page.tpl?.elements) return;
  item.elements.push(...instantiate(page.tpl, item, side, page.photos));
  item.bg[side] = page.tpl.bg?.[0] || '@paper';
  item.tpl[side] = page.tpl.id;
}

// Lay out extra photos as new spreads (to go before the closing spread).
export function layoutMore(book, templates, photoIds) {
  const pages = planPages(book, templates, photoIds);
  if (pageCount(pages) % 2) pages.push({ tpl: blankOf(templates), photos: [] });
  return pairPages(book, templates, pages);
}

// Place photos into empty frames across the book. Returns photos left over.
export function fillEmptyFrames(book, photoIds, startItem = 0) {
  const left = [...photoIds];
  for (let i = startItem; i < book.items.length && left.length; i++) {
    for (const el of book.items[i].elements) {
      if (!left.length) break;
      if (el.type === 'image' && !el.asset) el.asset = left.shift();
    }
  }
  return left;
}

export function templateFromItem(book, item, side, name) {
  const spread = item.kind === 'spread' && side == null;
  const scope = item.kind === 'cover' ? 'cover' : item.kind === 'back' ? 'back' : spread ? 'spread' : 'page';
  const els = item.elements.filter((el) => scope !== 'page' || sideOf(item, el) === side).map((el) => {
    const c = clone(el);
    delete c.id;
    if (c.type === 'image') { c.asset = null; c.cx = 0.5; c.cy = 0.5; c.zoom = 1; }
    if (scope === 'page' && item.kind === 'spread') { c.x = (c.x - side * 0.5) * 2; c.w *= 2; }
    return c;
  });
  const hasPhotos = els.some((e) => e.type === 'image');
  return {
    id: uid('t_'), name, scope, builtin: false,
    tags: hasPhotos && (scope === 'page' || scope === 'spread') ? ['photo'] : [],
    bg: scope === 'spread' ? [...item.bg] : [item.bg[side ?? 0]],
    elements: els,
  };
}
