/* ==========================================================================
   Equipment register
   ========================================================================== */
const EQ_COLUMNS = [
  ['id','Asset ID'], ['category','Category'], ['brand','Brand'], ['name','Item'],
  ['quantity','Qty'], ['serial','Serial'], ['condition','Condition'], ['status','Status'],
  ['location','Location'], ['assigned','Assigned to'], ['nextService','Next service']
];
function eqFiltered(){
  const ui = S.equipmentUi;
  const q = String(ui.search || '').trim().toLowerCase();
  return S.equipment.filter(e => {
    if (ui.category && e.category !== ui.category) return false;
    if (ui.status && e.status !== ui.status) return false;
    if (!q) return true;
    return ['id','brand','name','serial','location','assigned','notes','category'].some(k => String(e[k] || '').toLowerCase().includes(q));
  });
}
function eqActive(){
  return S.equipment.find(e => e.id === S.equipmentUi.activeId) || null;
}
function nextAssetId(){
  const nums = S.equipment.map(e => Number(String(e.id).replace(/\D+/g, ''))).filter(Number.isFinite);
  return 'NRT-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
}
function eqStatusTag(status){
  const s = String(status || '');
  const cls = s === 'Available' ? 'ok' : /Repair|Lost/.test(s) ? 'warn' : s ? 'coral' : '';
  return `<span class="tag ${cls}">${esc(s || '—')}</span>`;
}

