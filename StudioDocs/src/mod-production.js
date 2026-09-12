/* ==========================================================================
   Production documents — 11 client, contractor and field templates
   ========================================================================== */
function activeProd(){
  return S.production.docs.find(d => d.id === S.production.activeId) || S.production.docs[0];
}
function prodIndex(){ return Math.max(0, S.production.docs.findIndex(d => d.id === activeProd().id)); }

function prodBlocks(){
  const d = activeProd();
  const p = `production.docs.${prodIndex()}`;
  const blocks = [];

  blocks.push({ html: `<div class="docBlock metaStrip">
    <span><b>Date:</b> ${editable(`${p}.date`, { tag:'span', ph:'—' })}</span>
    <span><b>Reference:</b> ${editable(`${p}.reference`, { tag:'span', ph:'—' })}</span>
    <span><b>Category:</b> ${editable(`${p}.category`, { tag:'span', ph:'—' })}</span>
  </div>` });

  blocks.push({ html: `<div class="docBlock partyGrid">
      <div class="party"><h5>Narretrieve / first party</h5>
        <b>${editable(`${p}.firstParty`, { tag:'span', ph:'Narretrieve Productions LTD' })}</b>
        <div>${editable(`${p}.location`, { tag:'div', ph:'Location' })}</div></div>
      <div class="party"><h5>Client / contractor / counterparty</h5>
        <b>${editable(`${p}.counterparty`, { tag:'span', ph:'Counterparty name' })}</b>
        <div>${editable(`${p}.clientOrg`, { tag:'div', ph:'Organisation' })}
          ${editable(`${p}.project`, { tag:'div', ph:'Project / assignment' })}</div></div>
    </div>` });

  blocks.push({ html: `<div class="docBlock">${editable(`${p}.lead`, { tag:'p', cls:'docLead', ph:'Opening paragraph', multi:true })}</div>` });

  if ((d.items || []).length){
    blocks.push({ html: `<div class="docBlock"><table class="docTable">
      <thead><tr>${d.itemLabels.map((lab, c) => `<th${c ? ' class="num"' : ''}>${editable(`${p}.itemLabels.${c}`, { tag:'span', ph:'Column' })}</th>`).join('')}</tr></thead>
      <tbody>${d.items.map((row, r) => `<tr>${d.itemLabels.map((_, c) =>
        `<td${c ? ' class="num"' : ''}>${editable(`${p}.items.${r}.${c}`, { tag:'span', ph:'—', multi:true })}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>` });
  }

  (d.sections || []).forEach((s, i) => {
    blocks.push({ html: `<div class="docBlock">
      <h4>${editable(`${p}.sections.${i}.title`, { tag:'span', ph:'Section heading' })}</h4>
      ${editable(`${p}.sections.${i}.body`, { tag:'p', ph:'Section text', multi:true })}
    </div>` });
  });

  blocks.push({ html: `<div class="docBlock"><div class="sigGrid" style="padding-top:0">
      ${sigCell(`${p}.firstPartySig`, d.firstPartySig, d.firstPartyName || COMPANY.name, d.firstPartyRole, `${p}.firstPartyName`, `${p}.firstPartyRole`)}
      ${sigCell(`${p}.counterpartySig`, d.counterpartySig, d.counterpartyName || d.counterparty || 'Counterparty', d.counterpartyRole, `${p}.counterpartyName`, `${p}.counterpartyRole`)}
    </div></div>` });
  return blocks;
}
function prodPages(){
  const d = activeProd();
  const p = `production.docs.${prodIndex()}`;
  const style = presetStyle(d.preset);
  const head = `<div class="docHead ${presetDef(d.preset).head}">
      ${d.logoId ? `<img class="logo" src="${logoData(d.logoId)}" alt="">` : ''}
      <div class="titleBlock">
        <div class="org">${esc(d.category)}</div>
        <h3>${editable(`${p}.title`, { tag:'span', ph:'Document title' })}</h3>
        <div class="ref">${esc(d.reference)}</div>
      </div></div>`;
  const foot = `<div class="docFoot"><span>${esc(d.title)} · ${esc(d.reference)}</span><span>{{page}}</span></div>`;
  return paginate(prodBlocks(), { pageClass: presetClasses(d.preset, d.pageSize, d.density), style, headHtml: head, footHtml: foot, autoFit: d.density === 'auto', spine:'NARRETRIEVE' });
}

module('production', {
  render(){
    const d = activeProd();
    const p = `production.docs.${prodIndex()}`;
    const grouped = {};
    Object.entries(PROD_TEMPLATES).forEach(([key, t]) => {
      (grouped[t.category] = grouped[t.category] || []).push([key, t.name]);
    });
    return `
      ${pageHead({
        kicker:'Client, contractor & field documentation',
        title:'Production Documents',
        blurb:'Contracts, acknowledgements, project documents, financial records and risk-management forms for NGO, development and documentary assignments. Every heading, clause, field and line item is editable.',
        actions:
          btn('Duplicate', { act:'prodDup' }) +
          btn('Delete', { act:'prodDel', cls:'btn danger' }) +
          btn('PNG', { act:'prodPng' }) +
          btn('Export PDF', { act:'prodPdf', cls:'btn primary' })
      })}
      <div class="workspace">
        <div class="panel sticky scrollPane scroll">
          <div class="panelHead"><b>New from template</b></div>
          <div class="panelBody" style="padding:9px">
            ${Object.entries(grouped).map(([cat, items]) => `
              <div style="margin-bottom:10px">
                <div class="fieldLabel" style="margin:0 4px 5px">${esc(cat)}</div>
                <div class="stack" style="gap:4px">
                  ${items.map(([key, name]) => `<button class="presetTile" data-act="prodNew" data-key="${esc(key)}">${esc(name)}</button>`).join('')}
                </div>
              </div>`).join('')}
          </div>
          <div class="panelHead"><b>Documents</b><span class="spacer"></span><span class="tag">${S.production.docs.length}</span></div>
          <div class="railList">
            ${S.production.docs.map(x => `
              <button class="railItem${x.id === d.id ? ' on' : ''}" data-act="prodPick" data-id="${esc(x.id)}">
                <b>${esc(x.title)}</b><small>${esc(x.category)} · ${esc(x.reference)}</small>
              </button>`).join('')}
          </div>
        </div>

        ${stage('prodStage', d.title + ' · ' + d.pageSize, prodPages())}

        <div class="panel sticky scrollPane scroll">
          <div class="panelHead"><b>Document editor</b></div>
          ${acc('Document', `<div class="stack">
            ${field('Title', input(`${p}.title`, { after:'render' }))}
            ${field('Category', input(`${p}.category`, { after:'render' }))}
            <div class="grid2">
              ${field('Reference', input(`${p}.reference`, { after:'render' }))}
              ${field('Date', input(`${p}.date`, { type:'date', after:'render' }))}
              ${field('Page size', select(`${p}.pageSize`, [['A4','A4'],['Letter','US Letter']], { after:'render' }))}
              ${field('Text density', select(`${p}.density`, DENSITIES, { after:'render' }))}
              ${field('Logo', `<select data-model="${p}.logoId" data-after="render">${logoOptions(d.logoId)}</select>`)}
            </div>
            ${field('Opening paragraph', textarea(`${p}.lead`, { rows:4, after:'render' }))}
          </div>`, true)}
          ${acc('Design preset', presetPicker(`${p}.preset`, PROD_PRESETS, { after:'render' }), true)}
          ${acc('Parties & project', `<div class="stack">
            ${field('Narretrieve / first party', input(`${p}.firstParty`, { after:'render' }))}
            ${field('Counterparty', input(`${p}.counterparty`, { after:'render' }))}
            <div class="grid2">
              ${field('Client organisation', input(`${p}.clientOrg`, { after:'render' }))}
              ${field('Project', input(`${p}.project`, { after:'render' }))}
            </div>
            ${field('Location', input(`${p}.location`, { after:'render' }))}
          </div>`)}
          ${acc('Line items', `<div class="stack">
            <div class="grid2">
              ${d.itemLabels.map((lab, c) => field('Column ' + (c + 1), `<input type="text" data-model="${p}.itemLabels.${c}" value="${esc(lab)}" data-after="render">`)).join('')}
            </div>
            ${gridEditor(`${p}.items`, d.itemLabels)}
          </div>`)}
          ${acc('Sections', listEditor(`${p}.sections`, [
            { key:'title', label:'Section heading' }, { key:'body', label:'Section text', type:'textarea', rows:3 }
          ], { addLabel:'Add section' }))}
          ${acc('Signatures', `<div class="stack">
            <div class="grid2">
              ${field('First party name', input(`${p}.firstPartyName`, { after:'render' }))}
              ${field('First party role', input(`${p}.firstPartyRole`, { after:'render' }))}
              ${field('Counterparty name', input(`${p}.counterpartyName`, { after:'render' }))}
              ${field('Counterparty role', input(`${p}.counterpartyRole`, { after:'render' }))}
            </div>
            <div class="inline">
              ${btn('Sign as first party', { act:'drawSig', cls:'btn sm', data:{ path:`${p}.firstPartySig`, name: d.firstPartyName || COMPANY.name } })}
              ${btn('Sign as counterparty', { act:'drawSig', cls:'btn sm', data:{ path:`${p}.counterpartySig`, name: d.counterparty || 'Counterparty' } })}
            </div>
          </div>`)}
        </div>
      </div>`;
  },
  preview(){
    const host = $('#prodStage');
    if (!host) return;
    host.innerHTML = prodPages();
    bindPane(host);
  },
  mounted(host){ bindPane($('#prodStage')); fitStages(host); }
});

action('prodPick', d => { S.production.activeId = d.id; save(); renderView('production'); });
action('prodNew', d => {
  const doc = makeProductionDoc(d.key);
  S.production.docs.push(doc); S.production.activeId = doc.id;
  save(); renderView('production');
  toast(doc.title + ' created', 'good');
});
action('prodDup', () => {
  const src = activeProd();
  const doc = Object.assign(JSON.parse(JSON.stringify(src)), { id: uid('prod'), title: src.title + ' (copy)' });
  S.production.docs.push(doc); S.production.activeId = doc.id;
  save(); renderView('production');
});
action('prodDel', () => {
  if (S.production.docs.length <= 1) return toast('Keep at least one production document.', 'bad');
  confirmDialog('Delete this production document?', () => {
    S.production.docs = S.production.docs.filter(x => x.id !== S.production.activeId);
    S.production.activeId = S.production.docs[0].id;
    save(); renderView('production');
  }, { yes:'Delete', danger:true });
});
action('prodPdf', () => guard(exportPdf(pagesIn('prodStage'), 'Narretrieve_' + activeProd().reference, activeProd().pageSize)));
action('prodPng', () => guard(exportPng(pagesIn('prodStage'), 'Narretrieve_' + activeProd().reference)));
