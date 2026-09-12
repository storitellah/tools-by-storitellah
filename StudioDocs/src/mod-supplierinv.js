/* ==========================================================================
   Supplier invoicing & payment details — printable one-page form
   ========================================================================== */
function supplierGuideBlocks(){
  const B = [];
  B.push({ html: `<div class="docBlock">${editable('supplierGuide.intro', { tag:'p', cls:'docLead', ph:'Introduction', multi:true })}</div>` });

  B.push({ html: `<div class="docBlock labelled">
    <h4>${editable('supplierGuide.invoiceToLabel', { tag:'span', ph:'Invoice to' })}</h4>
    ${editable('supplierGuide.invoiceTo', { tag:'div', ph:'Billing address', multi:true, style:'font-size:8.6pt;line-height:1.55' })}
  </div>` });

  B.push({ html: `<div class="docBlock labelled">
    <h4>Supplier details</h4>
    <div class="fGrid">
      ${fLine('Name / legal name', 'supplierGuide.supplierName')}
      ${fLine('Date', 'supplierGuide.supplierDate')}
    </div>
    <div class="fGrid c1" style="margin-top:3.6mm">${fLine('Address', 'supplierGuide.supplierAddress')}</div>
    <div class="fGrid" style="margin-top:3.6mm">
      ${fLine('Email', 'supplierGuide.supplierEmail')}
      ${fLine('Phone', 'supplierGuide.supplierPhone')}
      ${fLine('Invoice number', 'supplierGuide.invoiceNumber')}
      ${fLine('PO / SO number', 'supplierGuide.poNumber')}
    </div>
  </div>` });

  B.push({ html: `<div class="docBlock labelled">
    <h4>Invoice requirements</h4>
    ${editable('supplierGuide.requirements', { tag:'p', ph:'Invoice requirements', multi:true })}
  </div>` });

  B.push({ html: `<div class="docBlock" style="display:grid;grid-template-columns:1fr 1fr;gap:7mm">
    <div>
      <h4 style="font-size:7.8pt;letter-spacing:.12em;text-transform:uppercase;color:var(--pLabelColor);margin-bottom:1.6mm">Kenyan suppliers</h4>
      ${editable('supplierGuide.kenyaNote', { tag:'p', ph:'Guidance', multi:true, style:'font-size:8.2pt;margin-bottom:3mm' })}
      <div class="fGrid c1">
        ${fLine('M-PESA registered name', 'supplierGuide.mpesaName')}
        ${fLine('M-PESA number', 'supplierGuide.mpesaNumber')}
        ${fLine('Bank / account name', 'supplierGuide.bankAccountName')}
        ${fLine('Account number / branch', 'supplierGuide.bankAccountNumber')}
        ${fLine('KRA PIN', 'supplierGuide.kraPin')}
      </div>
    </div>
    <div>
      <h4 style="font-size:7.8pt;letter-spacing:.12em;text-transform:uppercase;color:var(--pLabelColor);margin-bottom:1.6mm">International suppliers</h4>
      <div class="fGrid c1">
        ${fLine('Beneficiary / account name', 'supplierGuide.intlBeneficiary')}
        ${fLine('Bank name', 'supplierGuide.intlBank')}
        ${fLine('Account number / IBAN', 'supplierGuide.intlAccount')}
        ${fLine('SWIFT / BIC code', 'supplierGuide.intlSwift')}
        ${fLine('Bank address', 'supplierGuide.intlBankAddress')}
        ${fLine('Sort / routing code', 'supplierGuide.intlRouting')}
      </div>
    </div>
  </div>` });

  B.push({ html: `<div class="docBlock labelled">
    <h4>Submitting the invoice</h4>
    ${editable('supplierGuide.submission', { tag:'p', ph:'Submission instructions', multi:true })}
  </div>` });
  return B;
}
function supplierGuidePages(){
  const d = S.supplierGuide;
  const head = `<div class="docHead ${presetDef(d.preset).head}">
      ${d.logoId ? `<img class="logo" src="${logoData(d.logoId)}" alt="">` : ''}
      <div class="titleBlock">
        <div class="org">Supplier administration</div>
        <h3>${editable('supplierGuide.title', { tag:'span', ph:'Document title' })}</h3>
        <div class="ref">${editable('supplierGuide.reference', { tag:'span', ph:'Reference' })} · ${editable('supplierGuide.date', { tag:'span', ph:'Date' })}</div>
      </div></div>`;
  const foot = `<div class="docFoot">
      <span>${editable('supplierGuide.note', { tag:'span', ph:'Footer note' })}</span>
      <span>${esc(COMPANY.name)} · {{page}}</span></div>`;
  return paginate(supplierGuideBlocks(), {
    pageClass: presetClasses(d.preset, d.pageSize, d.density), style: presetStyle(d.preset),
    headHtml: head, footHtml: foot, autoFit: d.density === 'auto'
  });
}

