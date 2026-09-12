/* ==========================================================================
   Supplier agreements — paginated contract with drawn signatures
   ========================================================================== */
const AGREEMENT_TEMPLATES = {
  Photography: {
    title:'Photography Services Agreement',
    subject:'Photography services assignment',
    role:'Photographer',
    deliverables:[
      'Edited high-resolution photographs in the agreed format.',
      'Caption and metadata information for selected images.',
      'Delivery of original or source files only where explicitly agreed in writing.'
    ]
  },
  Videography: {
    title:'Videography Services Agreement',
    subject:'Video production services assignment',
    role:'Videographer',
    deliverables:[
      'Edited film or films in the agreed duration, format and aspect ratios.',
      'Original camera files, project files and approved music or licence documentation where agreed.',
      'Subtitle, transcript and caption files where the brief requires them.'
    ]
  }
};

function agreementBlocks(){
  const a = S.agreement;
  const blocks = [];
  blocks.push({ html: `<div class="docBlock">
    <div class="partyGrid">
      <div class="party">
        <h5>Narretrieve</h5>
        <b>${editable('agreement.company.name', { tag:'span', ph:'Company name' })}</b>
        <div>${editable('agreement.company.address', { tag:'div', ph:'Address' })}
          ${editable('agreement.company.email', { tag:'div', ph:'Email' })}
          ${editable('agreement.company.website', { tag:'div', ph:'Website' })}</div>
      </div>
      <div class="party">
        <h5>Supplier</h5>
        <b>${editable('agreement.supplier.name', { tag:'span', ph:'Supplier name' })}</b>
        <div>${editable('agreement.supplier.company', { tag:'div', ph:'Trading name (optional)' })}
          ${editable('agreement.supplier.role', { tag:'div', ph:'Role' })}
          ${editable('agreement.supplier.email', { tag:'div', ph:'Email' })}
          ${editable('agreement.supplier.phone', { tag:'div', ph:'Phone' })}
          ${editable('agreement.supplier.address', { tag:'div', ph:'Address' })}</div>
      </div>
    </div></div>` });

  blocks.push({ html: `<div class="docBlock"><div class="metaGrid">
      <div class="metaItem"><span>Date</span><div>${editable('agreement.date', { tag:'span', ph:'Date' })}</div></div>
      <div class="metaItem"><span>Project</span><div>${editable('agreement.project', { tag:'span', ph:'Project or assignment' })}</div></div>
      <div class="metaItem"><span>Location</span><div>${editable('agreement.locations', { tag:'span', ph:'Locations' })}</div></div>
      <div class="metaItem"><span>Client / partner</span><div>${editable('agreement.clientPartner', { tag:'span', ph:'Client or partner' })}</div></div>
      <div class="metaItem"><span>Fieldwork</span><div>${editable('agreement.fieldworkDays', { tag:'span', ph:'As agreed' })}</div></div>
      <div class="metaItem"><span>Delivery</span><div>${editable('agreement.deliveryDeadline', { tag:'span', ph:'Delivery deadline' })}</div></div>
    </div></div>` });

  blocks.push({ html: `<div class="docBlock">
    <h4>Subject: ${editable('agreement.subject', { tag:'span', ph:'Subject' })}</h4>
    ${editable('agreement.intro', { tag:'p', ph:'Introduction', multi:true })}
  </div>` });

  blocks.push({ html: `<div class="docBlock">
    <h4>1. Deliverables</h4>
    <ul>${(a.deliverables || []).map((_, i) => `<li>${editable(`agreement.deliverables.${i}`, { tag:'span', ph:'Deliverable', multi:true })}</li>`).join('')}</ul>
  </div>` });

  (a.clauses || []).forEach((c, i) => {
    blocks.push({ html: `<div class="docBlock">
      <h4>${i + 2}. ${editable(`agreement.clauses.${i}.title`, { tag:'span', ph:'Clause title' })}</h4>
      ${editable(`agreement.clauses.${i}.body`, { tag:'p', ph:'Clause text', multi:true })}
    </div>` });
  });

  const n = (a.clauses || []).length + 2;
  blocks.push({ html: `<div class="docBlock">
    <h4>${n}. Fees and Payment</h4>
    <div class="metaGrid" style="margin-bottom:2.4mm">
      <div class="metaItem"><span>Fee</span><div>${editable('agreement.feeAmount', { tag:'span', ph:'Amount' })} ${editable('agreement.currency', { tag:'span', ph:'USD' })}</div></div>
      <div class="metaItem"><span>Basis</span><div>${editable('agreement.feeBasis', { tag:'span', ph:'Project fee' })}</div></div>
      <div class="metaItem"><span>Payment terms</span><div>${editable('agreement.paymentDays', { tag:'span', ph:'30 days' })}</div></div>
    </div>
    ${editable('agreement.paymentText', { tag:'p', ph:'Payment text', multi:true })}
    ${editable('agreement.taxNote', { tag:'p', cls:'docMuted', ph:'Tax note', multi:true })}
  </div>` });

  blocks.push({ html: `<div class="docBlock">
    <h4>${n + 1}. ${editable('agreement.ackTitle', { tag:'span', ph:'Acceptance' })}</h4>
    ${editable('agreement.ackText', { tag:'p', ph:'Acceptance text', multi:true })}
  </div>` });

  blocks.push({ html: `<div class="docBlock"><div class="sigGrid" style="margin-top:2mm;padding-top:0">
      ${sigCell('agreement.companySig', a.companySig, a.company.signatory || COMPANY.name, a.company.signatoryRole || 'Narretrieve representative', 'agreement.company.signatory', 'agreement.company.signatoryRole')}
      ${sigCell('agreement.supplierSig', a.supplierSig, a.supplier.name || 'Supplier', a.supplier.role || 'Supplier', 'agreement.supplier.name', 'agreement.supplier.role')}
    </div></div>` });
  return blocks;
}
function sigCell(path, value, name, role, namePath, rolePath){
  return `<div class="sigCell">
    ${value
      ? `<div class="sigField signed" data-act="clearSig" data-path="${esc(path)}" title="Click to clear this signature"><img src="${value}" alt="Signature"></div>`
      : `<div class="sigField" data-act="drawSig" data-path="${esc(path)}" data-name="${esc(name)}"><span class="ph">Click to sign</span></div>`}
    <div class="sigMeta">
      <b>${namePath ? editable(namePath, { tag:'span', ph:'Name' }) : esc(name)}</b>
      ${rolePath ? editable(rolePath, { tag:'span', ph:'Role' }) : esc(role)}
    </div>
  </div>`;
}
action('drawSig', d => openSignaturePad({
  title:'Sign as ' + (d.name || 'party'),
  onSave(dataUrl){ setPath(S, d.path, dataUrl); save(); renderView(activeView); toast('Signature applied', 'good'); }
}));
action('clearSig', d => confirmDialog('Remove this signature?', () => {
  setPath(S, d.path, ''); save(); renderView(activeView);
}, { yes:'Remove', danger:true }));

