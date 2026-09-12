/* ==========================================================================
   Supplier records
   ========================================================================== */
const SUPPLIER_FIELDS = [
  ['name','Full name'], ['company','Trading name'], ['role','Role'],
  ['email','Email'], ['phone','Phone'], ['country','Country'], ['city','City'],
  ['address','Address'], ['idNumber','ID / passport'], ['taxId','Tax / KRA PIN'],
  ['bank','Bank or M-PESA details'], ['rate','Standard rate'], ['currency','Currency'],
  ['status','Status'], ['notes','Notes']
];
function makeSupplier(over = {}){
  const base = { id: uid('sup'), status:'Active', currency:'USD', assignments:[], created: today() };
  SUPPLIER_FIELDS.forEach(([k]) => { if (base[k] === undefined) base[k] = ''; });
  return Object.assign(base, over);
}
function activeSupplier(){
  return S.suppliers.records.find(r => r.id === S.suppliers.activeId) || null;
}
function filteredSuppliers(){
  const q = String(S.suppliers.search || '').trim().toLowerCase();
  if (!q) return S.suppliers.records;
  return S.suppliers.records.filter(r =>
    ['name','company','role','email','phone','country','city','notes'].some(k => String(r[k] || '').toLowerCase().includes(q)));
}
function addSupplierFromAgreement(){
  const a = S.agreement;
  const name = String(a.supplier.name || '').trim();
  if (!name) return null;
  let rec = S.suppliers.records.find(r => r.name.toLowerCase() === name.toLowerCase());
  if (!rec){
    rec = makeSupplier({
      name, company: a.supplier.company, role: a.supplier.role, email: a.supplier.email,
      phone: a.supplier.phone, address: a.supplier.address, city: a.supplier.city, country: a.supplier.country,
      currency: a.currency
    });
    S.suppliers.records.push(rec);
  }
  rec.assignments = rec.assignments || [];
  if (!rec.assignments.some(x => x.reference === a.reference)){
    rec.assignments.push({
      reference: a.reference, title: a.title, project: a.project, client: a.clientPartner,
      date: a.date, fee: a.feeAmount, currency: a.currency, location: a.locations
    });
  }
  S.suppliers.activeId = rec.id;
  save();
  toast('Supplier and assignment recorded', 'good');
  return rec;
}

