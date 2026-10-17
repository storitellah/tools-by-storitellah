// "Book & theme": every book-level setting — text fields, print spec, colours,
// fonts, logos and the template library.

import { app, commit, saveTemplate, deleteTemplate, restoreDefaultTemplates, loadTemplates, emit } from './state.js';
import { importImage, importFont, registerFonts, fontStatus, thumbURL } from './assets.js';
import { DEFAULT_META, LOGO_ROLE_NAMES, THEME_PRESETS } from './defaults.js';
import { h, uid, pickFiles, download, clone, slugify } from './util.js';
import { modal, toast, confirmDialog } from './dialogs.js';
import { colorField, fontOptions, templateThumb } from './panels.js';
import { icon } from './icons.js';

const TABS = [['book', 'Book'], ['print', 'Print'], ['theme', 'Colours'], ['fonts', 'Fonts'], ['brand', 'Brand'], ['templates', 'Templates']];

export function openDesign(tab = 'book') {
  const body = h('div.body');
  const tabs = h('div.tabs', { role: 'tablist' });
  let current = tab;
  const show = (t) => {
    current = t;
    tabs.replaceChildren(...TABS.map(([k, label]) => h('button', { role: 'tab', 'aria-selected': String(k === t), on: { click: () => show(k) } }, label)));
    body.replaceChildren(PANES[t](() => show(current)));
  };
  const m = modal('Book & theme', h('div', tabs, body), { wide: true });
  show(tab);
  return m;
}

const field = (label, input, hint) => h('label.field', h('span', label), input, hint ? h('span.hint', hint) : null);

function text(value, onChange, attrs = {}) {
  const i = h('input.input', { value: value ?? '', ...attrs });
  i.addEventListener('change', () => onChange(i.value));
  return i;
}

function number(value, onChange, attrs = {}) {
  const i = h('input.input', { type: 'number', value, step: attrs.step || 'any', ...attrs });
  i.addEventListener('change', () => { const v = parseFloat(i.value); if (!Number.isNaN(v)) onChange(v); });
  return i;
}

