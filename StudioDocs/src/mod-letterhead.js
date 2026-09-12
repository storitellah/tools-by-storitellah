/* ==========================================================================
   Branded letterhead — direct-edit single page
   ========================================================================== */
function letterheadBlocks(){
  const d = S.letterhead;
  const B = [];
  B.push({ html: `<div class="docBlock" style="display:grid;grid-template-columns:minmax(0,1fr) 52mm;gap:8mm;align-items:start">
      <div style="font-size:9.2pt;line-height:1.6">
        ${editable('letterhead.recipient', { tag:'div', ph:'Recipient name' })}
        ${editable('letterhead.recipientOrg', { tag:'div', ph:'Organisation' })}
        ${editable('letterhead.recipientAddress', { tag:'div', cls:'docMuted', ph:'Address, city / country', multi:true })}
      </div>
      <div class="metaGrid" style="grid-template-columns:1fr">
        <div class="metaItem"><span>DATE</span><div>${editable('letterhead.date', { tag:'span', ph:'Date' })}</div></div>
        <div class="metaItem"><span>REFERENCE</span><div>${editable('letterhead.reference', { tag:'span', ph:'Reference' })}</div></div>
      </div>
    </div>` });

  B.push({ html: `<div class="docBlock">
      <h4 style="font-size:11pt">Subject: ${editable('letterhead.subject', { tag:'span', ph:'Letter subject' })}</h4>
      <div class="docRule" style="margin-top:2.4mm"></div>
    </div>` });

  (d.paragraphs || []).forEach((_, i) => {
    B.push({ html: `<div class="docBlock lhBody">${editable(`letterhead.paragraphs.${i}`, { tag:'div', ph:'Paragraph…', multi:true })}</div>` });
  });

  B.push({ html: `<div class="docBlock">
      ${d.signature
        ? `<img src="${d.signature}" alt="Signature" style="display:block;height:16mm;object-fit:contain;margin-bottom:1.5mm">`
        : `<button class="sigField" style="width:62mm" data-act="lhSign"><span class="ph">Click to sign this letter</span></button>`}
      <div style="border-top:.6pt solid var(--pInk);width:62mm;padding-top:1.4mm">
        ${editable('letterhead.signOff', { tag:'div', ph:'Name', style:'font-weight:700' })}
        ${editable('letterhead.signOffRole', { tag:'div', cls:'docMuted', ph:'Role', style:'font-size:8pt' })}
      </div>
    </div>` });
  return B;
}
function letterheadPages(){
  const d = S.letterhead;
  const head = `<div class="docHead ${presetDef(d.preset).head}" style="border-bottom:none;padding-bottom:0">
      <div class="lhHead" style="width:100%">
        <div>
          ${d.useWordmark
            ? `${editable('letterhead.wordmark', { tag:'div', cls:'lhWord', ph:'NARRETRIEVE' })}
               ${editable('letterhead.tagline', { tag:'div', cls:'lhTag', ph:'Tagline' })}`
            : `<img class="logo" src="${logoData(d.logoId)}" alt="${esc(COMPANY.name)}">`}
        </div>
        ${editable('letterhead.contact', { tag:'div', cls:'lhContact', ph:'Company address block', multi:true })}
      </div>
      <div class="docRule accent" style="margin-top:4mm"></div>
    </div>`;
  const foot = `<div class="docFoot">
      <span>${editable('letterhead.company', { tag:'span', ph:'Company' })}</span>
      <span>${editable('letterhead.footer', { tag:'span', ph:'narretrieve.com' })} · {{page}}</span>
    </div>`;
  return paginate(letterheadBlocks(), {
    pageClass: presetClasses(d.preset, d.pageSize, d.density), style: presetStyle(d.preset),
    headHtml: head, footHtml: foot, autoFit: d.density === 'auto'
  });
}