module('suppliers', {
  render(){
    const list = filteredSuppliers();
    const rec = activeSupplier();
    const i = rec ? S.suppliers.records.indexOf(rec) : -1;
    const active = S.suppliers.records.filter(r => r.status === 'Active').length;
    const assignments = S.suppliers.records.reduce((n, r) => n + (r.assignments || []).length, 0);

    return `
      ${pageHead({
        kicker:'Supplier operations',
        title:'Supplier Records',
        blurb:'A directory of freelancers, contractors and production suppliers with assignment history linked to Supplier Agreements.',
        actions:
          btn('Add supplier', { act:'supAdd', cls:'btn primary' }) +
          btn('Record current agreement', { act:'supFromAgreement' }) +
          btn('Export CSV', { act:'supCsv' }) +
          btn('Export JSON', { act:'supJson' })
      })}
      <div class="metricGrid" style="margin-bottom:14px">
        <div class="metric"><b>${S.suppliers.records.length}</b><span>suppliers</span></div>
        <div class="metric"><b>${active}</b><span>active suppliers</span></div>
        <div class="metric"><b>${assignments}</b><span>assignments logged</span></div>
        <div class="metric"><b>${list.length}</b><span>matching this search</span></div>
      </div>
      <div class="workspace railWide">
        <div class="panel sticky">
          <div class="panelHead"><b>Suppliers</b></div>
          <div class="panelBody" style="padding:9px 9px 0">
            <input type="search" data-model="suppliers.search" data-after="render" value="${esc(S.suppliers.search || '')}" placeholder="Search name, role, email, project">
          </div>
          <div class="railList scroll" style="max-height:calc(100vh - 320px)">
            ${list.length ? list.map(r => `
              <button class="railItem${rec && r.id === rec.id ? ' on' : ''}" data-act="supPick" data-id="${esc(r.id)}">
                <b>${esc(r.name || 'Unnamed supplier')}</b>
                <small>${esc(r.role || '—')}${r.country ? ' · ' + esc(r.country) : ''} · ${(r.assignments || []).length} assignment${(r.assignments || []).length === 1 ? '' : 's'}</small>
              </button>`).join('')
              : '<div class="empty">No supplier records match.</div>'}
          </div>
        </div>

        <div class="panel">
          ${rec ? `
            <div class="panelHead"><b>${esc(rec.name || 'Supplier record')}</b><span class="spacer"></span>
              ${btn('Delete', { act:'supDel', cls:'btn xs danger' })}</div>
            <div class="panelBody stack">
              <div class="grid3">
                ${SUPPLIER_FIELDS.filter(([k]) => !['notes','bank','address','status','currency'].includes(k))
                  .map(([k, label]) => field(label, input(`suppliers.records.${i}.${k}`, { after:'none' }))).join('')}
                ${field('Status', select(`suppliers.records.${i}.status`, ['Active','Paused','Archived','Blocked'], { after:'render' }))}
                ${field('Currency', select(`suppliers.records.${i}.currency`, CURRENCIES, { after:'none' }))}
              </div>
              ${field('Address', input(`suppliers.records.${i}.address`, { after:'none' }))}
              ${field('Bank or M-PESA details', textarea(`suppliers.records.${i}.bank`, { rows:3, after:'none' }))}
              ${field('Notes', textarea(`suppliers.records.${i}.notes`, { rows:3, after:'none' }))}
              <div class="panelHead" style="margin:6px -13px 0;border-top:1px solid var(--line)"><b>Assignment history</b><span class="spacer"></span><span class="tag">${(rec.assignments || []).length}</span></div>
              ${(rec.assignments || []).length ? `
                <div class="tableWrap" style="border:1px solid var(--line);border-radius:var(--r-s);max-height:260px">
                  <table class="data"><thead><tr><th>Reference</th><th>Title</th><th>Project</th><th>Date</th><th>Fee</th></tr></thead>
                  <tbody>${rec.assignments.map((a, n) => `<tr>
                    <td>${esc(a.reference)}</td><td>${esc(a.title)}</td><td>${esc(a.project || '—')}</td>
                    <td>${esc(a.date)}</td><td>${esc(a.fee ? money(a.fee, a.currency) : '—')}</td>
                  </tr>`).join('')}</tbody></table>
                </div>` : '<div class="empty">No assignments recorded yet. Open a Supplier Agreement and choose “Record supplier”.</div>'}
            </div>`
            : `<div class="panelBody"><div class="empty">Add a supplier, or record the supplier named on the current Supplier Agreement.</div></div>`}
        </div>
      </div>`;
  }
});

action('supPick', d => { S.suppliers.activeId = d.id; save(); renderView('suppliers'); });
action('supAdd', () => {
  const rec = makeSupplier({ name:'New supplier', role:'Photographer' });
  S.suppliers.records.push(rec);
  S.suppliers.activeId = rec.id;
  save(); renderView('suppliers');
});
action('supDel', () => confirmDialog('Delete this supplier record and its assignment history?', () => {
  S.suppliers.records = S.suppliers.records.filter(r => r.id !== S.suppliers.activeId);
  S.suppliers.activeId = S.suppliers.records[0] ? S.suppliers.records[0].id : '';
  save(); renderView('suppliers');
}, { yes:'Delete', danger:true }));
action('supFromAgreement', () => {
  if (!addSupplierFromAgreement()) return toast('Enter a supplier name on the Supplier Agreement first.', 'bad');
  renderView('suppliers');
});
action('supCsv', () => {
  const keys = SUPPLIER_FIELDS.map(([k]) => k).concat('assignments');
  const rows = S.suppliers.records.map(r => Object.assign({}, r, { assignments: (r.assignments || []).map(a => a.reference).join(' | ') }));
  dlText('Narretrieve_suppliers_' + today() + '.csv', 'text/csv', toCsv(rows, keys));
  toast('Supplier CSV downloaded', 'good');
});
action('supJson', () => dlText('Narretrieve_suppliers_' + today() + '.json', 'application/json', JSON.stringify(S.suppliers.records, null, 2)));
