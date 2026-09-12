/* ==========================================================================
   Supplier packet — bundle documents into one ZIP with a SHA-256 manifest
   ========================================================================== */
function packetCandidates(){
  const a = S.agreement, r = activeRelease(), inv = activeInvoice(), sp = S.specs;
  const out = [
    { key:'agreement', group:'Current studio documents', label:'Current supplier agreement', ref:a.reference, view:'agreements', stage:'agrStage', size:a.pageSize, file:'Supplier_Agreement_' + a.reference },
    { key:'consent',   group:'Current studio documents', label:'Current consent / release', ref:r.consentId, view:'consent', stage:'consentStage', size:r.pageSize, file:'Consent_' + r.consentId },
    { key:'spec',      group:'Current studio documents', label:'Current capture specification', ref: sp.reference + ' · ' + sp.activeMode, view:'specs', stage:'specStage', size:sp.pageSize, file:'Capture_Spec_' + sp.reference },
    { key:'invoice',   group:'Current studio documents', label:'Current invoice / quotation', ref:inv.number, view:'invoices', stage:'invStage', size:inv.pageSize, file: inv.number },
    { key:'supguide',  group:'Current studio documents', label:'Supplier invoicing & payment details', ref:S.supplierGuide.reference, view:'supplierinv', stage:'sgStage', size:S.supplierGuide.pageSize, file:'Supplier_Invoicing_' + S.supplierGuide.reference },
    { key:'letter',    group:'Current studio documents', label:'Branded letter', ref:S.letterhead.reference, view:'letterhead', stage:'lhStage', size:S.letterhead.pageSize, file:'Letter_' + S.letterhead.reference }
  ];
  S.production.docs.forEach(d => out.push({
    key:'prod:' + d.id, group:'Production documents', label:d.title, ref:d.reference,
    view:'production', stage:'prodStage', size:d.pageSize, file:d.reference, prodId:d.id
  }));
  return out;
}

module('packet', {
  render(){
    const items = packetCandidates();
    const groups = {};
    items.forEach(x => (groups[x.group] = groups[x.group] || []).push(x));
    const files = S.packet.files || [];
    const chosen = items.filter(x => S.packet.checked[x.key]).length;

    return `
      ${pageHead({
        kicker:'Supplier handoff',
        title:'Supplier Packet',
        blurb:'Select StudioDocs documents and optional external files, then build one ZIP for a photographer, videographer, fixer, producer or other supplier. A SHA-256 manifest is always included.',
        actions: btn('Add external files', { act:'packetAdd' }) + btn('Create ZIP', { act:'packetZip', cls:'btn primary' })
      })}
      <div class="grid3" style="align-items:start">
        <div class="panel">
          <div class="panelHead"><b>Package details</b></div>
          <div class="panelBody stack">
            ${field('Supplier / recipient', input('packet.supplier', { after:'none', ph:'Supplier name' }))}
            ${field('Assignment / project', input('packet.project', { after:'none', ph:'Assignment or project' }))}
            ${field('Package note', textarea('packet.note', { rows:4, after:'none', ph:'Instructions included with this handoff' }))}
            <div class="note">Only checked documents are included. Uploaded files are stored as inert binary attachments and are never executed or previewed as code.</div>
          </div>
        </div>

        <div class="panel">
          <div class="panelHead"><b>Select documents</b><span class="spacer"></span><span class="tag${chosen ? ' coral' : ''}">${chosen} selected</span></div>
          <div class="panelBody stack">
            ${Object.entries(groups).map(([group, list]) => `
              <div>
                <div class="fieldLabel">${esc(group)}</div>
                <div class="stack" style="gap:5px">
                  ${list.map(x => `<label class="checkrow">
                    <input type="checkbox" data-model="packet.checked.${esc(x.key)}" data-model-type="checkbox" data-after="render"${S.packet.checked[x.key] ? ' checked' : ''}>
                    <span><b style="display:block;font-size:12px">${esc(x.label)}</b><small style="color:var(--text-3)">${esc(x.ref || '—')}</small></span>
                  </label>`).join('')}
                </div>
              </div>`).join('')}
          </div>
        </div>

        <div class="panel">
          <div class="panelHead"><b>External attachments</b><span class="spacer"></span><span class="tag">${files.length}</span></div>
          <div class="panelBody stack">
            ${files.length ? files.map((f, i) => `
              <div class="inline" style="justify-content:space-between;border:1px solid var(--line);border-radius:var(--r-s);padding:8px 10px">
                <span style="min-width:0;overflow:hidden;text-overflow:ellipsis">
                  <b style="font-size:12px;display:block">${esc(f.name)}</b>
                  <small style="color:var(--text-3)">${(f.size / 1024).toFixed(1)} KB</small>
                </span>
                ${btn('Remove', { act:'packetRm', cls:'btn xs danger', data:{ index:i } })}
              </div>`).join('')
              : '<div class="empty">No external attachments added.</div>'}
            ${btn('Add external files', { act:'packetAdd', cls:'btn sm block' })}
            <div id="packetStatus"></div>
          </div>
        </div>
      </div>
      <div class="panel hidden" id="packetRender"><div class="panelBody"><div class="stageInner" id="packetStage"></div></div></div>`;
  }
});