module('letterhead', {
  render(){
    const d = S.letterhead;
    return `
      ${pageHead({
        kicker:'Correspondence',
        title:'Narretrieve Letterhead Studio',
        blurb:'A direct-edit letterhead. Click anywhere on the page — the address block, the reference, the subject, the body, the sign-off — and type. Nothing is rebuilt underneath you.',
        actions:
          btn('Reset page', { act:'lhReset' }) +
          btn('PNG', { act:'lhPng' }) +
          btn('Export PDF', { act:'lhPdf', cls:'btn primary' })
      })}
      <div class="workspace noRail">
        ${stage('lhStage', 'Letter · ' + d.pageSize, letterheadPages())}
        <div class="panel sticky scrollPane scroll">
          <div class="panelHead"><b>Letter setup</b></div>
          ${acc('Design preset', presetPicker('letterhead.preset', CONSENT_DOC_PRESETS, { after:'preview' }), true)}
          ${acc('Page & masthead', `<div class="stack">
            <div class="grid2">
              ${field('Page size', select('letterhead.pageSize', [['A4','A4 (210 × 297 mm)'],['Letter','US Letter (8.5 × 11 in)']]))}
              ${field('Text density', select('letterhead.density', DENSITIES))}
            </div>
            ${checkbox('letterhead.useWordmark', 'Use the NARRETRIEVE wordmark instead of the logo image')}
            ${field('Logo', `<select data-model="letterhead.logoId">${logoOptions(d.logoId)}</select>`)}
            ${field('Wordmark', input('letterhead.wordmark'))}
            ${field('Tagline', input('letterhead.tagline'))}
            ${field('Address block', textarea('letterhead.contact', { rows:5 }))}
          </div>`, true)}
          ${acc('Letter fields', `<div class="stack">
            <div class="grid2">
              ${field('Date', input('letterhead.date', { type:'date' }))}
              ${field('Reference', input('letterhead.reference'))}
            </div>
            ${field('Recipient', input('letterhead.recipient'))}
            ${field('Organisation', input('letterhead.recipientOrg'))}
            ${field('Address', textarea('letterhead.recipientAddress', { rows:2 }))}
            ${field('Subject', input('letterhead.subject'))}
            ${field('Paragraphs', listEditor('letterhead.paragraphs', 'text', { addLabel:'Add paragraph', ph:'Paragraph text', multiline:true, rows:3 }))}
          </div>`)}
          ${acc('Sign-off', `<div class="stack">
            ${field('Name', input('letterhead.signOff'))}
            ${field('Role', input('letterhead.signOffRole'))}
            ${field('Footer', input('letterhead.footer'))}
            <div class="inline">
              ${btn('Draw signature', { act:'lhSign', cls:'btn sm' })}
              ${S.letterhead.signature ? btn('Remove signature', { act:'lhUnsign', cls:'btn sm danger' }) : ''}
            </div>
          </div>`)}
        </div>
      </div>`;
  },
  preview(){
    const host = $('#lhStage');
    if (!host) return;
    host.innerHTML = letterheadPages();
    bindPane(host);
  },
  mounted(host){ bindPane($('#lhStage')); fitStages(host); }
});

action('lhSign', () => openSignaturePad({
  title:'Sign this letter',
  onSave(dataUrl){ S.letterhead.signature = dataUrl; save(); renderView('letterhead'); toast('Signature applied', 'good'); }
}));
action('lhUnsign', () => { S.letterhead.signature = ''; save(); renderView('letterhead'); });
action('lhReset', () => confirmDialog('Reset the letterhead to the Narretrieve default wording?', () => {
  S.letterhead = makeLetterhead(); save(); renderView('letterhead');
}, { yes:'Reset' }));
action('lhPng', () => guard(exportPng($('#lhStage .page'), 'Narretrieve_letter_' + (S.letterhead.reference || today()))));
action('lhPdf', () => guard(exportPdf($('#lhStage .page'), 'Narretrieve_letter_' + (S.letterhead.reference || today()), S.letterhead.pageSize)));
