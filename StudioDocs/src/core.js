/* ==========================================================================
   StudioDocs core — state, binding, paper rendering and exports.
   ========================================================================== */
'use strict';

const APP_VERSION = '26.0';
const STORE_KEY = 'studiodocs.narretrieve.v26';
const LEGACY_KEYS = ['studiodocs_narretrieve_state_v14', 'studiodocs_narretrieve_vault_v2'];

const BRAND = { coral:'#CF7752', terracotta:'#B7674B', navy:'#172A36', ink:'#231F20', paper:'#F8F8F8', white:'#FFFFFF' };

/* ---------- small utilities ---------------------------------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
function nl2br(s){ return esc(s).replace(/\n/g, '<br>'); }
function uid(prefix = 'id'){
  return prefix + '_' + Array.from(crypto.getRandomValues(new Uint32Array(2))).join('');
}
function clamp(n, a, b){ n = Number(n); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a; }
function today(){ return new Date().toISOString().slice(0, 10); }
function year(){ return new Date().getFullYear(); }
function addDays(iso, days){
  const d = new Date(iso || today());
  if (Number.isNaN(d.getTime())) return today();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}
function money(n, cur = 'USD'){
  const v = Number(n);
  const num = (Number.isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const sym = { USD:'$', EUR:'€', GBP:'£', KES:'KSh ', CHF:'CHF ', CAD:'CA$', AUD:'A$', ZAR:'R ', JPY:'¥' }[cur];
  return sym ? sym + num : cur + ' ' + num;
}
function safeHttpUrl(s){
  try { const u = new URL(String(s).trim()); return ['http:','https:'].includes(u.protocol) ? u.href : ''; }
  catch { return ''; }
}
function safeTel(s){ return String(s || '').replace(/[^+0-9]/g, ''); }
function safeMail(s){
  const t = String(s || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : '';
}
function cleanFilename(s){
  return String(s || 'document')
    .replace(/[^a-z0-9._-]+/gi, '_')
    .replace(/\.{2,}/g, '.')      /* no directory traversal fragments */
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 120) || 'document';
}
function titleCase(s){ return String(s || '').replace(/\b[a-z]/g, c => c.toUpperCase()); }

/* ---------- downloads ---------------------------------------------------- */
function dlBytes(name, type, bytes){
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const dlText = (name, type, text) => dlBytes(name, type, new TextEncoder().encode(text));

/* ---------- toasts ------------------------------------------------------- */
function toast(msg, kind = ''){
  const host = $('#toasts');
  if (!host) return;
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, 2600);
}

/* ---------- path access -------------------------------------------------- */
function getPath(obj, path){
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, value){
  const keys = String(path).split('.');
  const last = keys.pop();
  let cur = obj;
  for (const k of keys){
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = /^\d+$/.test(k) ? [] : {};
    cur = cur[k];
  }
  cur[last] = value;
  return obj;
}

/* ---------- state -------------------------------------------------------- */
let S = null;
let saveTimer = null;

function logoById(id){
  return allLogos().find(l => l.id === id) || allLogos()[0];
}
function allLogos(){
  return LOGOS.concat((S && S.brand && S.brand.customLogos) || []);
}
function logoData(id){ const l = logoById(id); return l ? l.data : ''; }
function emailLogoData(id){ return LOGOS_EMAIL[id] || logoData(id); }
function logoOptions(sel){
  return allLogos().map(l => `<option value="${esc(l.id)}"${l.id === sel ? ' selected' : ''}>${esc(l.name)}</option>`).join('');
}

function save(){
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
    setSaveState('Saved locally');
  } catch (e){
    setSaveState('Storage full — export a backup', true);
  }
}
function scheduleSave(){
  setSaveState('Saving…', false, true);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 420);
}
function setSaveState(text, bad = false, busy = false){
  const chip = $('#saveChip'), label = $('#saveText');
  if (!chip || !label) return;
  label.textContent = text;
  chip.classList.toggle('saving', !!busy || !!bad);
}
function loadState(){
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch { /* private mode */ }
  if (raw){
    try { return migrate(JSON.parse(raw)); } catch { /* fall through to defaults */ }
  }
  return migrate(defaultState());
}
function resetState(){
  try { localStorage.removeItem(STORE_KEY); LEGACY_KEYS.forEach(k => localStorage.removeItem(k)); } catch {}
  S = migrate(defaultState());
  save();
}

/* ---------- generic form / inline binding -------------------------------- */
/*
   data-model="path"            two-way bound input / select / textarea
   data-model-type="number"     coerce on write
   data-model-type="checkbox"   uses .checked
   data-edit="path"             contenteditable text bound to a state path
   data-edit-multi="1"          preserves newlines
   data-ph="…"                  placeholder shown when the value is empty
   data-after="preview|render"  what to refresh after the change (default preview)
*/
function bindPane(root, ctx){
  if (!root) return;
  $$('[data-model]', root).forEach(elm => {
    if (elm.__bound) return;
    elm.__bound = true;
    const path = elm.dataset.model;
    const type = elm.dataset.modelType || (elm.type === 'checkbox' ? 'checkbox' : 'text');
    const after = elm.dataset.after || 'preview';
    const evt = (elm.tagName === 'SELECT' || type === 'checkbox' || elm.type === 'date' || elm.type === 'color') ? 'change' : 'input';
    elm.addEventListener(evt, () => {
      let v;
      if (type === 'checkbox') v = elm.checked;
      else if (type === 'number') v = elm.value === '' ? '' : Number(elm.value);
      else v = elm.value;
      setPath(S, path, v);
      scheduleSave();
      refresh(after, ctx);
    });
  });

  $$('[data-edit]', root).forEach(elm => {
    if (elm.__bound) return;
    elm.__bound = true;
    const path = elm.dataset.edit;
    const multi = elm.dataset.editMulti === '1';
    elm.setAttribute('contenteditable', CE_MODE);
    elm.setAttribute('spellcheck', 'true');
    elm.setAttribute('role', 'textbox');
    if (multi) elm.setAttribute('aria-multiline', 'true');
    markEmpty(elm);
    elm.addEventListener('input', () => {
      const v = multi ? elm.innerText.replace(/ /g, ' ') : elm.textContent.replace(/\s+/g, ' ').replace(/ /g, ' ');
      setPath(S, path, v);
      markEmpty(elm);
      scheduleSave();
      softRefresh(ctx);
    });
    elm.addEventListener('blur', () => {
      const after = elm.dataset.after;
      if (after) refresh(after, ctx);
    });
    elm.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && !multi){ ev.preventDefault(); elm.blur(); }
      if (ev.key === 'Escape') elm.blur();
    });
    elm.addEventListener('paste', ev => {
      ev.preventDefault();
      const text = (ev.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, multi ? text : text.replace(/\s*\n\s*/g, ' '));
    });
  });

  $$('[data-act]', root).forEach(elm => {
    if (elm.__bound) return;
    elm.__bound = true;
    elm.addEventListener('click', ev => {
      const fn = ACTIONS[elm.dataset.act];
      if (fn) { ev.preventDefault(); fn(elm.dataset, elm, ev); }
    });
  });
}
function markEmpty(elm){
  const empty = !String(elm.textContent || '').trim();
  elm.classList.toggle('isEmpty', empty && !!elm.dataset.ph);
}