module('supplierinv', {
  render(){
    const d = S.supplierGuide;
    return `
      ${pageHead({
        kicker:'Supplier administration',
        title:'Supplier Invoicing & Payment Details',
        blurb:'A professional one-page form to send to suppliers before they invoice Narretrieve. Every label, paragraph and underlined field on the page is editable in place.',
        actions: btn('Reset page', { act:'sgReset' }) + btn('PNG', { act:'sgPng' }) + btn('Export PDF', { act:'sgPdf', cls:'btn primary' })
      })}
      <div class="workspace noRail">
        ${stage('sgStage', 'Supplier invoicing form · ' + d.pageSize, supplierGuidePages())}
        <div class="panel sticky scrollPane scroll">
          <div class="panelHead"><b>Form setup</b></div>
          ${acc('Design preset', presetPicker('supplierGuide.preset', CONSENT_DOC_PRESETS), true)}
          ${acc('Document', `<div class="stack">
            <div class="grid2">
              ${field('Page size', select('supplierGuide.pageSize', [['A4','A4'],['Letter','US Letter']]))}
              ${field('Text density', select('supplierGuide.density', DENSITIES))}
            </div>
            ${field('Logo', `<select data-model="supplierGuide.logoId">${logoOptions(d.logoId)}</select>`)}
            ${field('Title', input('supplierGuide.title'))}
            <div class="grid2">
              ${field('Reference', input('supplierGuide.reference'))}
              ${field('Date', input('supplierGuide.date', { type:'date' }))}
            </div>
            ${field('Introduction', textarea('supplierGuide.intro', { rows:4 }))}
            ${field('Invoice to', textarea('supplierGuide.invoiceTo', { rows:4 }))}
          </div>`, true)}
          ${acc('Supplier details', `<div class="stack">
            ${field('Name / legal name', input('supplierGuide.supplierName'))}
            ${field('Address', input('supplierGuide.supplierAddress'))}
            <div class="grid2">
              ${field('Email', input('supplierGuide.supplierEmail', { type:'email' }))}
              ${field('Phone', input('supplierGuide.supplierPhone', { type:'tel' }))}
              ${field('Invoice number', input('supplierGuide.invoiceNumber'))}
              ${field('PO / SO number', input('supplierGuide.poNumber'))}
            </div>
          </div>`)}
          ${acc('Payment details', `<div class="stack">
            ${field('M-PESA registered name', input('supplierGuide.mpesaName'))}
            ${field('M-PESA number', input('supplierGuide.mpesaNumber'))}
            ${field('Bank / account name', input('supplierGuide.bankAccountName'))}
            ${field('Account number / branch', input('supplierGuide.bankAccountNumber'))}
            ${field('KRA PIN', input('supplierGuide.kraPin'))}
            <div class="docRule" style="margin:4px 0"></div>
            ${field('Beneficiary / account name', input('supplierGuide.intlBeneficiary'))}
            ${field('Bank name', input('supplierGuide.intlBank'))}
            ${field('Account number / IBAN', input('supplierGuide.intlAccount'))}
            ${field('SWIFT / BIC', input('supplierGuide.intlSwift'))}
            ${field('Bank address', input('supplierGuide.intlBankAddress'))}
            ${field('Sort / routing code', input('supplierGuide.intlRouting'))}
          </div>`)}
          ${acc('Guidance text', `<div class="stack">
            ${field('Invoice requirements', textarea('supplierGuide.requirements', { rows:5 }))}
            ${field('Kenyan supplier note', textarea('supplierGuide.kenyaNote', { rows:3 }))}
            ${field('Submission instructions', textarea('supplierGuide.submission', { rows:4 }))}
            ${field('Footer note', input('supplierGuide.note'))}
          </div>`)}
        </div>
      </div>`;
  },
  preview(){
    const host = $('#sgStage');
    if (!host) return;
    host.innerHTML = supplierGuidePages();
    bindPane(host);
  },
  mounted(host){ bindPane($('#sgStage')); fitStages(host); }
});

action('sgReset', () => confirmDialog('Reset the supplier invoicing form to the Narretrieve default wording?', () => {
  S.supplierGuide = makeSupplierGuide(); save(); renderView('supplierinv');
}, { yes:'Reset' }));
action('sgPng', () => guard(exportPng($('#sgStage .page'), 'Narretrieve_supplier_invoicing_' + (S.supplierGuide.reference || today()))));
action('sgPdf', () => guard(exportPdf($('#sgStage .page'), 'Narretrieve_supplier_invoicing_' + (S.supplierGuide.reference || today()), S.supplierGuide.pageSize)));