action('packetAdd', () => pickFiles('*/*', (bytes, file) => {
  if (bytes.length > 12_000_000) return toast(file.name + ' is larger than 12 MB — skipped.', 'bad');
  S.packet.files.push({ name: file.name.replace(/[^\w.\- ]+/g, '_'), size: bytes.length, data: Array.from(bytes) });
  save(); renderView('packet');
}));
action('packetRm', d => { S.packet.files.splice(Number(d.index), 1); save(); renderView('packet'); });

action('packetZip', () => guard((async () => {
  const items = packetCandidates().filter(x => S.packet.checked[x.key]);
  if (!items.length && !S.packet.files.length) return toast('Select at least one document or attachment.', 'bad');

  const status = $('#packetStatus');
  const step = (msg, pct) => { if (status) status.innerHTML = `<div class="bar"><i style="width:${pct}%"></i></div><div class="hint" style="margin-top:6px">${esc(msg)}</div>`; };
  step('Preparing documents…', 4);

  const files = [];
  const host = $('#packetStage');
  const holder = $('#packetRender');
  holder.classList.remove('hidden');
  holder.style.cssText = 'position:fixed;left:-20000px;top:0;width:1200px';

  for (let n = 0; n < items.length; n++){
    const it = items[n];
    step('Rendering ' + it.label + '…', 6 + (n / Math.max(1, items.length)) * 70);
    if (it.prodId) S.production.activeId = it.prodId;
    host.innerHTML = packetDocHtml(it);
    bindPane(host);
    const pages = $$('.page', host);
    const pdfPages = [];
    for (const page of pages){
      const c = await nodeToCanvas(page, 2.4);
      const rect = page.getBoundingClientRect();
      const pt = PT[it.size] || PT.A4;
      pdfPages.push({ data: c.toDataURL('image/jpeg', 0.93), widthPt: pt.w, heightPt: Math.round(pt.w * (rect.height / rect.width) * 100) / 100, pxW: c.width, pxH: c.height });
    }
    if (pdfPages.length) files.push({ name: cleanFilename(it.file) + '.pdf', data: buildPdf(pdfPages) });
  }
  holder.classList.add('hidden');
  holder.removeAttribute('style');
  host.innerHTML = '';

  (S.packet.files || []).forEach(f => files.push({ name: 'attachments/' + f.name, data: new Uint8Array(f.data) }));

  step('Building manifest…', 88);
  const lines = [
    'NARRETRIEVE SUPPLIER PACKET',
    '===========================',
    'Supplier / recipient : ' + (S.packet.supplier || '—'),
    'Assignment / project : ' + (S.packet.project || '—'),
    'Created              : ' + new Date().toISOString(),
    'Files                : ' + files.length,
    '',
    'NOTE',
    (S.packet.note || '—'),
    '',
    'SHA-256 MANIFEST',
    '----------------'
  ];
  for (const f of files) lines.push((await sha256Hex(f.data)) + '  ' + f.name);
  files.push({ name:'MANIFEST.txt', data: new TextEncoder().encode(lines.join('\n')) });

  step('Compiling ZIP…', 96);
  const zip = zipBuild(files);
  dlBytes(cleanFilename('Narretrieve_packet_' + (S.packet.supplier || 'supplier') + '_' + today()) + '.zip', 'application/zip', zip);
  step(`Done — ${files.length} files, ${(zip.length / 1024).toFixed(0)} KB`, 100);
  toast('Supplier packet created', 'good');
})()));

function packetDocHtml(it){
  switch (it.key){
    case 'agreement': return agreementPages();
    case 'consent':   return consentPages();
    case 'spec':      return specPages();
    case 'invoice':   return invoicePages();
    case 'supguide':  return supplierGuidePages();
    case 'letter':    return letterheadPages();
    default:          return prodPages();
  }
}