/* Registry of small declarative click handlers used by rendered markup. */
/* Firefox only gained contenteditable="plaintext-only" recently; fall back to
   a normal editable region (the paste handler already inserts plain text). */
const CE_MODE = (() => {
  const probe = document.createElement('div');
  try { probe.setAttribute('contenteditable', 'plaintext-only'); } catch { return 'true'; }
  return probe.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true';
})();

const ACTIONS = Object.create(null);
function action(name, fn){ ACTIONS[name] = fn; }

/* Refresh coordination ---------------------------------------------------- */
let softTimer = null;
function refresh(kind, ctx){
  if (kind === 'none') return;
  const mod = MODULES[activeView];
  if (!mod) return;
  if (kind === 'render') renderView(activeView);
  else if (kind === 'preview' && mod.preview) withFocus(() => mod.preview());
  else if (mod.preview) withFocus(() => mod.preview());
}
function softRefresh(ctx){
  clearTimeout(softTimer);
  softTimer = setTimeout(() => {
    const mod = MODULES[activeView];
    syncInputs();
    if (mod && mod.soft) mod.soft();
    updateNavCounts();
  }, 260);
}
/* Push state back into every bound form control that is not being typed in,
   so editing text directly on a document keeps the side panel in step. */
function syncInputs(){
  const active = document.activeElement;
  $$('[data-model]').forEach(elm => {
    if (elm === active) return;
    const v = getPath(S, elm.dataset.model);
    if (elm.type === 'checkbox'){
      const next = !!v;
      if (elm.checked !== next) elm.checked = next;
    } else {
      const next = v == null ? '' : String(v);
      if (elm.value !== next) elm.value = next;
    }
  });
}

/* Re-render while keeping the caret where the user left it. */
function withFocus(fn){
  const a = document.activeElement;
  const key = a && (a.dataset?.model || a.dataset?.edit);
  const isText = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
  const selStart = isText ? a.selectionStart : null;
  const selEnd = isText ? a.selectionEnd : null;
  const scroller = $$('.scrollPane,.stage').map(e => [e, e.scrollTop, e.scrollLeft]);
  fn();
  scroller.forEach(([e, t, l]) => { if (document.contains(e)) { e.scrollTop = t; e.scrollLeft = l; } });
  if (!key) return;
  const next = document.querySelector(`[data-model="${CSS.escape(key)}"],[data-edit="${CSS.escape(key)}"]`);
  if (!next || next === a) return;
  try {
    next.focus({ preventScroll: true });
    if (isText && selStart != null && next.setSelectionRange) next.setSelectionRange(selStart, selEnd);
  } catch {}
}

/* ---------- routing ------------------------------------------------------ */
const MODULES = Object.create(null);
const NAV = [
  { label:'', items:[['dashboard','Dashboard']] },
  { label:'Identity', items:[
    ['signatures','Email Signatures'], ['cards','Business Cards'],
    ['letterhead','Branded Letterhead'], ['brand','Brand & Logos'] ] },
  { label:'Agreements & documents', items:[
    ['agreements','Supplier Agreements'], ['production','Production Documents'],
    ['consent','Consent Studio'], ['specs','Capture Specifications'] ] },
  { label:'Finance', items:[
    ['invoices','InvoYou'], ['supplierinv','Supplier Invoicing'] ] },
  { label:'Operations', items:[
    ['suppliers','Supplier Records'], ['equipment','Equipment Register'], ['packet','Supplier Packet'] ] },
  { label:'System', items:[['security','Data & Security']] }
];
let activeView = 'dashboard';

function module(id, def){ MODULES[id] = def; }

function renderNav(){
  const host = $('#nav');
  host.innerHTML = NAV.map(group => `
    <div class="navGroup">
      ${group.label ? `<h5>${esc(group.label)}</h5>` : ''}
      ${group.items.map(([id, label]) => `
        <button class="navBtn${id === activeView ? ' on' : ''}" data-nav="${id}">
          <span class="navText">${esc(label)}</span>
          <span class="count hidden" data-count="${id}">0</span>
        </button>`).join('')}
    </div>`).join('');
  $$('[data-nav]', host).forEach(b => b.addEventListener('click', () => {
    go(b.dataset.nav);
    document.body.classList.remove('navOpen');
  }));
  updateNavCounts();
}
function updateNavCounts(){
  const counts = {
    suppliers: (S.suppliers?.records || []).length,
    equipment: (S.equipment || []).length,
    consent:   (S.consent?.releases || []).length,
    invoices:  (S.invoices?.docs || []).length,
    production:(S.production?.docs || []).length
  };
  $$('[data-count]').forEach(elm => {
    const n = counts[elm.dataset.count];
    elm.classList.toggle('hidden', !n);
    if (n) elm.textContent = n > 999 ? '999+' : String(n);
  });
}
function go(id){
  if (!MODULES[id]) id = 'dashboard';
  activeView = id;
  $$('.navBtn').forEach(b => b.classList.toggle('on', b.dataset.nav === id));
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + id));
  const title = NAV.flatMap(g => g.items).find(i => i[0] === id);
  $('#topTitle').textContent = title ? title[1] : 'StudioDocs';
  try { location.hash = id; } catch {}
  renderView(id);
  const view = $('#v-' + id);
  if (view) view.scrollTop = 0;
  window.scrollTo({ top: 0 });
}
function renderView(id){
  const mod = MODULES[id];
  const host = $('#v-' + id);
  if (!mod || !host) return;
  host.innerHTML = mod.render();
  bindPane(host);
  if (mod.mounted) mod.mounted(host);
  updateNavCounts();
}

