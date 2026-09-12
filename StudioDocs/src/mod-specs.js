/* ==========================================================================
   Capture specifications — photo / video / audio field briefs
   ========================================================================== */
function specMode(){ return S.specs.activeMode || 'photo'; }
function specBlocks(){
  const sp = S.specs;
  const m = specMode();
  const d = sp[m];
  const p = `specs.${m}`;
  const mid = Math.ceil((d.equipment || []).length / 2);
  const eqA = (d.equipment || []).slice(0, mid), eqB = (d.equipment || []).slice(mid);
  const eqCol = (list, offset) => list.map((_, n) =>
    `<div style="border-bottom:.5pt solid var(--pLine);padding:1.2mm 0">${editable(`${p}.equipment.${offset + n}`, { tag:'span', ph:'Equipment item' })}</div>`).join('');

  return [
    { html: `<div class="docBlock" style="display:grid;grid-template-columns:1fr 1fr;gap:7mm">
        <div class="metaGrid" style="grid-template-columns:1fr">
          <div class="metaItem"><span>Project</span><div>${editable('specs.project', { tag:'span', ph:'Project' })}</div></div>
          <div class="metaItem"><span>Supplier</span><div>${editable('specs.supplier', { tag:'span', ph:'Supplier' })}</div></div>
          <div class="metaItem"><span>Date</span><div>${editable('specs.date', { tag:'span', ph:'Date' })}</div></div>
        </div>
        <div class="metaGrid" style="grid-template-columns:1fr">
          <div class="metaItem"><span>Client / partner</span><div>${editable('specs.client', { tag:'span', ph:'Client' })}</div></div>
          <div class="metaItem"><span>Location</span><div>${editable('specs.location', { tag:'span', ph:'Location' })}</div></div>
          <div class="metaItem"><span>Mode</span><div>${esc(m.toUpperCase())}</div></div>
        </div>
      </div>` },
    { html: `<div class="docBlock labelled">
        <h4>Recommended / available equipment</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 7mm;font-size:8.2pt">
          <div>${eqCol(eqA, 0)}</div><div>${eqCol(eqB, eqA.length)}</div>
        </div>
      </div>` },
    { html: `<div class="docBlock" style="display:grid;grid-template-columns:1fr 1fr;gap:7mm">
        <div class="labelled">
          <h4>Technical settings</h4>
          <ul>${(d.settings || []).map((_, n) => `<li>${editable(`${p}.settings.${n}`, { tag:'span', ph:'Setting', multi:true })}</li>`).join('')}</ul>
        </div>
        <div class="labelled">
          <h4>Shot list</h4>
          <ul>${(d.shotlist || []).map((_, n) => `<li>${editable(`${p}.shotlist.${n}`, { tag:'span', ph:'Shot', multi:true })}</li>`).join('')}</ul>
        </div>
      </div>` },
    { html: `<div class="docBlock" style="display:grid;grid-template-columns:1fr 1fr;gap:7mm">
        <div class="labelled"><h4>Shooting / recording style</h4>${editable(`${p}.styleText`, { tag:'p', ph:'Style guidance', multi:true })}</div>
        <div class="labelled"><h4>Delivery</h4>${editable(`${p}.delivery`, { tag:'p', ph:'Delivery instructions', multi:true })}</div>
      </div>` }
  ];
}
function specPages(){
  const sp = S.specs;
  const m = specMode();
  const p = `specs.${m}`;
  const head = `<div class="docHead ${presetDef(sp.preset).head}">
      ${sp.logoId ? `<img class="logo" src="${logoData(sp.logoId)}" alt="">` : ''}
      <div class="titleBlock">
        <div class="org">Supplier field standards</div>
        <h3>${editable(`${p}.title`, { tag:'span', ph:'Specification title' })}</h3>
        <div class="ref">${editable('specs.reference', { tag:'span', ph:'Reference' })} · ${esc(m.toUpperCase())}</div>
      </div></div>`;
  const foot = `<div class="docFoot"><span>${esc(COMPANY.name)} · capture specification</span><span>${esc(sp.reference)} · {{page}}</span></div>`;
  return paginate(specBlocks(), {
    pageClass: presetClasses(sp.preset, sp.pageSize, sp.density), style: presetStyle(sp.preset),
    headHtml: head, footHtml: foot, autoFit: sp.density === 'auto'
  });
}