const PANES = {
  book(redraw) {
    const meta = app.book.meta;
    const rows = Object.keys(meta).map((k) => h('div.row',
      h('div.field', h('span', `{${k}}`), text(meta[k], (v) => { meta[k] = v; commit('design'); })),
      k in DEFAULT_META ? null : h('button.icon-btn', { title: 'Remove field', style: { alignSelf: 'end' }, on: { click: () => { delete meta[k]; commit('design'); redraw(); } } }, icon('trash'))));
    const newKey = h('input.input', { placeholder: 'fieldname' });
    return h('div',
      h('p.hint', 'These fill the {fields} used in templates and text — change the title here and every page that shows it updates.'),
      h('div.grid2', rows),
      h('div.section', h('div.panel-title', 'Add a field'),
        h('div.row', newKey, h('button.txt-btn.small', { on: { click: () => {
          const k = newKey.value.trim().replace(/[^\w]/g, '');
          if (!k || k in meta) return;
          meta[k] = '';
          commit('design');
          redraw();
        } } }, 'Add'))));
  },

  print() {
    const s = app.book.spec;
    const set = (k) => (v) => { s[k] = v; commit('design'); };
    return h('div',
      h('div.panel-title', 'Size'),
      h('div.grid3',
        field('Page width (mm)', number(s.trimW, set('trimW'), { min: 20, max: 600 })),
        field('Page height (mm)', number(s.trimH, set('trimH'), { min: 20, max: 600 })),
        field('Bleed (mm)', number(s.bleed, set('bleed'), { min: 0, max: 20, step: 0.5 })),
        field('Safe margin (mm)', number(s.safe, set('safe'), { min: 0, max: 40, step: 0.5 }), 'Keep text inside this'),
        field('Spine width (mm)', number(s.spine, set('spine'), { min: 0, max: 80, step: 0.5 }), 'For the cover wrap'),
        field('Spine text', text(s.spineText, set('spineText')), 'Leave empty for none')),
      h('div.field', h('span', 'Spine colour'), colorField(s.spineColor, (v, live) => { s.spineColor = v; if (!live) commit('design'); })),
      h('div.field', { style: { marginTop: '8px' } }, h('span', 'Spine text colour'), colorField(s.spineTextColor, (v, live) => { s.spineTextColor = v; if (!live) commit('design'); })),
      h('div.section', h('div.panel-title', 'Output'),
        h('div.grid3',
          field('Export resolution (dpi)', number(s.dpi, set('dpi'), { min: 72, max: 2400, step: 1 })),
          field('Warn below (dpi)', number(s.minDpi, set('minDpi'), { min: 72, max: 1200, step: 1 })),
          field('JPEG quality (0–1)', number(s.jpgQuality, set('jpgQuality'), { min: 0.5, max: 1, step: 0.01 })),
          field('Crop mark gap (mm)', number(s.markOffset, set('markOffset'), { min: 0, max: 20, step: 0.5 }), 'Beyond the bleed'),
          field('Crop mark length (mm)', number(s.markLength, set('markLength'), { min: 1, max: 20, step: 0.5 })),
          h('label.check', h('input', { type: 'checkbox', checked: s.cropMarks, on: { change: (e) => set('cropMarks')(e.target.checked) } }), 'Crop marks in PDF by default'))),
      h('div.section', h('div.panel-title', 'Auto-layout'),
        h('div.grid3',
          field('Double spread from aspect', number(s.spreadAspect, set('spreadAspect'), { min: 1.2, max: 6, step: 0.05 }), 'Photos this wide or wider go across two pages'),
          field('Page count multiple', number(s.pageMultiple, set('pageMultiple'), { min: 1, max: 32, step: 1 }), 'Interior pages, set by your printer'),
          field('Minimum pages', number(s.minPages, set('minPages'), { min: 0, max: 400, step: 1 })),
          h('label.check', h('input', { type: 'checkbox', checked: s.colophon, on: { change: (e) => set('colophon')(e.target.checked) } }), 'Add a colophon page'))));
  },

  theme(redraw) {
    const theme = app.book.theme;
    const rows = theme.colors.map((c) => {
      const pick = h('input', { type: 'color', value: c.value });
      pick.addEventListener('input', () => { c.value = pick.value; emit('live'); });
      pick.addEventListener('change', () => { c.value = pick.value; commit('design'); });
      return h('div.list-row', pick,
        h('div.grow', text(c.name, (v) => { c.name = v; commit('design'); })),
        h('code.sub', '@' + c.key),
        h('button.icon-btn', { title: 'Delete colour', on: { click: async () => {
          if (theme.colors.length <= 1) return;
          if (!(await confirmDialog('Delete colour', `Anything using “${c.name}” keeps its current look as a fixed colour.`, 'Delete', { danger: true }))) return;
          freezeColour(c);
          theme.colors.splice(theme.colors.indexOf(c), 1);
          commit('design');
          redraw();
        } } }, icon('trash')));
    });
    return h('div',
      h('p.hint', 'Layouts refer to these colours by name, so changing one recolours the whole book.'),
      h('div.list', rows),
      h('div.row', { style: { marginTop: '10px' } },
        h('button.txt-btn.small', { on: { click: () => {
          const key = 'c' + uid().slice(0, 4);
          theme.colors.push({ key, name: 'New colour', value: '#888888' });
          commit('design');
          redraw();
        } } }, icon('plus'), 'Add colour')),
      h('div.section', h('div.panel-title', 'Palettes'),
        h('div.row.wrap', THEME_PRESETS.map((p) => h('button.txt-btn.small', { on: { click: () => {
          for (const c of p.colors) {
            const ex = theme.colors.find((x) => x.key === c.key);
            if (ex) ex.value = c.value; else theme.colors.push({ ...c });
          }
          commit('design');
          redraw();
        } } }, h('span', { style: { display: 'inline-flex', gap: '2px' } }, p.colors.slice(0, 4).map((c) => h('span', { style: { width: '10px', height: '10px', borderRadius: '2px', background: c.value } }))), p.name))),
        h('p.hint', 'A palette sets the values of matching colours; your layouts stay as they are.')));
  },

  fonts(redraw) {
    const book = app.book;
    const roles = Object.entries(book.theme.fonts).map(([k, r]) => h('div.grid2',
      field(`${k[0].toUpperCase() + k.slice(1)} font`, (() => {
        const s = h('select.input', fontOptions(book).filter(([v]) => v[0] !== '@').map(([v, t]) => h('option', { value: v, selected: v === r.family }, t)));
        s.addEventListener('change', () => { r.family = s.value; commit('design'); });
        return s;
      })()),
      field('Fallback while the font is missing', text(r.fallback, (v) => { r.fallback = v; commit('design'); }))));
    const files = book.fontFiles.map((f) => {
      const st = fontStatus(f);
      return h('div.list-row',
        h('div.grow', h('div', `${f.family} · ${f.weight}${f.style === 'italic' ? ' italic' : ''}`), h('div.sub', f.asset ? 'Stored in this browser' : f.url)),
        h('span.sub', { style: { color: st === 'ok' ? 'var(--ok)' : st === 'missing' ? 'var(--danger)' : '' } }, st === 'ok' ? 'Loaded' : st === 'missing' ? 'File not found' : 'Loading'),
        h('button.icon-btn', { title: 'Remove', on: { click: () => { book.fontFiles.splice(book.fontFiles.indexOf(f), 1); commit('design'); redraw(); } } }, icon('trash')));
    });
    return h('div',
      h('div.panel-title', 'Fonts used by layouts'), ...roles,
      h('div.section', h('div.panel-title', 'Font files'),
        h('p.hint', 'Add .otf, .ttf, .woff or .woff2 files. They are stored in this browser (and in backups) and embedded in exports as part of the rendered pages.'),
        h('div.list', files),
        h('div.row', { style: { marginTop: '10px' } }, h('button.txt-btn.small', { on: { click: async () => {
          const list = await pickFiles({ accept: '.otf,.ttf,.woff,.woff2', multiple: true });
          await addFontFiles(list);
          redraw();
        } } }, icon('plus'), 'Add font files'))));
  },

  brand(redraw) {
    const brand = app.book.brand;
    const cards = brand.logos.map((l) => {
      const img = h('img', { alt: l.name });
      thumbURL(l.asset).then((u) => { img.src = u; });
      return h('div.logo-card', h('div.img', img),
        text(l.name, (v) => { l.name = v; commit('design'); }),
        h('div.row', { style: { margin: 0 } },
          h('button.txt-btn.small', { on: { click: async () => {
            const [f] = await pickFiles({ accept: 'image/*', multiple: false });
            if (!f) return;
            l.asset = (await importImage(f, 'logo')).id;
            commit('design');
            redraw();
          } } }, 'Replace'),
          h('button.icon-btn', { title: 'Delete logo', on: { click: () => {
            brand.logos.splice(brand.logos.indexOf(l), 1);
            for (const [r, key] of Object.entries(brand.roles)) if (key === l.key) brand.roles[r] = brand.logos[0]?.key || null;
            commit('design');
            redraw();
          } } }, icon('trash'))));
    });
    const roles = Object.keys(brand.roles).map((r) => {
      const s = h('select.input', brand.logos.map((l) => h('option', { value: l.key, selected: l.key === brand.roles[r] }, l.name)));
      s.addEventListener('change', () => { brand.roles[r] = s.value; commit('design'); });
      return field(LOGO_ROLE_NAMES[r] || r, s);
    });
    return h('div',
      h('div.panel-title', 'Where logos appear'),
      h('p.hint', 'Templates place logos by role. The back cover always carries the “Back cover logo”.'),
      h('div.grid3', roles),
      h('div.section', h('div.panel-title', 'Logo files'),
        h('div.logo-grid', cards),
        h('div.row', { style: { marginTop: '10px' } }, h('button.txt-btn.small', { on: { click: async () => {
          const list = await pickFiles({ accept: 'image/*', multiple: true });
          for (const f of list) {
            const a = await importImage(f, 'logo');
            brand.logos.push({ key: 'logo-' + uid().slice(0, 5), name: f.name.replace(/\.[^.]+$/, ''), asset: a.id });
          }
          if (list.length) { commit('design'); redraw(); }
        } } }, icon('plus'), 'Add logo'))));
  },

  templates(redraw) {
    const groups = [['cover', 'Covers'], ['back', 'Back covers'], ['page', 'Pages'], ['spread', 'Double spreads']];
    const row = (t) => h('div.list-row',
      h('span.tthumb', templateThumb(app.book, t, 46)),
      h('div.grow', text(t.name, async (v) => { t.name = v; await saveTemplate(t); })),
      h('div.field', { style: { maxWidth: '220px' } }, text((t.tags || []).join(', '), async (v) => { t.tags = v.split(',').map((x) => x.trim()).filter(Boolean); await saveTemplate(t); }, { title: 'Tags: photo, title, endpaper, colophon, filler, default' })),
      h('span.sub', `${t.elements.filter((e) => e.type === 'image').length} photo${t.elements.filter((e) => e.type === 'image').length === 1 ? '' : 's'}`),
      h('button.icon-btn', { title: 'Duplicate', on: { click: async () => { const c = clone(t); c.id = uid('t_'); c.name += ' copy'; c.builtin = false; c.order = (t.order ?? 0) + 0.5; await saveTemplate(c); redraw(); } } }, icon('copy')),
      h('button.icon-btn', { title: 'Delete', on: { click: async () => { await deleteTemplate(t.id); redraw(); } } }, icon('trash')));
    return h('div',
      h('p.hint', 'To make a template: lay out a page the way you like it, then Layout → Save as template. Tags tell auto-layout where a template may be used: photo (photo pages and spreads), title, endpaper, colophon, filler, default (cover/back).'),
      ...groups.map(([scope, label]) => h('div.section', h('div.panel-title', label), h('div.list', app.templates.filter((t) => t.scope === scope).map(row)))),
      h('div.section', h('div.row.wrap',
        h('button.txt-btn.small', { on: { click: async () => { await restoreDefaultTemplates(); redraw(); toast('Starter templates restored'); } } }, 'Restore starter templates'),
        h('button.txt-btn.small', { on: { click: () => download(new Blob([JSON.stringify({ format: 'photobook-templates', templates: app.templates }, null, 1)], { type: 'application/json' }), `${slugify(app.book.meta.title)}-templates.json`) } }, 'Export templates'),
        h('button.txt-btn.small', { on: { click: async () => {
          const [f] = await pickFiles({ accept: '.json,application/json', multiple: false });
          if (!f) return;
          try {
            const data = JSON.parse(await f.text());
            for (const t of data.templates || []) await saveTemplate(t);
            await loadTemplates();
            redraw();
            toast(`Imported ${(data.templates || []).length} templates`);
          } catch { toast("That file is not a template export", { error: true }); }
        } } }, 'Import templates'))));
  },
};

