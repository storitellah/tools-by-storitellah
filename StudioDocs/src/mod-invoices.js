/* ==========================================================================
   InvoYou — invoices, proforma invoices and quotations
   ========================================================================== */
function activeInvoice(){
  return S.invoices.docs.find(d => d.id === S.invoices.activeId) || S.invoices.docs[0];
}
function invoiceIndex(){ return Math.max(0, S.invoices.docs.findIndex(d => d.id === activeInvoice().id)); }
function invoiceTotals(d){
  const sub = (d.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const discount = Number(d.discount) || 0;
  const afterDiscount = Math.max(0, sub - discount);
  const tax = afterDiscount * ((Number(d.taxRate) || 0) / 100);
  return { sub, discount, tax, total: afterDiscount + tax };
}
const INVOICE_LABELS = {
  invoice:  { doc:'INVOICE',           num:'Invoice Number',  due:'Payment Due', amount:'Amount Due' },
  proforma: { doc:'PROFORMA INVOICE',  num:'Proforma Number', due:'Payment Due', amount:'Amount Due' },
  quote:    { doc:'QUOTATION',         num:'Quotation Number',due:'Valid Until', amount:'Quoted Total' }
};

function invoiceBlocks(){
  const d = activeInvoice();
  const i = invoiceIndex();
  const L = INVOICE_LABELS[d.type] || INVOICE_LABELS.invoice;
  const t = invoiceTotals(d);
  const p = `invoices.docs.${i}`;
  const B = [];

  B.push({ html: `<div class="docBlock partyGrid">
      <div class="party">
        <h5>From</h5>
        <b>${editable(`${p}.company.name`, { tag:'span', ph:'Your company' })}</b>
        <div>${editable(`${p}.company.address`, { tag:'div', ph:'Address', multi:true })}
          ${editable(`${p}.company.email`, { tag:'div', ph:'Email' })}
          ${editable(`${p}.company.website`, { tag:'div', ph:'Website' })}
          ${editable(`${p}.company.tax`, { tag:'div', ph:'Tax / PIN' })}</div>
      </div>
      <div class="party">
        <h5>Bill to</h5>
        <b>${editable(`${p}.client.name`, { tag:'span', ph:'Client name' })}</b>
        <div>${editable(`${p}.client.contact`, { tag:'div', ph:'Contact person' })}
          ${editable(`${p}.client.address`, { tag:'div', ph:'Client address', multi:true })}
          ${editable(`${p}.client.email`, { tag:'div', ph:'Client email' })}</div>
      </div>
    </div>` });

  B.push({ html: `<div class="docBlock metaStrip">
      <span><b>${esc(L.num)}:</b> ${editable(`${p}.number`, { tag:'span', ph:'—' })}</span>
      <span><b>Date:</b> ${editable(`${p}.date`, { tag:'span', ph:'—' })}</span>
      <span><b>${esc(L.due)}:</b> ${editable(`${p}.due`, { tag:'span', ph:'—' })}</span>
      <span><b>PO:</b> ${editable(`${p}.client.po`, { tag:'span', ph:'—' })}</span>
      <span><b>SO:</b> ${editable(`${p}.client.so`, { tag:'span', ph:'—' })}</span>
      <span><b>Currency:</b> ${esc(d.currency)}</span>
    </div>` });

  B.push({ html: `<div class="docBlock labelled"><h4>Project / assignment</h4>
      <p>${editable(`${p}.project`, { tag:'span', ph:'Project or assignment reference' })}</p></div>` });

  /* Line items are chunked so a long invoice paginates cleanly and every
     page keeps its column headings. */
  const items = d.items || [];
  const perChunk = 14;
  const chunks = items.length ? [] : [[]];
  for (let n = 0; n < items.length; n += perChunk) chunks.push(items.slice(n, n + perChunk).map((_, k) => n + k));
  chunks.forEach(idxs => {
    const rows = idxs.map(n => {
      const it = items[n];
      return `<tr>
        <td>${editable(`${p}.items.${n}.desc`, { tag:'span', ph:'Description of services', multi:true })}</td>
        <td class="num">${editable(`${p}.items.${n}.qty`, { tag:'span', ph:'1' })}</td>
        <td class="num">${esc(money(it.rate, d.currency))}</td>
        <td class="num">${esc(money((Number(it.qty) || 0) * (Number(it.rate) || 0), d.currency))}</td>
      </tr>`;
    }).join('');
    B.push({ html: `<div class="docBlock"><table class="docTable">
      <thead><tr><th>Services / items</th><th class="num">Days / qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" style="color:var(--pMuted)">No line items yet.</td></tr>'}</tbody>
    </table></div>` });
  });

  B.push({ html: `<div class="docBlock"><div class="totals">
      <div class="totalRow"><span>Subtotal</span><span>${esc(money(t.sub, d.currency))}</span></div>
      ${t.discount ? `<div class="totalRow"><span>Discount</span><span>− ${esc(money(t.discount, d.currency))}</span></div>` : ''}
      ${Number(d.taxRate) ? `<div class="totalRow"><span>${esc(d.taxLabel)} ${esc(String(d.taxRate))}%</span><span>${esc(money(t.tax, d.currency))}</span></div>` : ''}
      <div class="totalRow grand"><span>${esc(L.amount)}</span><span>${esc(money(t.total, d.currency))}</span></div>
    </div></div>` });

  B.push({ html: `<div class="docBlock" style="display:grid;grid-template-columns:1fr 1fr;gap:8mm">
      <div class="labelled"><h4>Payment / banking details</h4>${editable(`${p}.bank`, { tag:'p', ph:'Bank or M-PESA details', multi:true, style:'font-size:8.2pt' })}</div>
      <div class="labelled"><h4>Notes &amp; terms</h4>
        ${editable(`${p}.notes`, { tag:'p', ph:'Notes', multi:true, style:'font-size:8.2pt' })}
        ${editable(`${p}.terms`, { tag:'p', cls:'docMuted', ph:'Terms', multi:true, style:'font-size:8.2pt;margin-top:2mm' })}
      </div>
    </div>` });
  return B;
}
function invoicePages(){
  const d = activeInvoice();
  const i = invoiceIndex();
  const p = `invoices.docs.${i}`;
  const L = INVOICE_LABELS[d.type] || INVOICE_LABELS.invoice;
  const t = invoiceTotals(d);
  const head = `<div class="docHead ${presetDef(d.preset).head}">
      ${d.logoId ? `<img class="logo" src="${logoData(d.logoId)}" alt="">` : ''}
      <div class="titleBlock">
        <h3>${esc(L.doc)}</h3>
        <div class="ref">${editable(`${p}.number`, { tag:'span', ph:'Document number' })}</div>
        <div style="margin-top:2.4mm;font-size:7.4pt;font-weight:750;letter-spacing:.12em;text-transform:uppercase;color:var(--pMuted)">${esc(L.amount)}</div>
        <div style="font-size:17pt;font-weight:750;color:var(--pAccent);line-height:1.1">${esc(money(t.total, d.currency))}</div>
      </div></div>`;
  const foot = `<div class="docFoot"><span>${esc(d.company.name)}</span><span>${esc(L.doc)} ${esc(d.number)} · {{page}}</span></div>`;
  return paginate(invoiceBlocks(), {
    pageClass: presetClasses(d.preset, d.pageSize, d.density),
    style: presetStyle(d.preset, { accent: d.accent, labelColor: d.accent }),
    headHtml: head, footHtml: foot, autoFit: d.density === 'auto'
  });
}

module('invoices', {
  render(){
    const d = activeInvoice();
    const i = invoiceIndex();
    const L = INVOICE_LABELS[d.type] || INVOICE_LABELS.invoice;
    const p = `invoices.docs.${i}`;
    return `
      ${pageHead({
        kicker:'Finance documents',
        title:'InvoYou for Narretrieve',
        blurb:'Invoices, proforma invoices and quotations with stable editing, twenty layout presets and a custom colour system. Line items, totals and banking details are all editable on the page.',
        actions:
          btn('New invoice', { act:'invNew', data:{ type:'invoice' } }) +
          btn('New quotation', { act:'invNew', data:{ type:'quote' } }) +
          btn('New proforma', { act:'invNew', data:{ type:'proforma' } }) +
          btn('Duplicate', { act:'invDup' }) +
          btn('Export PDF', { act:'invPdf', cls:'btn primary' })
      })}
      <div class="workspace">
        <div class="panel sticky">
          <div class="panelHead"><b>Documents</b><span class="spacer"></span><span class="tag">${S.invoices.docs.length}</span></div>
          <div class="railList scroll" style="max-height:calc(100vh - 230px)">
            ${S.invoices.docs.map(x => {
              const lab = INVOICE_LABELS[x.type] || INVOICE_LABELS.invoice;
              return `<button class="railItem${x.id === d.id ? ' on' : ''}" data-act="invPick" data-id="${esc(x.id)}">
                <b>${esc(titleCase(x.type))} · ${esc(x.number)}</b>
                <small>${esc(x.client.name || 'No client')} · ${esc(money(invoiceTotals(x).total, x.currency))}</small>
              </button>`;
            }).join('')}
          </div>
        </div>

        ${stage('invStage', L.doc + ' ' + d.number, invoicePages(),
          btn('PNG', { act:'invPng', cls:'btn sm' }))}

        <div class="panel sticky scrollPane scroll">
          <div class="panelHead"><b>InvoYou editor</b></div>
          ${acc('Document', `<div class="stack">
            ${field('Document type', select(`${p}.type`, [['invoice','Invoice'],['proforma','Proforma invoice'],['quote','Quotation']], { after:'render' }))}
            <div class="grid2">
              ${field('Number', input(`${p}.number`, { after:'render' }))}
              ${field('Currency', select(`${p}.currency`, CURRENCIES, { after:'render' }))}
              ${field('Date', input(`${p}.date`, { type:'date', after:'render' }))}
              ${field(L.due, input(`${p}.due`, { type:'date', after:'render' }))}
            </div>
            ${field('Project / assignment', input(`${p}.project`, { after:'render' }))}
            <div class="grid2">
              ${field('Page size', select(`${p}.pageSize`, [['A4','A4'],['Letter','US Letter']], { after:'render' }))}
              ${field('Text density', select(`${p}.density`, DENSITIES, { after:'render' }))}
            </div>
          </div>`, true)}
          ${acc('Design preset', presetPicker(`${p}.preset`, INVOICE_PRESETS, { after:'render' }), true)}
          ${acc('Colour', `<div class="grid2">
            ${field('Accent', `<input type="color" data-model="${p}.accent" data-after="render" value="${esc(d.accent)}">`)}
            ${field('Secondary', `<input type="color" data-model="${p}.secondary" data-after="render" value="${esc(d.secondary)}">`)}
            ${field('Logo', `<select data-model="${p}.logoId" data-after="render">${logoOptions(d.logoId)}</select>`)}
          </div>`)}
          ${acc('From', `<div class="stack">
            ${field('Company', input(`${p}.company.name`, { after:'render' }))}
            ${field('Address', textarea(`${p}.company.address`, { rows:2, after:'render' }))}
            <div class="grid2">
              ${field('Email', input(`${p}.company.email`, { type:'email', after:'render' }))}
              ${field('Website', input(`${p}.company.website`, { after:'render' }))}
              ${field('Tax / PIN', input(`${p}.company.tax`, { after:'render' }))}
              ${field('Registration', input(`${p}.company.reg`, { after:'render' }))}
            </div>
          </div>`)}
          ${acc('Bill to', `<div class="stack">
            ${field('Client', input(`${p}.client.name`, { after:'render' }))}
            ${field('Contact person', input(`${p}.client.contact`, { after:'render' }))}
            ${field('Address', textarea(`${p}.client.address`, { rows:2, after:'render' }))}
            ${field('Email', input(`${p}.client.email`, { type:'email', after:'render' }))}
            <div class="grid2">
              ${field('PO number', input(`${p}.client.po`, { after:'render' }))}
              ${field('SO number', input(`${p}.client.so`, { after:'render' }))}
            </div>
          </div>`, true)}
          ${acc('Line items', `${listEditor(`${p}.items`, [
            { key:'desc', label:'Description', type:'textarea', rows:2 },
            { key:'qty', label:'Days / quantity' },
            { key:'rate', label:'Rate' }
          ], { addLabel:'Add line item' })}
          <div class="grid2" style="margin-top:10px">
            ${field('Discount', input(`${p}.discount`, { type:'number', after:'render' }))}
            ${field('Tax label', input(`${p}.taxLabel`, { after:'render' }))}
            ${field('Tax rate (%)', input(`${p}.taxRate`, { type:'number', after:'render' }))}
          </div>`, true)}
          ${acc('Payment & notes', `<div class="stack">
            ${field('Payment / banking details', textarea(`${p}.bank`, { rows:5, after:'render' }))}
            ${field('Notes', textarea(`${p}.notes`, { rows:2, after:'render' }))}
            ${field('Terms', textarea(`${p}.terms`, { rows:2, after:'render' }))}
          </div>`)}
          ${acc('Danger zone', `<div class="inline">${btn('Delete this document', { act:'invDel', cls:'btn sm danger' })}</div>`)}
        </div>
      </div>`;
  },
  preview(){
    const host = $('#invStage');
    if (!host) return;
    host.innerHTML = invoicePages();
    bindPane(host);
  },
  mounted(host){ bindPane($('#invStage')); fitStages(host); }
});

action('invPick', d => { S.invoices.activeId = d.id; save(); renderView('invoices'); });
action('invNew', d => {
  const doc = makeInvoice(d.type);
  S.invoices.docs.push(doc); S.invoices.activeId = doc.id;
  save(); renderView('invoices');
  toast(titleCase(d.type) + ' created', 'good');
});
action('invDup', () => {
  const src = activeInvoice();
  const doc = Object.assign(JSON.parse(JSON.stringify(src)), { id: uid('inv'), number: src.number + '-A' });
  S.invoices.docs.push(doc); S.invoices.activeId = doc.id;
  save(); renderView('invoices');
});
action('invDel', () => {
  if (S.invoices.docs.length <= 1) return toast('Keep at least one document.', 'bad');
  confirmDialog('Delete this document?', () => {
    S.invoices.docs = S.invoices.docs.filter(x => x.id !== S.invoices.activeId);
    S.invoices.activeId = S.invoices.docs[0].id;
    save(); renderView('invoices');
  }, { yes:'Delete', danger:true });
});
action('invPdf', () => {
  const d = activeInvoice();
  if (d.type !== 'quote' && !String(d.client.po || '').trim() && !String(d.client.so || '').trim()){
    return confirmDialog('This document has no PO or SO number. Export anyway?', () =>
      guard(exportPdf(pagesIn('invStage'), 'Narretrieve_' + d.number, d.pageSize)), { yes:'Export anyway' });
  }
  guard(exportPdf(pagesIn('invStage'), 'Narretrieve_' + d.number, d.pageSize));
});
action('invPng', () => guard(exportPng(pagesIn('invStage'), 'Narretrieve_' + activeInvoice().number)));