function agreementPages(){
  const a = S.agreement;
  const style = presetStyle(a.preset);
  const cls = presetClasses(a.preset, a.pageSize, a.density);
  const head = `<div class="docHead ${presetDef(a.preset).head}">
      ${a.logoId ? `<img class="logo" src="${logoData(a.logoId)}" alt="">` : ''}
      <div class="titleBlock">
        <div class="org">${esc(COMPANY.name)}</div>
        <h3>${editable('agreement.title', { tag:'span', ph:'Agreement title' })}</h3>
        <div class="ref">Ref: ${editable('agreement.reference', { tag:'span', ph:'Reference' })} · ${esc(a.date)}</div>
      </div>
    </div>`;
  const foot = `<div class="docFoot"><span>${esc(a.title)} · ${esc(a.reference)}</span><span>{{page}}</span></div>`;
  return paginate(agreementBlocks(), {
    pageClass: cls, style, headHtml: head, footHtml: foot, autoFit: a.density === 'auto', spine:'NARRETRIEVE'
  });
}

module('agreements', {
  render(){
    const a = S.agreement;
    return `
      ${pageHead({
        kicker:'Supplier documents',
        title:'Supplier Agreement Studio',
        blurb:'Photography and videography contracts with editable clauses, structural design presets, drawn signatures and honest pagination — pages are only added when the content needs them.',
        actions:
          btn('Photography template', { act:'agrTemplate', data:{ kind:'Photography' } }) +
          btn('Videography template', { act:'agrTemplate', data:{ kind:'Videography' } }) +
          btn('Record supplier', { act:'agrRecordSupplier' }) +
          btn('Export PDF', { act:'agrPdf', cls:'btn primary' })
      })}
      <div class="workspace noRail">
        ${stage('agrStage', a.title + ' · ' + a.pageSize, agreementPages(),
          btn('PNG page(s)', { act:'agrPng', cls:'btn sm' }))}
        <div class="panel sticky scrollPane scroll">
          <div class="panelHead"><b>Agreement editor</b></div>
          ${acc('Design preset', presetPicker('agreement.preset', AGREEMENT_PRESETS, { after:'render' }), true)}
          ${acc('Document', `<div class="stack">
            <div class="grid2">
              ${field('Page size', select('agreement.pageSize', [['A4','A4'],['Letter','US Letter']], { after:'render' }))}
              ${field('Text density', select('agreement.density', DENSITIES, { after:'render' }))}
            </div>
            ${field('Logo', `<select data-model="agreement.logoId" data-after="render">${logoOptions(a.logoId)}</select>`)}
            ${field('Title', input('agreement.title', { after:'render' }))}
            <div class="grid2">
              ${field('Reference', input('agreement.reference', { after:'render' }))}
              ${field('Date', input('agreement.date', { type:'date', after:'render' }))}
            </div>
            ${field('Subject', input('agreement.subject', { after:'render' }))}
            ${field('Introduction', textarea('agreement.intro', { rows:3, after:'render' }))}
          </div>`, true)}
          ${acc('Parties', `<div class="stack">
            ${field('Narretrieve entity', input('agreement.company.name', { after:'render' }))}
            ${field('Narretrieve address', input('agreement.company.address', { after:'render' }))}
            <div class="grid2">
              ${field('Signatory', input('agreement.company.signatory', { after:'render' }))}
              ${field('Signatory role', input('agreement.company.signatoryRole', { after:'render' }))}
            </div>
            <div class="docRule" style="margin:4px 0"></div>
            ${field('Supplier name', input('agreement.supplier.name', { after:'render' }))}
            ${field('Supplier trading name', input('agreement.supplier.company', { after:'render' }))}
            <div class="grid2">
              ${field('Role', input('agreement.supplier.role', { after:'render' }))}
              ${field('Email', input('agreement.supplier.email', { type:'email', after:'render' }))}
              ${field('Phone', input('agreement.supplier.phone', { type:'tel', after:'render' }))}
              ${field('City', input('agreement.supplier.city', { after:'render' }))}
            </div>
            ${field('Address', input('agreement.supplier.address', { after:'render' }))}
          </div>`)}
          ${acc('Assignment', `<div class="stack">
            ${field('Project', input('agreement.project', { after:'render' }))}
            ${field('Client / partner', input('agreement.clientPartner', { after:'render' }))}
            ${field('Locations', input('agreement.locations', { after:'render' }))}
            <div class="grid2">
              ${field('Start date', input('agreement.startDate', { type:'date', after:'render' }))}
              ${field('End date', input('agreement.endDate', { type:'date', after:'render' }))}
              ${field('Fieldwork days', input('agreement.fieldworkDays', { after:'render' }))}
              ${field('Delivery deadline', input('agreement.deliveryDeadline', { after:'render' }))}
            </div>
          </div>`)}
          ${acc('Deliverables', listEditor('agreement.deliverables', 'text', { addLabel:'Add deliverable', ph:'Deliverable' }))}
          ${acc('Clauses', listEditor('agreement.clauses', [
            { key:'title', label:'Clause title' }, { key:'body', label:'Clause text', type:'textarea', rows:3 }
          ], { addLabel:'Add clause' }))}
          ${acc('Fees & acceptance', `<div class="stack">
            <div class="grid2">
              ${field('Fee amount', input('agreement.feeAmount', { after:'render' }))}
              ${field('Currency', select('agreement.currency', CURRENCIES, { after:'render' }))}
              ${field('Fee basis', input('agreement.feeBasis', { after:'render' }))}
              ${field('Payment terms', input('agreement.paymentDays', { after:'render' }))}
            </div>
            ${field('Payment text', textarea('agreement.paymentText', { rows:3, after:'render' }))}
            ${field('Tax note', textarea('agreement.taxNote', { rows:3, after:'render' }))}
            ${field('Acceptance heading', input('agreement.ackTitle', { after:'render' }))}
            ${field('Acceptance text', textarea('agreement.ackText', { rows:3, after:'render' }))}
          </div>`)}
          ${acc('Signatures', `<div class="stack">
            <div class="note neutral">Click either signature box on the page to draw a signature with a mouse, pen or finger. Drawn signatures are stored in this workspace and rendered into the exported PDF.</div>
            <div class="inline">
              ${btn('Sign as Narretrieve', { act:'drawSig', cls:'btn sm', data:{ path:'agreement.companySig', name: a.company.signatory || COMPANY.name } })}
              ${btn('Sign as supplier', { act:'drawSig', cls:'btn sm', data:{ path:'agreement.supplierSig', name: a.supplier.name || 'Supplier' } })}
            </div>
          </div>`)}
        </div>
      </div>`;
  },
  preview(){
    const host = $('#agrStage');
    if (!host) return;
    host.innerHTML = agreementPages();
    bindPane(host);
  },
  mounted(host){ bindPane($('#agrStage')); fitStages(host); }
});

action('agrTemplate', d => {
  const t = AGREEMENT_TEMPLATES[d.kind];
  confirmDialog(`Load the ${d.kind.toLowerCase()} template? Deliverables and the title will be replaced; parties and clauses are kept.`, () => {
    Object.assign(S.agreement, {
      kind: d.kind, title: t.title, subject: t.subject,
      deliverables: t.deliverables.slice()
    });
    S.agreement.supplier.role = t.role;
    save(); renderView('agreements');
    toast(d.kind + ' template loaded', 'good');
  }, { yes:'Load template' });
});
action('agrPdf', () => guard(exportPdf(pagesIn('agrStage'), 'Narretrieve_' + (S.agreement.reference || 'agreement'), S.agreement.pageSize)));
action('agrPng', () => guard(exportPng(pagesIn('agrStage'), 'Narretrieve_' + (S.agreement.reference || 'agreement'))));
action('agrRecordSupplier', () => {
  const a = S.agreement;
  if (!String(a.supplier.name || '').trim()) return toast('Enter a supplier name first.', 'bad');
  addSupplierFromAgreement();
  go('suppliers');
});