// Turn references to a colour token into its literal value (before deleting it).
function freezeColour(c) {
  const ref = '@' + c.key;
  const fix = (o, k) => { if (o[k] === ref) o[k] = c.value; };
  const book = app.book;
  for (const it of book.items) {
    it.bg = it.bg.map((v) => (v === ref ? c.value : v));
    for (const el of it.elements) ['color', 'fill', 'stroke'].forEach((k) => fix(el, k));
  }
  ['spineColor', 'spineTextColor'].forEach((k) => fix(book.spec, k));
}

export async function addFontFiles(list) {
  const book = app.book;
  for (const f of list) {
    const base = f.name.replace(/\.[^.]+$/, '');
    const weight = /black|heavy/i.test(base) ? 900 : /extrabold|ultrabold/i.test(base) ? 800 : /bold/i.test(base) ? 700 : /semibold|demibold/i.test(base) ? 600 : /medium/i.test(base) ? 500 : /light/i.test(base) ? 300 : /thin|hairline/i.test(base) ? 100 : 400;
    const style = /italic|oblique/i.test(base) ? 'italic' : 'normal';
    const family = base.replace(/[-_ ]?(regular|bold|black|light|italic|medium|semibold|thin|heavy|oblique|soft|outline|rough)+$/gi, '').replace(/[-_]+/g, ' ').trim() || base;
    const asset = await importFont(f);
    // A file the theme already expects (e.g. fonts/BobbyJonesSoft.otf) keeps its family name.
    const known = book.fontFiles.find((x) => x.url && x.url.split('/').pop().toLowerCase() === f.name.toLowerCase());
    if (known) known.asset = asset;
    else book.fontFiles.push({ id: uid('ff'), family, weight, style, asset });
  }
  await registerFonts(book.fontFiles);
  commit('design');
  if (list.length) toast(`Added ${list.length} font file${list.length > 1 ? 's' : ''} — pick the family under Fonts`);
}
