// Export dialog: preflight, options, progress.

import { app } from './state.js';
import { exportBook, preflight, readingPages, itemLabel } from './export.js';
import { h, download, fmtBytes } from './util.js';
import { modal, toast } from './dialogs.js';

export function openExport({ goTo }) {
  const book = app.book;
  const spec = book.spec;
  const o = { format: 'pdf', dpi: spec.dpi, layout: 'pages', marks: spec.cropMarks, wrap: false, quality: spec.jpgQuality, scope: 'book' };
  const body = h('div.body');
  let running = false;
  let cancelled = false;

  const issues = preflight(book);
  const issueList = h('div.issues', issues.length
    ? issues.map((i) => h('div.issue.' + i.level, { style: { cursor: i.idx != null ? 'pointer' : '' }, on: { click: () => { if (i.idx != null) { m.close(); goTo(i.idx, i.el); } } } }, i.msg))
    : h('div.issue.ok', 'No problems found — ready for print.'));

  const seg = (key, options, rerender = true) => h('div.seg', options.map(([v, t]) => h('button', {
    'aria-pressed': String(o[key] === v),
    on: { click: () => { o[key] = v; if (rerender) draw(); } },
  }, t)));

  const summary = h('p.hint');
  const progress = h('div.progress', h('span'));
  const status = h('p.hint');
  const go = h('button.txt-btn.primary', { on: { click: run } }, 'Export');
  const cancel = h('button.txt-btn', { on: { click: () => { if (running) cancelled = true; else m.close(); } } }, 'Cancel');

  function draw() {
    const pageMm = spec.trimW + 2 * spec.bleed;
    const px = Math.round((pageMm / 25.4) * o.dpi);
    const n = o.scope === 'book' ? readingPages(book).length : (book.items[app.cur].kind === 'spread' ? 2 : 1);
    summary.textContent = `${n} page${n > 1 ? 's' : ''} · each ${pageMm} × ${spec.trimH + 2 * spec.bleed} mm with ${spec.bleed} mm bleed = ${px} × ${Math.round(((spec.trimH + 2 * spec.bleed) / 25.4) * o.dpi)} px at ${o.dpi} dpi · sRGB`;
    const dpiSel = h('select.input', [300, 450, 600, 900, 1200, ...(new Set([spec.dpi]))].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).map((v) => h('option', { value: v, selected: v === o.dpi }, `${v} dpi${v === spec.dpi ? ' (book setting)' : ''}`)));
    dpiSel.addEventListener('change', () => { o.dpi = +dpiSel.value; draw(); });
    const q = h('input', { type: 'range', min: 0.8, max: 1, step: 0.01, value: o.quality });
    const qv = h('span', Math.round(o.quality * 100));
    q.addEventListener('input', () => { o.quality = +q.value; qv.textContent = Math.round(o.quality * 100); });
    body.replaceChildren(
      h('div.panel-title', 'Preflight'), issueList,
      h('div.section', h('div.grid2',
        h('div.field', h('span', 'Format'), seg('format', [['pdf', 'PDF for print'], ['jpg', 'JPG files (ZIP)']])),
        h('label.field', h('span', 'Resolution'), dpiSel),
        h('div.field', h('span', 'Interior pages'), seg('layout', [['pages', 'Single pages'], ['spreads', 'Spreads (lay-flat)']])),
        h('div.field', h('span', 'What'), seg('scope', [['book', 'Whole book'], ['current', itemLabel(book, app.cur)]])),
        h('label.field', h('span', ['JPEG quality ', qv]), q),
        h('div.field', h('span', 'Extras'),
          o.format === 'pdf' ? h('label.check', h('input', { type: 'checkbox', checked: o.marks, on: { change: (e) => { o.marks = e.target.checked; } } }), 'Crop marks') : null,
          o.scope === 'book' ? h('label.check', h('input', { type: 'checkbox', checked: o.wrap, on: { change: (e) => { o.wrap = e.target.checked; } } }), `Cover wrap (back + ${spec.spine} mm spine + front)`) : null))),
      h('div.section', summary,
        h('p.hint', o.format === 'pdf'
          ? 'Each PDF page is the trimmed page plus bleed, with TrimBox and BleedBox set so print software knows where to cut.'
          : 'Each JPG has its resolution written into the file and includes the bleed. A README with the print spec is inside the ZIP.'),
        progress, status));
  }

  async function run() {
    if (running) return;
    running = true;
    cancelled = false;
    go.disabled = true;
    const bar = progress.firstChild;
    try {
      const res = await exportBook(book, { ...o, only: o.scope === 'current' ? app.cur : null, wrap: o.scope === 'book' && o.wrap },
        (done, total, label) => { bar.style.width = (100 * done) / total + '%'; status.textContent = `Rendering ${label} at ${o.dpi} dpi…`; },
        () => cancelled);
      download(res.main, res.mainName);
      if (res.extra) setTimeout(() => download(res.extra, res.extraName), 400);
      status.textContent = `Done — ${res.mainName} (${fmtBytes(res.main.size)})${res.extra ? ` and ${res.extraName}` : ''}.`;
      toast(`Exported ${res.mainName}`);
    } catch (e) {
      if (e.message === 'cancelled') status.textContent = 'Export cancelled.';
      else { status.textContent = 'Export failed: ' + e.message; console.error(e); }
    } finally {
      running = false;
      go.disabled = false;
    }
  }

  const m = modal('Export for print', body, { footer: [cancel, go] });
  draw();
}