/* ---------- shared markup helpers ---------------------------------------- */
function pageHead({ kicker, title, blurb, actions = '' }){
  return `<div class="pageHead">
    <div class="headText">
      <div class="kicker">${esc(kicker)}</div>
      <h2>${esc(title)}</h2>
      <p>${esc(blurb)}</p>
    </div>
    <div class="pageActions">${actions}</div>
  </div>`;
}
function btn(label, opts = {}){
  const { act = '', cls = 'btn', data = {}, id = '', title = '' } = opts;
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button class="${cls}"${id ? ` id="${id}"` : ''}${act ? ` data-act="${esc(act)}"` : ''}${attrs}${title ? ` title="${esc(title)}"` : ''}>${esc(label)}</button>`;
}
function field(label, control, hint = ''){
  return `<label class="field"><span class="fieldLabel">${esc(label)}</span>${control}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</label>`;
}
function input(path, opts = {}){
  const { type = 'text', ph = '', after = 'preview', list = '' } = opts;
  const v = getPath(S, path);
  return `<input type="${type}" data-model="${esc(path)}" data-after="${after}"${type === 'number' ? ' data-model-type="number"' : ''} value="${esc(v ?? '')}" placeholder="${esc(ph)}"${list ? ` list="${esc(list)}"` : ''}>`;
}
function textarea(path, opts = {}){
  const { ph = '', rows = 3, after = 'preview' } = opts;
  return `<textarea rows="${rows}" data-model="${esc(path)}" data-after="${after}" placeholder="${esc(ph)}">${esc(getPath(S, path) ?? '')}</textarea>`;
}
function select(path, options, opts = {}){
  const { after = 'preview' } = opts;
  const v = getPath(S, path);
  const opt = options.map(o => {
    const [val, lab] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(lab)}</option>`;
  }).join('');
  return `<select data-model="${esc(path)}" data-after="${after}">${opt}</select>`;
}
function checkbox(path, label, opts = {}){
  const { after = 'preview' } = opts;
  return `<label class="checkrow"><input type="checkbox" data-model="${esc(path)}" data-model-type="checkbox" data-after="${after}"${getPath(S, path) ? ' checked' : ''}><span>${esc(label)}</span></label>`;
}
function acc(title, body, open = false){
  return `<div class="acc${open ? ' open' : ''}">
    <button class="accHead" data-act="toggleAcc">${esc(title)}
      <svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5L8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="accBody">${body}</div>
  </div>`;
}
action('toggleAcc', (_d, elm) => elm.parentElement.classList.toggle('open'));

function presetPicker(path, presets, opts = {}){
  const cur = getPath(S, path);
  const after = opts.after || 'preview';
  return `<div class="presetBar">${select(path, presets, { after })}</div>
    <div class="presetGrid scroll">${presets.map(([id, label]) => `
      <button class="presetTile${id === cur ? ' on' : ''}" data-act="setPreset" data-path="${esc(path)}" data-value="${esc(id)}" data-after="${after}">${esc(label)}</button>`).join('')}
    </div>`;
}
action('setPreset', d => { setPath(S, d.path, d.value); scheduleSave(); renderView(activeView); });

function editable(path, opts = {}){
  const { tag = 'span', cls = '', ph = '', multi = false, style = '' } = opts;
  const raw = getPath(S, path);
  const v = raw == null ? '' : String(raw);
  const empty = !v.trim();
  return `<${tag} class="${cls}${empty && ph ? ' isEmpty' : ''}" data-edit="${esc(path)}"${multi ? ' data-edit-multi="1"' : ''}${ph ? ` data-ph="${esc(ph)}"` : ''}${style ? ` style="${esc(style)}"` : ''}>${multi ? nl2br(v) : esc(v)}</${tag}>`;
}
/* Underlined form line used by the printable forms. */
function fLine(label, path, ph = 'Click to enter'){
  return `<div class="fLine"><span>${esc(label)}</span>${editable(path, { tag:'div', cls:'val', ph })}</div>`;
}

/* Zoom control shared by every document stage. */
function stage(id, title, body, actions = ''){
  return `<div class="stageWrap">
    <div class="stageBar noPrint">
      <span class="title">${esc(title)}</span>
      <span class="spacer"></span>
      <span class="editHint"><i class="dot"></i>Click any text on the page to edit it</span>
      ${actions}
      <span class="zoom">
        <button class="btn xs" data-act="zoom" data-dir="out" title="Zoom out">−</button>
        <span class="zoomVal" data-zoomval="${esc(id)}">100%</span>
        <button class="btn xs" data-act="zoom" data-dir="in" title="Zoom in">+</button>
        <button class="btn xs" data-act="zoom" data-dir="fit" title="Fit width">Fit</button>
      </span>
    </div>
    <div class="stage scroll" data-stage="${esc(id)}"><div class="stageInner" id="${esc(id)}">${body}</div></div>
  </div>`;
}
const ZOOM = Object.create(null);
action('zoom', (d, elm) => {
  const wrap = elm.closest('.stageWrap');
  const pane = $('.stage', wrap);
  const inner = $('.stageInner', wrap);
  const key = pane.dataset.stage;
  let z = ZOOM[key] ?? 1;
  if (d.dir === 'in') z = Math.min(2, z + 0.1);
  else if (d.dir === 'out') z = Math.max(0.3, z - 0.1);
  else {
    const page = $('.page,.cardFace,.sigPaper', inner);
    const avail = pane.clientWidth - 48;
    z = page ? Math.min(1, avail / page.offsetWidth) : 1;
  }
  applyZoom(pane, inner, key, z);
});
function applyZoom(pane, inner, key, z){
  ZOOM[key] = z;
  inner.style.transform = z === 1 ? '' : `scale(${z})`;
  inner.style.width = z === 1 ? '' : (100 / z) + '%';
  const label = $(`[data-zoomval="${CSS.escape(key)}"]`);
  if (label) label.textContent = Math.round(z * 100) + '%';
}
/* Fit any stage whose page is wider than the available space. */
function fitStages(host){
  $$('.stage', host).forEach(pane => {
    const inner = $('.stageInner', pane);
    const key = pane.dataset.stage;
    if (!inner || ZOOM[key] != null) { if (inner && ZOOM[key] != null) applyZoom(pane, inner, key, ZOOM[key]); return; }
    const page = $('.page,.cardFace,.sigPaper', inner);
    if (!page) return;
    const avail = pane.clientWidth - 48;
    if (page.offsetWidth > avail) applyZoom(pane, inner, key, Math.max(0.3, avail / page.offsetWidth));
  });
}

/* ---------- paper presets ------------------------------------------------ */
/* One structural page renderer; presets only supply CSS custom properties
   and a header archetype, so every preset is guaranteed to lay out. */
