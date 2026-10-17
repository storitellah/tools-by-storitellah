// The stage: draws the current cover/spread and handles direct manipulation —
// select, move, resize, rotate, crop photos inside frames, edit text in place,
// and drop photos onto frames.

import { app, emit, commit, curItem, selected } from './state.js';
import { renderItem, itemSize, elementRect, imagePlacement, effectiveDpi, itemAssets, pageNumbersFor, isDoubleSpread, fontStack, color, sideOf } from './render.js';
import { load, peek, info } from './assets.js';
import { h, clamp, MM_PER_PT } from './util.js';
import { makeElement } from './layout.js';

const DPR = () => Math.min(window.devicePixelRatio || 1, 2.5);
const SNAP_PX = 6;

export function createEditor({ scroller, stage, canvas, overlay, onFilesDropped }) {
  const ctx = canvas.getContext('2d');
  const ed = {
    scale: 1, zoom: 1,
    crop: null,          // element id in crop mode
    editing: null,       // element id being text-edited
    guides: [],
    hover: null,
    dropTarget: null,
    showGuides: true,
    preview: null,       // an item shown instead of the current one while hovering a layout
  };
  let raf = 0;
  let ta = null; // textarea while editing text in place

  const book = () => app.book;
  const dims = () => {
    const item = ed.preview || curItem();
    const { w, h: hh } = itemSize(book(), item);
    return { item, W: w, H: hh, b: book().spec.bleed };
  };

  function fit() {
    const { W, H, b } = dims();
    const pad = 56;
    const aw = Math.max(100, scroller.clientWidth - pad);
    const ah = Math.max(100, scroller.clientHeight - pad);
    return Math.min(aw / (W + 2 * b), ah / (H + 2 * b));
  }

  function requestRender() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; draw(); });
  }

  // Screen <-> book mm
  function toMm(e) {
    const r = canvas.getBoundingClientRect();
    const { b } = dims();
    return { x: (e.clientX - r.left) / ed.scale - b, y: (e.clientY - r.top) / ed.scale - b };
  }

  function draw() {
    if (!book()) return;
    const { item, W, H, b } = dims();
    ed.scale = fit() * ed.zoom;
    const s = ed.scale;
    const cw = (W + 2 * b) * s, ch = (H + 2 * b) * s;
    const dpr = DPR();
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    stage.style.width = cw + 'px';
    stage.style.height = ch + 'px';
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    // Load anything not yet decoded, then draw again when it arrives.
    for (const id of itemAssets(book(), item)) if (!peek(id, 'preview')) load(id, 'preview').then(requestRender);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    renderItem(ctx, book(), item, { scale: s, bleed: true, quality: 'preview', editor: true, pageNumbers: pageNumbersFor(book(), app.cur), skip: ed.preview ? null : ed.editing });

    if (ed.crop) drawCropGhost();
    if (ed.showGuides) drawGuides(W, H, b, s, item);
    drawOverlay();
  }

  function drawGuides(W, H, b, s, item) {
    const x0 = b * s, y0 = b * s, tw = W * s, th = H * s;
    // Dim the bleed: it prints, then gets trimmed off.
    ctx.fillStyle = 'rgba(20,20,20,0.38)';
    ctx.fillRect(0, 0, tw + 2 * x0, y0);
    ctx.fillRect(0, y0 + th, tw + 2 * x0, y0);
    ctx.fillRect(0, y0, x0, th);
    ctx.fillRect(x0 + tw, y0, x0, th);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, tw - 1, th - 1);
    // Safe area per page
    const sf = book().spec.safe * s;
    const pages = item.kind === 'spread' ? 2 : 1;
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(0,160,255,0.55)';
    for (let i = 0; i < pages; i++) {
      const px = x0 + (i * tw) / pages;
      ctx.strokeRect(px + sf + 0.5, y0 + sf + 0.5, tw / pages - 2 * sf - 1, th - 2 * sf - 1);
    }
    if (pages === 2) {
      ctx.strokeStyle = 'rgba(255,79,163,0.7)';
      ctx.beginPath();
      ctx.moveTo(x0 + tw / 2 + 0.5, y0);
      ctx.lineTo(x0 + tw / 2 + 0.5, y0 + th);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawCropGhost() {
    const { item, b } = dims();
    const el = item.elements.find((e) => e.id === ed.crop);
    if (!el || !el.asset) return;
    const bm = peek(el.asset, 'preview');
    if (!bm) return;
    const s = ed.scale;
    const r = elementRect(book(), item, el);
    const p = imagePlacement(el, bm.width, bm.height, r.w, r.h);
    const fx = (r.x + b) * s, fy = (r.y + b) * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.rect(fx, fy, r.w * s, r.h * s);
    ctx.clip('evenodd');
    ctx.globalAlpha = 0.35;
    ctx.drawImage(bm, fx + p.x * s, fy + p.y * s, p.w * s, p.h * s);
    ctx.restore();
  }

  // ---------- Overlay (selection, badges, guides) ----------

  function boxStyle(el) {
    const { W, H, b } = dims();
    const s = ed.scale;
    return {
      left: (el.x * W + b) * s + 'px', top: (el.y * H + b) * s + 'px',
      width: el.w * W * s + 'px', height: el.h * H * s + 'px',
      transform: el.rot ? `rotate(${el.rot}deg)` : '',
    };
  }

  function drawOverlay() {
    const { item, W, H, b } = dims();
    const s = ed.scale;
    // Clear everything except an open text editor (removing it would blur and close it).
    for (const c of [...overlay.children]) if (c !== ta) c.remove();
    const add = (n) => (ta && ta.parentNode === overlay ? overlay.insertBefore(n, ta) : overlay.append(n));
    if (ed.preview) {
      add(h('div.badge.spread', { style: { left: '50%', top: '8px', transform: 'translateX(-50%)' } }, 'PREVIEW — click the layout to apply it'));
      return;
    }
    // Low-resolution warnings
    for (const el of item.elements) {
      if (el.type !== 'image' || !el.asset) continue;
      const dpi = effectiveDpi(book(), item, el, info(el.asset));
      if (dpi < book().spec.minDpi) {
        add(h('div.badge.warn', { style: { left: (el.x * W + b) * s + 6 + 'px', top: (el.y * H + b) * s + 6 + 'px' }, title: 'Effective print resolution at this size' }, `${Math.round(dpi)} dpi`));
      }
    }
    if (isDoubleSpread(item)) add(h('div.badge.spread', { style: { left: '50%', top: '8px', transform: 'translateX(-50%)' } }, 'DOUBLE SPREAD'));
    if (ed.hover && ed.hover !== app.sel) {
      const el = item.elements.find((e) => e.id === ed.hover);
      if (el) add(h('div.sel-box.hover', { style: boxStyle(el) }));
    }
    if (ed.dropTarget) {
      const el = item.elements.find((e) => e.id === ed.dropTarget);
      if (el) add(h('div.sel-box.drop', { style: boxStyle(el) }));
    }
    const el = selected();
    if (el && el.id !== ed.editing) {
      const box = h('div.sel-box' + (el.locked ? '.locked' : ''), { style: boxStyle(el) });
      if (!el.locked && ed.crop !== el.id) {
        for (const d of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
          const pos = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] }[d];
          box.append(h('div.handle', { dataset: { h: d }, style: { left: pos[0] + '%', top: pos[1] + '%', cursor: d + '-resize' } }));
        }
        box.append(h('div.handle.rot', { dataset: { h: 'rot' }, style: { left: '50%', top: '-22px' } }));
      }
      if (ed.crop === el.id) box.append(h('div.badge.crop-hint', 'Drag to reposition · scroll to zoom · Esc when done'));
      add(box);
    }
    for (const g of ed.guides) {
      add(h('div.guide.' + g.axis, { style: g.axis === 'v' ? { left: (g.v * W + b) * s + 'px' } : { top: (g.v * H + b) * s + 'px' } }));
    }
    if (!book().photos.length && app.cur === 0) {
      add(h('div.badge', { style: { left: '50%', bottom: '14px', transform: 'translateX(-50%)', fontSize: '12px', padding: '7px 11px' } }, 'Drop photos anywhere — the book lays itself out'));
    }
    if (ed.editing) positionTextEditor();
  }

  // ---------- Hit testing ----------

  function hitTest(pt) {
    const { item, W, H } = dims();
    for (let i = item.elements.length - 1; i >= 0; i--) {
      const el = item.elements[i];
      if (el.hidden) continue;
      const cx = (el.x + el.w / 2) * W, cy = (el.y + el.h / 2) * H;
      let px = pt.x - cx, py = pt.y - cy;
      if (el.rot) {
        const a = (-el.rot * Math.PI) / 180;
        [px, py] = [px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a)];
      }
      if (el.rot) {
        if (Math.abs(px) <= (el.w * W) / 2 && Math.abs(py) <= (el.h * H) / 2) return el;
        continue;
      }
      // Frames at the edge extend into the bleed, so they can be grabbed there too.
      const r = elementRect(book(), item, el);
      if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return el;
    }
    return null;
  }

  // ---------- Snapping ----------

  function snapTargets(axis, skipId) {
    const { item, W, H } = dims();
    const size = axis === 'x' ? W : H;
    const sf = book().spec.safe / size;
    const t = [0, 1, sf, 1 - sf, 0.5];
    if (axis === 'x' && item.kind === 'spread') t.push(0.25, 0.75, 0.5 - sf, 0.5 + sf);
    for (const el of item.elements) {
      if (el.id === skipId) continue;
      const a = axis === 'x' ? el.x : el.y, l = axis === 'x' ? el.w : el.h;
      t.push(a, a + l, a + l / 2);
    }
    return t;
  }

  function snap(axis, points, skipId, disabled) {
    if (disabled) return { d: 0, at: null };
    const { W, H } = dims();
    const thr = SNAP_PX / (ed.scale * (axis === 'x' ? W : H));
    let best = null;
    for (const t of snapTargets(axis, skipId)) {
      for (const p of points) {
        const d = t - p;
        if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: t };
      }
    }
    return best || { d: 0, at: null };
  }

  // ---------- Pointer interaction ----------

  let drag = null;

  stage.addEventListener('pointerdown', (e) => {
    if (ed.preview) return;
    if (e.button !== 0 || ed.editing && e.target.closest('.inline-text')) return;
    if (ed.editing) finishTextEdit();
    const pt = toMm(e);
    const { item, W } = dims();
    const handle = e.target.closest('.handle');
    const sel = selected();
    stage.setPointerCapture(e.pointerId);

    if (handle && sel) {
      drag = { kind: handle.dataset.h === 'rot' ? 'rotate' : 'resize', dir: handle.dataset.h, el: sel, start: pt, orig: { ...sel } };
      return;
    }
    const hit = hitTest(pt);
    if (ed.crop) {
      const cel = item.elements.find((x) => x.id === ed.crop);
      if (hit && hit.id === ed.crop) { drag = { kind: 'crop', el: cel, start: pt, orig: { cx: cel.cx, cy: cel.cy } }; return; }
      exitCrop();
    }
    if (item.kind === 'spread') {
      const side = pt.x < W / 2 ? 0 : 1;
      if (side !== app.side) { app.side = side; emit('side'); }
    }
    if (hit) {
      if (app.sel !== hit.id) { app.sel = hit.id; emit('selection'); }
      if (!hit.locked) drag = { kind: 'move', el: hit, start: pt, orig: { ...hit }, moved: false };
    } else if (app.sel) {
      app.sel = null;
      emit('selection');
    }
    requestRender();
  });

  stage.addEventListener('pointermove', (e) => {
    const pt = toMm(e);
    if (!drag) {
      const hit = hitTest(pt);
      const id = hit ? hit.id : null;
      if (id !== ed.hover) { ed.hover = id; requestRender(); }
      stage.style.cursor = ed.crop && hit?.id === ed.crop ? 'move' : hit ? (hit.locked ? 'default' : 'move') : 'default';
      return;
    }
    const { item, W, H } = dims();
    const el = drag.el;
    const dx = (pt.x - drag.start.x) / W, dy = (pt.y - drag.start.y) / H;
    const noSnap = e.altKey;
    ed.guides = [];
    if (drag.kind === 'move') {
      if (!drag.moved && Math.hypot(pt.x - drag.start.x, pt.y - drag.start.y) * ed.scale < 3) return;
      drag.moved = true;
      let nx = drag.orig.x + dx, ny = drag.orig.y + dy;
      const sx = snap('x', [nx, nx + el.w / 2, nx + el.w], el.id, noSnap);
      const sy = snap('y', [ny, ny + el.h / 2, ny + el.h], el.id, noSnap);
      nx += sx.d; ny += sy.d;
      if (sx.at != null) ed.guides.push({ axis: 'v', v: sx.at });
      if (sy.at != null) ed.guides.push({ axis: 'h', v: sy.at });
      el.x = nx; el.y = ny;
    } else if (drag.kind === 'resize') {
      resize(el, drag, dx, dy, e.shiftKey, noSnap, W, H);
    } else if (drag.kind === 'rotate') {
      const cx = (el.x + el.w / 2) * W, cy = (el.y + el.h / 2) * H;
      let a = (Math.atan2(pt.y - cy, pt.x - cx) * 180) / Math.PI + 90;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      else if (Math.abs(((a + 540) % 360) - 180) < 3) a = 0;
      el.rot = Math.round(((a + 540) % 360 - 180) * 10) / 10;
    } else if (drag.kind === 'crop') {
      const bm = peek(el.asset, 'preview');
      if (!bm) return;
      const r = elementRect(book(), item, el);
      const p = imagePlacement(el, bm.width, bm.height, r.w, r.h);
      const mx = (pt.x - drag.start.x), my = (pt.y - drag.start.y);
      el.cx = drag.orig.cx - mx / p.w;
      el.cy = drag.orig.cy - my / p.h;
      clampCrop(el, bm, r);
    }
    requestRender();
    emit('live');
  });

  const endDrag = () => {
    if (!drag) return;
    const changed = drag.kind !== 'move' || drag.moved;
    drag = null;
    ed.guides = [];
    if (changed) commit('element');
    requestRender();
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('pointerleave', () => { if (!drag && ed.hover) { ed.hover = null; requestRender(); } });

  function resize(el, d, dx, dy, keep, noSnap, W, H) {
    const o = d.orig;
    const dir = d.dir;
    let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
    if (dir.includes('w')) x0 += dx;
    if (dir.includes('e')) x1 += dx;
    if (dir.includes('n')) y0 += dy;
    if (dir.includes('s')) y1 += dy;
    // Snap the moving edges.
    if (dir.includes('w')) { const s = snap('x', [x0], el.id, noSnap); x0 += s.d; if (s.at != null) ed.guides.push({ axis: 'v', v: s.at }); }
    if (dir.includes('e')) { const s = snap('x', [x1], el.id, noSnap); x1 += s.d; if (s.at != null) ed.guides.push({ axis: 'v', v: s.at }); }
    if (dir.includes('n')) { const s = snap('y', [y0], el.id, noSnap); y0 += s.d; if (s.at != null) ed.guides.push({ axis: 'h', v: s.at }); }
    if (dir.includes('s')) { const s = snap('y', [y1], el.id, noSnap); y1 += s.d; if (s.at != null) ed.guides.push({ axis: 'h', v: s.at }); }
    const minW = 2 / W, minH = 2 / H;
    if (x1 - x0 < minW) { if (dir.includes('w')) x0 = x1 - minW; else x1 = x0 + minW; }
    if (y1 - y0 < minH) { if (dir.includes('n')) y0 = y1 - minH; else y1 = y0 + minH; }
    if (keep || el.type === 'logo') {
      const ratio = (o.w * W) / (o.h * H);
      let wmm = (x1 - x0) * W, hmm = (y1 - y0) * H;
      if (dir === 'n' || dir === 's') wmm = hmm * ratio;
      else if (dir === 'e' || dir === 'w') hmm = wmm / ratio;
      else if (wmm / hmm > ratio) hmm = wmm / ratio; else wmm = hmm * ratio;
      if (dir.includes('w')) x0 = x1 - wmm / W; else if (dir === 'n' || dir === 's') { const c = o.x + o.w / 2; x0 = c - wmm / W / 2; } else x1 = x0 + wmm / W;
      if (dir.includes('n')) y0 = y1 - hmm / H; else if (dir === 'e' || dir === 'w') { const c = o.y + o.h / 2; y0 = c - hmm / H / 2; } else y1 = y0 + hmm / H;
      x1 = x0 + wmm / W; y1 = y0 + hmm / H;
    }
    el.x = x0; el.y = y0; el.w = x1 - x0; el.h = y1 - y0;
  }

  function clampCrop(el, bm, r) {
    const p = imagePlacement({ ...el, cx: 0.5, cy: 0.5 }, bm.width, bm.height, r.w, r.h);
    if (el.fit === 'contain') { el.cx = clamp(el.cx, 0, 1); el.cy = clamp(el.cy, 0, 1); return; }
    const hx = r.w / (2 * p.w), hy = r.h / (2 * p.h);
    el.cx = clamp(el.cx, hx, 1 - hx);
    el.cy = clamp(el.cy, hy, 1 - hy);
  }

  stage.addEventListener('dblclick', (e) => {
    const hit = hitTest(toMm(e));
    if (!hit) return;
    app.sel = hit.id;
    if (hit.type === 'image' && hit.asset) enterCrop(hit.id);
    else if (hit.type === 'text') startTextEdit(hit.id);
    emit('selection');
  });

  stage.addEventListener('wheel', (e) => {
    if (ed.crop) {
      const { item } = dims();
      const el = item.elements.find((x) => x.id === ed.crop);
      const hit = hitTest(toMm(e));
      if (el && hit?.id === el.id) {
        e.preventDefault();
        const min = el.fit === 'contain' ? 0.2 : 1;
        el.zoom = clamp((el.zoom || 1) * Math.exp(-e.deltaY * 0.0015), min, 8);
        const bm = peek(el.asset, 'preview');
        if (bm) clampCrop(el, bm, elementRect(book(), item, el));
        requestRender();
        emit('live');
        commitSoon();
        return;
      }
    }
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(ed.zoom * Math.exp(-e.deltaY * 0.002));
    }
  }, { passive: false });

  let commitTimer;
  const commitSoon = () => { clearTimeout(commitTimer); commitTimer = setTimeout(() => commit('element'), 400); };

  function enterCrop(id) { ed.crop = id; requestRender(); emit('crop'); }
  function exitCrop() { if (!ed.crop) return; ed.crop = null; commit('element'); requestRender(); emit('crop'); }

  // ---------- Inline text editing ----------

  function startTextEdit(id) {
    const el = curItem().elements.find((x) => x.id === id);
    if (!el || el.type !== 'text') return;
    ed.editing = id;
    ta = h('textarea.inline-text', { spellcheck: true, placeholder: el.placeholder || '' });
    ta.value = el.text;
    ta.addEventListener('input', () => { el.text = ta.value; emit('live'); });
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); finishTextEdit(); }
    });
    ta.addEventListener('blur', () => finishTextEdit());
    requestRender();
    requestAnimationFrame(() => { draw(); positionTextEditor(); ta.focus(); ta.select(); });
  }

  function positionTextEditor() {
    if (!ta) return;
    const el = curItem().elements.find((x) => x.id === ed.editing);
    if (!el) return;
    const s = ed.scale;
    Object.assign(ta.style, boxStyle(el));
    const px = el.size * MM_PER_PT * s;
    Object.assign(ta.style, {
      fontFamily: fontStack(book(), el.font), fontSize: px + 'px', fontWeight: el.weight || 400, fontStyle: el.italic ? 'italic' : 'normal',
      lineHeight: el.leading || 1.2, textAlign: el.align || 'left', color: color(book(), el.color),
      letterSpacing: ((el.tracking || 0) / 1000) * px + 'px', textTransform: el.upper ? 'uppercase' : 'none',
      background: isDark(color(book(), el.color)) ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.45)',
    });
    if (!ta.isConnected) overlay.append(ta);
  }

  function isDark(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return true;
    const n = parseInt(m[1], 16);
    return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 140;
  }

  function finishTextEdit() {
    if (!ed.editing) return;
    ed.editing = null;
    const t = ta;
    ta = null;
    t?.remove();
    commit('element');
    requestRender();
  }

  // ---------- Drag and drop onto the page ----------

  const isAssetDrag = (e) => [...e.dataTransfer.types].includes('text/x-photobook-asset');
  const isFileDrag = (e) => [...e.dataTransfer.types].includes('Files');

  stage.addEventListener('dragover', (e) => {
    if (!isAssetDrag(e) && !isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    const hit = hitTest(toMm(e));
    const id = hit && hit.type === 'image' ? hit.id : null;
    if (id !== ed.dropTarget) { ed.dropTarget = id; requestRender(); }
  });
  stage.addEventListener('dragleave', () => { if (ed.dropTarget) { ed.dropTarget = null; requestRender(); } });
  stage.addEventListener('drop', async (e) => {
    if (!isAssetDrag(e) && !isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = toMm(e);
    const target = ed.dropTarget;
    ed.dropTarget = null;
    if (isAssetDrag(e)) {
      placePhoto(e.dataTransfer.getData('text/x-photobook-asset'), target, pt);
    } else {
      onFilesDropped([...e.dataTransfer.files], { target, pt });
    }
  });

  // Put a photo into a frame, or into a new frame at a point.
  function placePhoto(assetId, targetId, pt) {
    const { item, W, H } = dims();
    const a = info(assetId);
    if (!a) return;
    let el = targetId && item.elements.find((x) => x.id === targetId);
    if (el) {
      el.asset = assetId; el.cx = 0.5; el.cy = 0.5; el.zoom = 1;
    } else {
      const side = pt && item.kind === 'spread' ? (pt.x < W / 2 ? 0 : 1) : 0;
      const pageW = item.kind === 'spread' ? W / 2 : W;
      const ar = a.w / a.h;
      const wmm = ar >= 1 ? pageW * 0.5 : H * 0.5 * ar;
      const hmm = wmm / ar;
      const cx = pt ? pt.x : side * pageW + pageW / 2, cy = pt ? pt.y : H / 2;
      el = makeElement('image', { asset: assetId, x: (cx - wmm / 2) / W, y: (cy - hmm / 2) / H, w: wmm / W, h: hmm / H });
      item.elements.push(el);
    }
    if (!app.book.photos.includes(assetId)) app.book.photos.push(assetId);
    app.sel = el.id;
    commit('element');
    requestRender();
  }

  function setZoom(z) {
    ed.zoom = clamp(z, 0.5, 4);
    requestRender();
    emit('zoom');
  }

  new ResizeObserver(() => requestRender()).observe(scroller);

  return {
    setPreview(item) { if (ed.preview === item) return; ed.preview = item; requestRender(); },
    requestRender, draw, enterCrop, exitCrop, startTextEdit, finishTextEdit, placePhoto, setZoom,
    get zoom() { return ed.zoom; },
    get cropping() { return ed.crop; },
    get editingText() { return ed.editing; },
    set showGuides(v) { ed.showGuides = v; requestRender(); },
    get showGuides() { return ed.showGuides; },
    sideAt: (el) => sideOf(curItem(), el),
  };
}