module('specs', {
  render(){
    const m = specMode();
    const p = `specs.${m}`;
    return `
      ${pageHead({
        kicker:'Supplier field standards',
        title:'Photo, Video & Audio Specifications',
        blurb:'Technical briefs for Narretrieve suppliers. Equipment, camera and audio settings, shooting style, delivery instructions and shot lists are all editable and export for field use.',
        actions: btn('Reset this mode', { act:'specReset' }) + btn('PNG', { act:'specPng' }) + btn('Export PDF', { act:'specPdf', cls:'btn primary' })
      })}
      <div class="workspace noRail">
        ${stage('specStage', titleCase(m) + ' capture specification', specPages(),
          `<div class="btnGroup">${['photo','video','audio'].map(x =>
            `<button class="btn sm${x === m ? ' dark' : ''}" data-act="specMode" data-mode="${x}">${titleCase(x)}</button>`).join('')}</div>`)}
        <div class="panel sticky scrollPane scroll">
          <div class="panelHead"><b>Specification editor</b></div>
          ${acc('Assignment', `<div class="stack">
            ${field('Reference', input('specs.reference', { after:'render' }))}
            <div class="grid2">
              ${field('Project', input('specs.project', { after:'render' }))}
              ${field('Client / partner', input('specs.client', { after:'render' }))}
              ${field('Supplier', input('specs.supplier', { after:'render' }))}
              ${field('Location', input('specs.location', { after:'render' }))}
              ${field('Date', input('specs.date', { type:'date', after:'render' }))}
              ${field('Logo', `<select data-model="specs.logoId" data-after="render">${logoOptions(S.specs.logoId)}</select>`)}
            </div>
            <div class="grid2">
              ${field('Page size', select('specs.pageSize', [['A4','A4'],['Letter','US Letter']], { after:'render' }))}
              ${field('Text density', select('specs.density', DENSITIES, { after:'render' }))}
            </div>
            ${field('Document title', input(`${p}.title`, { after:'render' }))}
          </div>`, true)}
          ${acc('Design preset', presetPicker('specs.preset', SPEC_PRESETS, { after:'render' }), true)}
          ${acc('Equipment list', listEditor(`${p}.equipment`, 'text', { addLabel:'Add equipment', ph:'Equipment item' }))}
          ${acc('Technical settings', listEditor(`${p}.settings`, 'text', { addLabel:'Add setting', ph:'Setting' }))}
          ${acc('Shot list', listEditor(`${p}.shotlist`, 'text', { addLabel:'Add shot', ph:'Shot' }))}
          ${acc('Style & delivery', `<div class="stack">
            ${field('Shooting / recording style', textarea(`${p}.styleText`, { rows:6, after:'render' }))}
            ${field('Delivery', textarea(`${p}.delivery`, { rows:5, after:'render' }))}
          </div>`)}
          ${acc('Pull from equipment register', `<div class="stack">
            <div class="note neutral">Add every available asset in a category from the Equipment Register to this specification.</div>
            ${field('Category', `<select id="specEqCat">${EQ_CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>`)}
            ${btn('Add available assets', { act:'specPullEq', cls:'btn sm' })}
          </div>`)}
        </div>
      </div>`;
  },
  preview(){
    const host = $('#specStage');
    if (!host) return;
    host.innerHTML = specPages();
    bindPane(host);
  },
  mounted(host){ bindPane($('#specStage')); fitStages(host); }
});

action('specMode', d => { S.specs.activeMode = d.mode; save(); renderView('specs'); });
action('specReset', () => confirmDialog('Reset the ' + specMode() + ' specification to the Narretrieve default?', () => {
  S.specs[specMode()] = JSON.parse(JSON.stringify(SPEC_DEFAULTS[specMode()]));
  save(); renderView('specs');
}, { yes:'Reset' }));
action('specPullEq', () => {
  const cat = $('#specEqCat').value;
  const list = S.equipment.filter(e => e.category === cat && e.status === 'Available')
    .map(e => [e.brand, e.name].filter(Boolean).join(' '));
  if (!list.length) return toast('No available assets in that category.', 'bad');
  const target = S.specs[specMode()].equipment;
  list.forEach(x => { if (!target.includes(x)) target.push(x); });
  save(); renderView('specs');
  toast(list.length + ' assets added', 'good');
});
action('specPdf', () => guard(exportPdf(pagesIn('specStage'), 'Narretrieve_' + S.specs.reference + '_' + specMode(), S.specs.pageSize)));
action('specPng', () => guard(exportPng(pagesIn('specStage'), 'Narretrieve_' + S.specs.reference + '_' + specMode())));