const PRESET_BASE = {
  head:'h-split', font:'sans', accent:BRAND.coral, title:{}, rule:1, paper:'#FFFFFF', extra:''
};
const FONTS = {
  sans:   '"Inter","Poppins",Arial,Helvetica,sans-serif',
  serif:  'Georgia,"Times New Roman",Times,serif',
  slab:   '"Iowan Old Style","Palatino Linotype",Georgia,serif',
  grotesk:'"Helvetica Neue",Helvetica,Arial,sans-serif',
  mono:   'ui-monospace,"SF Mono",Menlo,Consolas,monospace'
};
const DOC_PRESETS = {
  'classic-contract':    { head:'h-center', font:'serif', title:{ case:'uppercase', size:'17pt', weight:700, track:'.04em' } },
  'legal-serif':         { head:'h-stack',  font:'serif', title:{ case:'uppercase', size:'15pt', weight:700, track:'.08em' }, rule:0.7 },
  'editorial-rule':      { head:'h-rule',   font:'sans',  title:{ size:'23pt', weight:700, track:'-.025em' } },
  'letterhead':          { head:'h-split',  font:'sans',  title:{ size:'17pt', weight:600 }, rule:2.4 },
  'modern-grid':         { head:'h-boxed',  font:'grotesk', title:{ size:'18pt', weight:650, case:'uppercase', track:'.02em' } },
  'board-paper':         { head:'h-stack',  font:'slab',  title:{ size:'19pt', weight:700 }, rule:1.6 },
  'production-brief':    { head:'h-boxed',  font:'sans',  title:{ size:'17pt', weight:700, case:'uppercase', track:'.05em' } },
  'newsroom-contract':   { head:'h-stack',  font:'serif', title:{ size:'26pt', weight:700, track:'-.03em' }, rule:3 },
  'documentary-contract':{ head:'h-band',   font:'sans',  title:{ size:'19pt', weight:650 } },
  'monochrome-formal':   { head:'h-center', font:'grotesk', accent:'#231F20', title:{ case:'uppercase', size:'15pt', track:'.14em', weight:700 }, rule:0.7 },
  'clause-ledger':       { head:'h-split',  font:'mono',  title:{ size:'14pt', weight:700, case:'uppercase', track:'.08em' }, rule:0.7 },
  'two-column-parties':  { head:'h-split',  font:'sans',  title:{ size:'19pt', weight:650 } },
  'compact-counsel':     { head:'h-stack',  font:'serif', title:{ size:'14pt', weight:700, case:'uppercase', track:'.1em' }, rule:0.7, extra:'dense' },
  'signature-focus':     { head:'h-center', font:'sans',  title:{ size:'21pt', weight:600 }, rule:0.7 },
  'archive-contract':    { head:'h-boxed',  font:'mono',  title:{ size:'13pt', weight:700, case:'uppercase', track:'.12em' }, rule:0.7 },
  'field-agreement':     { head:'h-boxed',  font:'sans',  title:{ size:'16pt', weight:700, case:'uppercase', track:'.06em' } },
  'minimal-contract':    { head:'h-stack',  font:'sans',  accent:'#5F5853', title:{ size:'18pt', weight:500, track:'-.02em' }, rule:0.6 },
  'counsel-index':       { head:'h-stack',  font:'serif', title:{ size:'16pt', weight:700, case:'uppercase', track:'.06em' }, rule:2, extra:'side-index' },
  'editorial-contract':  { head:'h-side',   font:'serif', title:{ size:'20pt', weight:700 }, rule:3 },
  'field-production':    { head:'h-rule',   font:'grotesk', title:{ size:'17pt', weight:700, case:'uppercase', track:'.05em' } },
  'minimal-rule':        { head:'h-rule',   font:'sans',  accent:'#231F20', title:{ size:'20pt', weight:500, track:'-.025em' }, rule:0.6 },

  /* Invoice presets */
  'coral-ledger':   { head:'h-split', font:'sans', title:{ size:'25pt', weight:700, case:'uppercase', track:'.02em' }, rule:1.6 },
  'newsroom':       { head:'h-stack', font:'serif', title:{ size:'27pt', weight:700, track:'-.03em' }, rule:2.6 },
  'editorial-white':{ head:'h-split', font:'sans', accent:'#231F20', title:{ size:'22pt', weight:600 }, rule:0.7 },
  'navy-block':     { head:'h-band', font:'sans', accent:BRAND.navy, title:{ size:'22pt', weight:700, case:'uppercase', track:'.04em' } },
  'minimal-line':   { head:'h-stack', font:'sans', accent:'#5F5853', title:{ size:'20pt', weight:500 }, rule:0.6 },
  'statement':      { head:'h-center', font:'serif', title:{ size:'19pt', weight:700, case:'uppercase', track:'.12em' }, rule:1 },
  'feature':        { head:'h-side', font:'slab', title:{ size:'24pt', weight:700 }, rule:2 },
  'monochrome':     { head:'h-split', font:'grotesk', accent:'#231F20', title:{ size:'20pt', weight:700, case:'uppercase', track:'.1em' }, rule:0.7 },
  'column':         { head:'h-stack', font:'sans', title:{ size:'21pt', weight:650 }, rule:1.2 },
  'dispatch':       { head:'h-boxed', font:'mono', title:{ size:'15pt', weight:700, case:'uppercase', track:'.1em' }, rule:0.7 },
  'magazine':       { head:'h-center', font:'slab', title:{ size:'30pt', weight:700, track:'-.03em' }, rule:2 },
  'newsprint':      { head:'h-stack', font:'serif', paper:'#FBF9F4', title:{ size:'26pt', weight:700, case:'uppercase', track:'.02em' }, rule:2.4 },
  'coral-side':     { head:'h-rule', font:'sans', title:{ size:'22pt', weight:650 }, rule:1.4 },
  'executive':      { head:'h-split', font:'serif', accent:BRAND.navy, title:{ size:'20pt', weight:700, case:'uppercase', track:'.08em' }, rule:1.4 },
  'borderless':     { head:'h-stack', font:'sans', accent:'#6E6660', title:{ size:'19pt', weight:500, track:'-.02em' }, rule:0 },
  'slate':          { head:'h-band', font:'grotesk', accent:'#2E3A3F', title:{ size:'21pt', weight:650 } },
  'archive':        { head:'h-boxed', font:'mono', title:{ size:'14pt', weight:700, case:'uppercase', track:'.14em' }, rule:0.7 },
  'studio-grid':    { head:'h-boxed', font:'grotesk', title:{ size:'18pt', weight:650, case:'uppercase', track:'.03em' } },
  'receipt':        { head:'h-center', font:'mono', title:{ size:'14pt', weight:700, case:'uppercase', track:'.2em' }, rule:0.6, extra:'dense' },
  'letterpress':    { head:'h-center', font:'slab', paper:'#FCFAF7', title:{ size:'23pt', weight:700, track:'.02em' }, rule:1.6 },

  /* Consent / release document presets */
  'editorial':     { head:'h-split', font:'sans', title:{ size:'21pt', weight:700, track:'-.02em' }, rule:1.4 },
  'institutional': { head:'h-center', font:'serif', accent:BRAND.navy, title:{ size:'18pt', weight:700, case:'uppercase', track:'.06em' }, rule:1.2 },
  'humanitarian':  { head:'h-stack', font:'sans', title:{ size:'20pt', weight:650 }, rule:1.2, extra:'roomy' },
  'documentary':   { head:'h-band', font:'sans', title:{ size:'19pt', weight:650 } },
  'legal':         { head:'h-stack', font:'serif', title:{ size:'16pt', weight:700, case:'uppercase', track:'.08em' }, rule:0.7 },
  'minimal':       { head:'h-rule', font:'sans', accent:'#231F20', title:{ size:'20pt', weight:500, track:'-.02em' }, rule:0.6 },
  'partner':       { head:'h-boxed', font:'sans', title:{ size:'17pt', weight:650 } },
  'signature':     { head:'h-center', font:'sans', title:{ size:'21pt', weight:600 }, rule:0.7 },
  'field':         { head:'h-boxed', font:'grotesk', title:{ size:'16pt', weight:700, case:'uppercase', track:'.06em' } },
  'classic':       { head:'h-center', font:'serif', title:{ size:'18pt', weight:700, case:'uppercase', track:'.05em' }, rule:1 },
  'modern':        { head:'h-boxed', font:'grotesk', title:{ size:'18pt', weight:650 } },
  'archive-record':{ head:'h-boxed', font:'mono', title:{ size:'13pt', weight:700, case:'uppercase', track:'.13em' }, rule:0.7 },

  /* Production document presets */
  'ngo':    { head:'h-center', font:'serif', accent:BRAND.navy, title:{ size:'17pt', weight:700, case:'uppercase', track:'.06em' }, rule:1.2 },
  'brief':  { head:'h-rule', font:'grotesk', title:{ size:'18pt', weight:700, case:'uppercase', track:'.04em' } },

  /* Capture specification presets */
  'editorial-brief': { head:'h-split', font:'sans', title:{ size:'20pt', weight:700, track:'-.02em' }, rule:1.6 },
  'field-brief':     { head:'h-boxed', font:'grotesk', title:{ size:'16pt', weight:700, case:'uppercase', track:'.05em' } },
  'technical-sheet': { head:'h-stack', font:'mono', title:{ size:'14pt', weight:700, case:'uppercase', track:'.1em' }, rule:0.7 },
  'studio-brief':    { head:'h-center', font:'slab', title:{ size:'21pt', weight:700 }, rule:1.4 }
};
function presetDef(id){ return Object.assign({}, PRESET_BASE, DOC_PRESETS[id] || {}); }
function presetStyle(id, overrides = {}){
  const d = presetDef(id);
  const t = d.title || {};
  const accent = overrides.accent || d.accent;
  const vars = {
    '--pAccent': accent,
    '--pPaper': overrides.paper || d.paper,
    '--pBody': FONTS[d.font] || FONTS.sans,
    '--pDisplay': FONTS[(t.font || d.font)] || FONTS.sans,
    '--pTitleSize': t.size || '20pt',
    '--pTitleWeight': String(t.weight || 700),
    '--pTitleCase': t.case || 'none',
    '--pTitleTrack': t.track || '-.01em',
    '--pRuleW': (d.rule || 0.001) + 'pt',
    '--pRuleColor': d.rule >= 2 ? accent : '#231F20',
    '--pLabelColor': overrides.labelColor || accent
  };
  if (overrides.ink) vars['--pInk'] = overrides.ink;
  /* Escaped because the font stacks contain double quotes and this string is
     always interpolated into a style="" attribute. */
  return esc(Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';'));
}
function presetClasses(id, size = 'A4', density = 'standard'){
  const d = presetDef(id);
  const dens = density === 'compact' ? 'dense' : density === 'relaxed' ? 'roomy' : '';  /* "auto" resolves during pagination */
  return ['page', size === 'Letter' ? 'letter' : '', d.extra || '', dens].filter(Boolean).join(' ');
}
const DENSITIES = [['auto','Fit automatically'], ['compact','Compact'], ['standard','Standard'], ['relaxed','Relaxed']];
function docHeadHtml(id, inner){
  return `<div class="docHead ${presetDef(id).head}">${inner}</div>`;
}