module('equipment', {
  render(){
    const rows = eqFiltered();
    const rec = eqActive();
    const i = rec ? S.equipment.indexOf(rec) : -1;
    const ui = S.equipmentUi;
    const cats = Array.from(new Set(S.equipment.map(e => e.category).filter(Boolean))).sort();

    return `
      ${pageHead({
        kicker:'Production assets',
        title:'Equipment Register',
        blurb:'Track cameras, lenses, sound, lighting and computers with assignment status, service dates and storage locations.',
        actions:
          btn('Add equipment', { act:'eqAdd', cls:'btn primary' }) +
          btn('Import CSV', { act:'eqImport' }) +
          btn('CSV template', { act:'eqTemplate' }) +
          btn('Export CSV', { act:'eqCsv' }) +
          btn('Export JSON', { act:'eqJson' })
      })}
      <div class="panel" style="margin-bottom:12px">
        <div class="panelBody" style="display:grid;grid-template-columns:minmax(0,2fr) 1fr 1fr auto;gap:9px;align-items:end">
          ${field('Search', `<input type="search" data-model="equipmentUi.search" data-after="render" value="${esc(ui.search || '')}" placeholder="Asset, brand, serial, location or notes">`)}
          ${field('Category', `<select data-model="equipmentUi.category" data-after="render"><option value="">All categories</option>${cats.map(c => `<option value="${esc(c)}"${c === ui.category ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>`)}
          ${field('Status', `<select data-model="equipmentUi.status" data-after="render"><option value="">All statuses</option>${EQ_STATUSES.map(c => `<option value="${esc(c)}"${c === ui.status ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>`)}
          ${btn('Clear', { act:'eqClear', cls:'btn' })}
        </div>
      </div>

      <div class="workspace tableFirst">
        <div class="panel">
          <div class="panelHead"><b>Assets</b><span class="spacer"></span><span class="tag">${rows.length} of ${S.equipment.length}</span></div>
          <div class="tableWrap scroll">
            <table class="data">
              <thead><tr>${EQ_COLUMNS.map(([, label]) => `<th>${esc(label)}</th>`).join('')}</tr></thead>
              <tbody>
                ${rows.length ? rows.map(e => `<tr data-act="eqPick" data-id="${esc(e.id)}"${rec && e.id === rec.id ? ' class="on"' : ''}>
                  ${EQ_COLUMNS.map(([k]) => `<td>${k === 'status' ? eqStatusTag(e[k]) : esc(e[k] ?? '')}</td>`).join('')}
                </tr>`).join('')
                : `<tr><td colspan="${EQ_COLUMNS.length}"><div class="empty" style="border:0;background:none">No assets match these filters.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel sticky scrollPane scroll">
          ${rec ? `
            <div class="panelHead"><b>${esc(rec.id)}</b><span class="spacer"></span>${btn('Delete', { act:'eqDel', cls:'btn xs danger' })}</div>
            <div class="panelBody stack">
              ${field('Asset ID', input(`equipment.${i}.id`, { after:'render' }))}
              ${field('Item', input(`equipment.${i}.name`, { after:'render' }))}
              <div class="grid2">
                ${field('Category', `<select data-model="equipment.${i}.category" data-after="render">${EQ_CATEGORIES.map(c => `<option value="${esc(c)}"${c === rec.category ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>`)}
                ${field('Brand', input(`equipment.${i}.brand`, { after:'render' }))}
                ${field('Quantity', input(`equipment.${i}.quantity`, { type:'number', after:'render' }))}
                ${field('Serial', input(`equipment.${i}.serial`, { after:'render' }))}
                ${field('Condition', `<select data-model="equipment.${i}.condition" data-after="render">${EQ_CONDITIONS.map(c => `<option value="${esc(c)}"${c === rec.condition ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>`)}
                ${field('Status', `<select data-model="equipment.${i}.status" data-after="render">${EQ_STATUSES.map(c => `<option value="${esc(c)}"${c === rec.status ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>`)}
                ${field('Ownership', `<select data-model="equipment.${i}.ownership" data-after="render">${EQ_OWNERSHIP.map(c => `<option value="${esc(c)}"${c === rec.ownership ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>`)}
                ${field('Location', input(`equipment.${i}.location`, { after:'render' }))}
              </div>
              ${field('Assigned to', input(`equipment.${i}.assigned`, { after:'render' }))}
              <div class="grid2">
                ${field('Checked out', input(`equipment.${i}.checkout`, { type:'date', after:'render' }))}
                ${field('Expected return', input(`equipment.${i}.expectedReturn`, { type:'date', after:'render' }))}
                ${field('Purchase date', input(`equipment.${i}.purchaseDate`, { type:'date', after:'render' }))}
                ${field('Supplier', input(`equipment.${i}.supplier`, { after:'render' }))}
                ${field('Value', input(`equipment.${i}.value`, { type:'number', after:'render' }))}
                ${field('Currency', select(`equipment.${i}.currency`, CURRENCIES, { after:'render' }))}
                ${field('Warranty expiry', input(`equipment.${i}.warrantyExpiry`, { type:'date', after:'render' }))}
                ${field('Last service', input(`equipment.${i}.lastService`, { type:'date', after:'render' }))}
                ${field('Next service', input(`equipment.${i}.nextService`, { type:'date', after:'render' }))}
              </div>
              ${field('Notes', textarea(`equipment.${i}.notes`, { rows:3, after:'render' }))}
            </div>`
            : `<div class="panelHead"><b>Asset editor</b></div><div class="panelBody"><div class="empty">Select an equipment row to edit its full asset record.</div></div>`}
        </div>
      </div>`;
  }
});

action('eqPick', d => { S.equipmentUi.activeId = d.id; save(); renderView('equipment'); });
action('eqClear', () => {
  Object.assign(S.equipmentUi, { search:'', category:'', status:'' });
  save(); renderView('equipment');
});
action('eqAdd', () => {
  const e = Object.fromEntries(EQ_KEYS.map(k => [k, '']));
  Object.assign(e, { id: nextAssetId(), category:'Photo Cameras', quantity:1, condition:'Good', status:'Available', ownership:'Company', currency:'USD', name:'New asset' });
  S.equipment.unshift(e);
  S.equipmentUi.activeId = e.id;
  save(); renderView('equipment');
});
action('eqDel', () => confirmDialog('Delete this asset from the register?', () => {
  S.equipment = S.equipment.filter(e => e.id !== S.equipmentUi.activeId);
  S.equipmentUi.activeId = '';
  save(); renderView('equipment');
}, { yes:'Delete', danger:true }));
action('eqCsv', () => {
  dlText('Narretrieve_equipment_' + today() + '.csv', 'text/csv', toCsv(S.equipment, EQ_KEYS));
  toast('Equipment CSV downloaded', 'good');
});
action('eqJson', () => dlText('Narretrieve_equipment_' + today() + '.json', 'application/json', JSON.stringify(S.equipment, null, 2)));
action('eqTemplate', () => dlText('Narretrieve_equipment_template.csv', 'text/csv',
  toCsv([Object.fromEntries(EQ_KEYS.map(k => [k, k === 'id' ? 'NRT-0001' : k === 'quantity' ? '1' : '']))], EQ_KEYS)));
action('eqImport', () => pickFile('.csv,text/csv', text => {
  const rows = parseCsv(text);
  if (!rows.length) return toast('That CSV had no rows.', 'bad');
  let added = 0, updated = 0;
  rows.forEach(row => {
    const rec = Object.fromEntries(EQ_KEYS.map(k => [k, row[k] ?? '']));
    if (!rec.id) rec.id = nextAssetId();
    const existing = S.equipment.findIndex(e => e.id === rec.id);
    if (existing >= 0){ Object.assign(S.equipment[existing], rec); updated++; }
    else { S.equipment.push(rec); added++; }
  });
  save(); renderView('equipment');
  toast(`${added} added, ${updated} updated`, 'good');
}));