/* ---------- pagination --------------------------------------------------- */
/* Measure rendered blocks, then pack them into as many pages as they need —
   never more. Blocks are `{html, keepWith}` strings. */
/* Measure how a given set of blocks packs onto pages of one page class. */
function packPages(blocks, pageClass, style, headHtml, footHtml){
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;z-index:-1';
  probe.innerHTML = `<div class="${pageClass}" style="${style};box-shadow:none;transform:none">
      ${headHtml || ''}<div class="docBody" data-probe-body></div>${footHtml || ''}</div>`;
  document.body.appendChild(probe);

  const pageEl = probe.firstElementChild;
  const bodyEl = $('[data-probe-body]', probe);
  /* The real body stretches to fill the page; the probe body must not, or
     every block would measure as one full page. */
  bodyEl.style.cssText = 'flex:0 0 auto;height:auto;min-height:0';

  const cs = getComputedStyle(pageEl);
  const outer = el => {
    if (!el) return 0;
    const s2 = getComputedStyle(el);
    return el.offsetHeight + parseFloat(s2.marginTop || 0) + parseFloat(s2.marginBottom || 0);
  };
  const pageH = parseFloat(cs.minHeight) || pageEl.offsetHeight;
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const headH = headHtml ? outer($('.docHead', pageEl)) : 0;
  const footH = footHtml ? outer($('.docFoot', pageEl)) : 0;
  const gap = parseFloat(getComputedStyle(bodyEl).rowGap) || 0;
  const avail = Math.max(80, pageH - padY - headH - footH);

  const heights = blocks.map(b => { bodyEl.innerHTML = b.html; return bodyEl.offsetHeight; });

  const pages = [];
  let cur = [], used = 0;
  blocks.forEach((b, i) => {
    const withGap = cur.length ? heights[i] + gap : heights[i];
    if (cur.length && used + withGap > avail){ pages.push(cur); cur = [i]; used = heights[i]; }
    else { cur.push(i); used += withGap; }
  });
  pages.push(cur);

  /* Verification pass: measure each page exactly as it will render and push
     the trailing block forward until nothing overflows. */
  const measure = idxs => { bodyEl.innerHTML = idxs.map(i => blocks[i].html).join(''); return bodyEl.offsetHeight; };
  for (let n = 0; n < pages.length; n++){
    let guard = 0;
    while (pages[n].length > 1 && measure(pages[n]) > avail && guard++ < 200){
      const moved = pages[n].pop();
      if (!pages[n + 1]) pages.push([]);
      pages[n + 1].unshift(moved);
    }
  }
  probe.remove();

  const live = pages.filter(x => x.length);
  return live.length ? live : [[]];
}

/* Lay blocks out across as many pages as they actually need — never more.
   With density "auto" the tightest setting that saves a page is used. */
function paginate(blocks, { pageClass, style, headHtml, footHtml, spine, autoFit }){
  if (!blocks.length) blocks = [{ html:'' }];

  let cls = pageClass;
  let pages = packPages(blocks, pageClass, style, headHtml, footHtml);
  if (autoFit && pages.length > 1){
    const tighter = packPages(blocks, pageClass + ' dense', style, headHtml, footHtml);
    if (tighter.length < pages.length){ pages = tighter; cls = pageClass + ' dense'; }
  }

  return pages.map((idxs, i) => `
    <div class="${cls}" style="${style}"${spine ? ` data-spine="${esc(spine)}"` : ''}>
      ${headHtml || ''}
      <div class="docBody">${idxs.map(x => blocks[x].html).join('')}</div>
      ${(footHtml || '').replace('{{page}}', `${i + 1} / ${pages.length}`)}
    </div>`).join('');
}

/* ---------- rasterisation and exports ------------------------------------ */
function collectCss(){
  return $$('style').map(s => s.textContent).join('\n');
}
async function nodeToCanvas(node, scale = 2.6){
  const rect = node.getBoundingClientRect();
  const w = Math.max(1, Math.round(node.offsetWidth || rect.width));
  const h = Math.max(1, Math.round(node.offsetHeight || rect.height));

  const clone = node.cloneNode(true);
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.width = w + 'px';
  clone.style.minHeight = h + 'px';
  clone.style.transform = 'none';
  $$('[contenteditable]', clone).forEach(e => e.removeAttribute('contenteditable'));
  /* On-screen placeholders are drawn with ::before from data-ph; drop the
     attribute so an empty field exports as a blank ruled line, not as the
     words "Click to enter". */
  $$('[data-ph]', clone).forEach(e => {
    e.classList.remove('isEmpty');
    e.removeAttribute('data-ph');
  });
  $$('.noPrint', clone).forEach(e => e.remove());

  /* foreignObject content must be well-formed XML, so serialise through
     XMLSerializer rather than innerHTML — void elements such as <img> are
     otherwise left unclosed and the whole SVG fails to parse. */
  const wrapper = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
  const styleEl = document.createElementNS('http://www.w3.org/1999/xhtml', 'style');
  styleEl.textContent = collectCss();
  wrapper.appendChild(styleEl);
  wrapper.appendChild(clone);
  const inner = new XMLSerializer().serializeToString(wrapper);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * scale)}" height="${Math.round(h * scale)}" viewBox="0 0 ${w} ${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${inner}</foreignObject></svg>`;
  /* A data: URL is used rather than a blob: URL because a blob carries an
     opaque origin on file:// pages, which taints the canvas and blocks
     toDataURL / toBlob. */
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error('Could not rasterise this page in this browser.'));
      img.src = url;
    });
    if (img.decode) { try { await img.decode(); } catch {} }
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext('2d', { alpha:false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
}
function canvasBlob(canvas, type = 'image/png', q){
  return new Promise(res => canvas.toBlob(res, type, q));
}
async function exportPng(nodes, name){
  const list = Array.isArray(nodes) ? nodes : [nodes];
  if (!list.length) return toast('Nothing to export.', 'bad');
  for (let i = 0; i < list.length; i++){
    const c = await nodeToCanvas(list[i], 3);
    const blob = await canvasBlob(c, 'image/png');
    dlBytes(cleanFilename(name + (list.length > 1 ? '_' + (i + 1) : '')) + '.png', 'image/png', blob);
  }
  toast(list.length > 1 ? list.length + ' images downloaded' : 'PNG downloaded', 'good');
}
const PT = { A4:{ w:595.28, h:841.89 }, Letter:{ w:612, h:792 }, A5:{ w:419.53, h:595.28 } };
async function exportPdf(nodes, name, size = 'A4'){
  const list = Array.isArray(nodes) ? nodes : [nodes];
  if (!list.length) return toast('Nothing to export.', 'bad');
  const pages = [];
  for (const node of list){
    const c = await nodeToCanvas(node, 2.6);
    const r = node.getBoundingClientRect();
    const pt = PT[size] || PT.A4;
    const ratio = r.height / r.width;
    const widthPt = pt.w;
    const heightPt = Math.round(widthPt * ratio * 100) / 100;
    pages.push({ data: c.toDataURL('image/jpeg', 0.94), widthPt, heightPt: Math.max(heightPt, 1), pxW: c.width, pxH: c.height });
  }
  dlBytes(cleanFilename(name) + '.pdf', 'application/pdf', buildPdf(pages));
  toast('PDF downloaded', 'good');
}
function asciiBytes(s){
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 255;
  return out;
}
function concatBytes(parts){
  const n = parts.reduce((s, p) => s + p.length, 0);
  const o = new Uint8Array(n);
  let off = 0;
  parts.forEach(p => { o.set(p, off); off += p.length; });
  return o;
}
function dataUrlBytes(url){
  const bin = atob(String(url).split(',')[1]);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
function buildPdf(pages){
  const objects = [];
  const pageRefs = [];
  const add = parts => { objects.push(parts); return objects.length; };
  const cat = add([]), pagesObj = add([]);
  pages.forEach((pg, i) => {
    const jpg = dataUrlBytes(pg.data);
    const im = add([
      asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${pg.pxW} /Height ${pg.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`),
      jpg, asciiBytes('\nendstream')
    ]);
    const cs = `q\n${pg.widthPt} 0 0 ${pg.heightPt} 0 0 cm\n/Im${i} Do\nQ`;
    const content = add([asciiBytes(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`)]);
    pageRefs.push(add([asciiBytes(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pg.widthPt} ${pg.heightPt}] /Resources << /XObject << /Im${i} ${im} 0 R >> >> /Contents ${content} 0 R >>`)]));
  });
  objects[cat - 1] = [asciiBytes(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`)];
  objects[pagesObj - 1] = [asciiBytes(`<< /Type /Pages /Kids [${pageRefs.map(n => n + ' 0 R').join(' ')}] /Count ${pageRefs.length} >>`)];
  const parts = [asciiBytes('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')];
  let offset = parts[0].length;
  const offs = [0];
  objects.forEach((obj, i) => {
    offs.push(offset);
    const head = asciiBytes(`${i + 1} 0 obj\n`), body = concatBytes(obj), foot = asciiBytes('\nendobj\n');
    parts.push(head, body, foot);
    offset += head.length + body.length + foot.length;
  });
  const xref = offset;
  let xs = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offs.length; i++) xs += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  xs += `trailer\n<< /Size ${objects.length + 1} /Root ${cat} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  parts.push(asciiBytes(xs));
  return concatBytes(parts);
}
function pagesIn(hostId){ return $$('#' + hostId + ' .page, #' + hostId + ' .cardFace'); }
async function guard(promise){
  try { await promise; }
  catch (e){ console.error(e); toast(e.message || 'Export failed', 'bad'); }
}

/* ---------- CSV ---------------------------------------------------------- */
function csvCell(v){
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function toCsv(rows, keys){
  return [keys.map(csvCell).join(','), ...rows.map(r => keys.map(k => csvCell(r[k])).join(','))].join('\r\n');
}
function parseCsv(text){
  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/).filter(x => x.trim());
  if (!lines.length) return [];
  const row = l => {
    const out = []; let s = '', q = false;
    for (let i = 0; i < l.length; i++){
      const ch = l[i];
      if (ch === '"'){ if (q && l[i + 1] === '"'){ s += '"'; i++; } else q = !q; }
      else if (ch === ',' && !q){ out.push(s); s = ''; }
      else s += ch;
    }
    out.push(s);
    return out;
  };
  const head = row(lines[0]).map(x => x.trim());
  return lines.slice(1, 5001).map(l => {
    const vals = row(l), o = {};
    head.forEach((h, i) => o[h] = vals[i] ?? '');
    return o;
  });
}

/* ---------- ZIP (stored, no compression) --------------------------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++){
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes){
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
const le16 = n => new Uint8Array([n & 255, (n >>> 8) & 255]);
const le32 = n => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
function zipBuild(files){
  const enc = new TextEncoder();
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files){
    const name = enc.encode(f.name);
    const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
    const crc = crc32(data);
    const local = concatBytes([le32(0x04034b50), le16(20), le16(0x0800), le16(0), le16(time), le16(date),
      le32(crc), le32(data.length), le32(data.length), le16(name.length), le16(0), name, data]);
    locals.push(local);
    centrals.push(concatBytes([le32(0x02014b50), le16(20), le16(20), le16(0x0800), le16(0), le16(time), le16(date),
      le32(crc), le32(data.length), le32(data.length), le16(name.length), le16(0), le16(0), le16(0), le16(0),
      le32(0), le32(offset), name]));
    offset += local.length;
  }
  const cdir = concatBytes(centrals), localBytes = concatBytes(locals);
  const end = concatBytes([le32(0x06054b50), le16(0), le16(0), le16(files.length), le16(files.length),
    le32(cdir.length), le32(localBytes.length), le16(0)]);
  return concatBytes([localBytes, cdir, end]);
}
async function sha256Hex(bytes){
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- signature pad ------------------------------------------------ */
function openSignaturePad({ title, subtitle, onSave }){
  const host = $('#modalHost');
  host.innerHTML = `<div class="overlay" data-pad>
    <div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h3>${esc(title)}</h3>
      <p>${esc(subtitle || 'Sign with a mouse, trackpad, pen or finger. The drawing is stored only in this workspace.')}</p>
      <div class="padWrap"><canvas id="padCanvas"></canvas></div>
      <div class="dialogActions">
        <button class="btn" data-pad-act="undo">Undo</button>
        <button class="btn" data-pad-act="clear">Clear</button>
        <button class="btn ghost" data-pad-act="cancel">Cancel</button>
        <button class="btn primary" data-pad-act="save">Apply signature</button>
      </div>
    </div></div>`;
  const canvas = $('#padCanvas');
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 2.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1B1819';
  let strokes = [], current = null;

  const point = ev => {
    const r = canvas.getBoundingClientRect();
    const p = ev.touches ? ev.touches[0] : ev;
    return [p.clientX - r.left, p.clientY - r.top];
  };
  const redraw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1B1819';
    strokes.forEach(st => {
      ctx.beginPath();
      st.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      if (st.length === 1) ctx.lineTo(st[0][0] + 0.4, st[0][1] + 0.4);
      ctx.stroke();
    });
  };
  redraw();
  const down = ev => { ev.preventDefault(); current = [point(ev)]; strokes.push(current); redraw(); };
  const move = ev => { if (!current) return; ev.preventDefault(); current.push(point(ev)); redraw(); };
  const up = () => { current = null; };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);

  const close = () => { window.removeEventListener('pointerup', up); host.innerHTML = ''; };
  $$('[data-pad-act]', host).forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.padAct;
    if (a === 'undo'){ strokes.pop(); redraw(); }
    else if (a === 'clear'){ strokes = []; redraw(); }
    else if (a === 'cancel') close();
    else if (a === 'save'){
      if (!strokes.length) return toast('Draw a signature first.', 'bad');
      const out = document.createElement('canvas');
      out.width = canvas.width; out.height = canvas.height;
      const octx = out.getContext('2d');
      octx.drawImage(canvas, 0, 0);
      const trimmed = trimCanvas(out);
      onSave(trimmed.toDataURL('image/png'));
      close();
    }
  }));
  $('[data-pad]', host).addEventListener('mousedown', ev => { if (ev.target.dataset.pad !== undefined) close(); });
  document.addEventListener('keydown', function esckey(ev){
    if (ev.key === 'Escape'){ close(); document.removeEventListener('keydown', esckey); }
  });
}
function trimCanvas(c){
  const ctx = c.getContext('2d');
  const { width: w, height: h } = c;
  const data = ctx.getImageData(0, 0, w, h).data;
  let top = h, left = w, right = 0, bottom = 0, found = false;
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const i = (y * w + x) * 4;
      if (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235){
        found = true;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (!found) return c;
  const pad = 8;
  top = Math.max(0, top - pad); left = Math.max(0, left - pad);
  bottom = Math.min(h - 1, bottom + pad); right = Math.min(w - 1, right + pad);
  const out = document.createElement('canvas');
  out.width = right - left + 1; out.height = bottom - top + 1;
  const octx = out.getContext('2d');
  octx.fillStyle = '#fff'; octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(c, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/* ---------- confirm dialog ----------------------------------------------- */
function confirmDialog(message, onYes, { yes = 'Confirm', danger = false } = {}){
  const host = $('#modalHost');
  host.innerHTML = `<div class="overlay" data-confirm>
    <div class="dialog" style="max-width:440px" role="alertdialog" aria-modal="true">
      <h3>Please confirm</h3>
      <p>${esc(message)}</p>
      <div class="dialogActions">
        <button class="btn ghost" data-c="no">Cancel</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-c="yes">${esc(yes)}</button>
      </div></div></div>`;
  const close = () => host.innerHTML = '';
  $('[data-c="no"]', host).onclick = close;
  $('[data-c="yes"]', host).onclick = () => { close(); onYes(); };
}

/* ---------- file helpers ------------------------------------------------- */
function pickFile(accept, onLoad, as = 'text'){
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = accept;
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => onLoad(fr.result, f);
    if (as === 'dataurl') fr.readAsDataURL(f);
    else if (as === 'buffer') fr.readAsArrayBuffer(f);
    else fr.readAsText(f);
  };
  inp.click();
}
function pickFiles(accept, onLoad){
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = accept;
  inp.multiple = true;
  inp.onchange = async () => {
    const files = Array.from(inp.files || []);
    for (const f of files){
      const buf = await f.arrayBuffer();
      onLoad(new Uint8Array(buf), f);
    }
  };
  inp.click();
}

/* ---------- boot --------------------------------------------------------- */
function boot(){
  S = loadState();
  $('#brandMark').src = logoData(S.brand.defaultLogoId);
  $('#verLabel').textContent = 'StudioDocs v' + APP_VERSION;
  renderNav();
  $('#navToggle').addEventListener('click', () => document.body.classList.toggle('navOpen'));
  document.body.classList.add('editOn');
  const hash = String(location.hash || '').replace('#', '');
  go(MODULES[hash] ? hash : 'dashboard');
  window.addEventListener('hashchange', () => {
    const h = String(location.hash || '').replace('#', '');
    if (MODULES[h] && h !== activeView) go(h);
  });
  window.addEventListener('beforeunload', () => { if (saveTimer){ clearTimeout(saveTimer); save(); } });
  save();
}

/* ---------- repeatable list editor --------------------------------------- */
/* `shape` is 'text' for arrays of strings, or an array of field descriptors
   [{key, label, type, rows}] for arrays of objects. */
function listEditor(path, shape, opts = {}){
  const arr = getPath(S, path) || [];
  const { addLabel = 'Add item', ph = '', multiline = false, rows: textRows = 3 } = opts;
  const rows = arr.map((row, i) => {
    const body = shape === 'text'
      ? (multiline
        ? `<textarea rows="${textRows}" data-model="${esc(path)}.${i}" placeholder="${esc(ph)}" data-after="preview">${esc(row ?? '')}</textarea>`
        : `<input type="text" data-model="${esc(path)}.${i}" value="${esc(row ?? '')}" placeholder="${esc(ph)}" data-after="preview">`)
      : `<div class="stack" style="flex:1 1 auto;min-width:0">${shape.map(f => f.type === 'textarea'
          ? `<textarea rows="${f.rows || 2}" data-model="${esc(path)}.${i}.${f.key}" placeholder="${esc(f.label)}" data-after="preview">${esc(row[f.key] ?? '')}</textarea>`
          : `<input type="text" data-model="${esc(path)}.${i}.${f.key}" value="${esc(row[f.key] ?? '')}" placeholder="${esc(f.label)}" data-after="preview">`).join('')}</div>`;
    return `<div class="listRow" data-list-row="${i}">
      <button class="grab" title="Drag to reorder" draggable="true" data-list-grab="${esc(path)}" data-index="${i}">⠿</button>
      ${body}
      <button class="btn xs danger rm" data-act="listRemove" data-path="${esc(path)}" data-index="${i}" title="Remove">✕</button>
    </div>`;
  }).join('');
  return `<div class="listEd" data-list="${esc(path)}">${rows || '<div class="empty">Nothing here yet.</div>'}
    <button class="btn sm" data-act="listAdd" data-path="${esc(path)}" data-shape="${shape === 'text' ? 'text' : 'object'}"
      data-keys="${shape === 'text' ? '' : esc(shape.map(f => f.key).join(','))}">${esc(addLabel)}</button>
  </div>`;
}
action('listAdd', d => {
  const arr = getPath(S, d.path) || [];
  arr.push(d.shape === 'text' ? '' : Object.fromEntries(String(d.keys).split(',').map(k => [k, ''])));
  setPath(S, d.path, arr);
  scheduleSave(); renderView(activeView);
});
action('listRemove', d => {
  const arr = getPath(S, d.path) || [];
  arr.splice(Number(d.index), 1);
  scheduleSave(); renderView(activeView);
});
/* Drag-to-reorder for list editors. */
document.addEventListener('dragstart', ev => {
  const grab = ev.target.closest && ev.target.closest('[data-list-grab]');
  if (!grab) return;
  ev.dataTransfer.effectAllowed = 'move';
  ev.dataTransfer.setData('text/plain', grab.dataset.listGrab + '|' + grab.dataset.index);
  grab.closest('.listRow').classList.add('dragging');
});
document.addEventListener('dragend', () => $$('.listRow').forEach(r => r.classList.remove('dragging', 'dropTarget')));
document.addEventListener('dragover', ev => {
  const row = ev.target.closest && ev.target.closest('.listRow');
  if (!row) return;
  ev.preventDefault();
  $$('.listRow').forEach(r => r.classList.toggle('dropTarget', r === row));
});
document.addEventListener('drop', ev => {
  const row = ev.target.closest && ev.target.closest('.listRow');
  if (!row) return;
  ev.preventDefault();
  const [path, from] = String(ev.dataTransfer.getData('text/plain')).split('|');
  const to = Number(row.dataset.listRow);
  const arr = getPath(S, path);
  if (!Array.isArray(arr) || Number.isNaN(to)) return;
  const [moved] = arr.splice(Number(from), 1);
  arr.splice(to, 0, moved);
  scheduleSave(); renderView(activeView);
});

/* ---------- table cell editor for fixed-width grids ---------------------- */
function gridEditor(path, labels){
  const rows = getPath(S, path) || [];
  return `<div class="listEd" data-list="${esc(path)}">
    ${rows.map((row, i) => `<div class="listRow" data-list-row="${i}" style="align-items:stretch">
      <button class="grab" draggable="true" data-list-grab="${esc(path)}" data-index="${i}" title="Drag to reorder">⠿</button>
      <div style="flex:1 1 auto;display:grid;grid-template-columns:1fr 1fr;gap:5px;min-width:0">
        ${labels.map((lab, c) => `<input type="text" data-model="${esc(path)}.${i}.${c}" value="${esc(row[c] ?? '')}" placeholder="${esc(lab)}" data-after="preview">`).join('')}
      </div>
      <button class="btn xs danger rm" data-act="listRemove" data-path="${esc(path)}" data-index="${i}">✕</button>
    </div>`).join('') || '<div class="empty">No line items yet.</div>'}
    <button class="btn sm" data-act="gridAdd" data-path="${esc(path)}" data-cols="${labels.length}">Add line</button>
  </div>`;
}
action('gridAdd', d => {
  const arr = getPath(S, d.path) || [];
  arr.push(new Array(Number(d.cols)).fill(''));
  setPath(S, d.path, arr);
  scheduleSave(); renderView(activeView);
});
