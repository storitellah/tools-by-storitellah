/* ==========================================================================
   Consent Studio — informed-consent and release records
   ========================================================================== */
function activeRelease(){
  return S.consent.releases.find(r => r.id === S.consent.activeId) || S.consent.releases[0];
}
function releaseIndex(){ return Math.max(0, S.consent.releases.findIndex(r => r.id === activeRelease().id)); }
function consentScopeText(r){
  const m = r.mediaScope || {};
  const out = [];
  if (m.photo) out.push('photography');
  if (m.video) out.push('video');
  if (m.audio) out.push('audio');
  if (m.interview) out.push('interview / testimony');
  return out.length ? out.join(', ') : 'media documentation described for this assignment';
}
const CONSENT_SPECIALS = {
  child:'The parent or legal guardian is giving permission for the child or young person named below. Where appropriate, the child should also be asked for assent in language they understand.',
  location:'The authorised representative named below gives permission for Narretrieve and its authorised production team to photograph, film or record at the named property or institution, subject to the restrictions written on this form.',
  group:'This form records consent for the named group activity. Each participant should understand the purpose of the documentation and may decline participation or specific uses.',
  limited:'Only the uses clearly explained and agreed in this form are permitted. Written restrictions take priority over any general project-use wording.',
  withdrawal:'This document records a later change to an earlier consent record. It does not erase the original consent and should remain linked to it.',
  ngo:'This consent is based on informed, voluntary participation and a Do No Harm approach. Dignity, safeguarding, vulnerability and any anonymity or location restrictions must be respected.'
};
function defaultConsentText(r){
  const t = CONSENT_TYPES[r.type] || CONSENT_TYPES.general;
  const partner = r.clientName || 'the commissioning or partner organisation';
  return {
    brandName: COMPANY.name,
    title: r.title || t.title,
    consentIdLabel:'Consent ID',
    introHeading:'About this consent',
    introBody: CONSENT_SPECIALS[r.type] || `${t.standard} Participation is voluntary. The person giving consent may ask questions before signing and may state any restrictions that must be respected.`,
    collectorHeading:'Person collecting the consent',
    collectorBody:'I confirm that I have explained the purpose and content of this release to the participant, including any relevant use, safeguarding or protection information, either directly or through an interpreter where required.',
    personHeading: r.type === 'location' ? 'Authorised representative' : 'Person giving consent',
    documentationHeading:'What is being documented',
    documentationBody:`This project may involve ${consentScopeText(r)}. The purpose of the documentation, who commissioned the work, and how approved material may be used should be explained before the form is signed.`,
    useHeading:'How approved material may be used',
    useBody:`${t.section} Narretrieve may deliver approved material to ${partner} and may work with authorised subcontractors or production suppliers to create, edit and deliver the material for the named project.`,
    protectionHeading:'Protection, dignity and restrictions',
    rightsHeading:'Questions and changing consent',
    rightsBody:'Questions or later requests to change consent can be directed to Narretrieve Productions LTD or the named project partner. A later change should be recorded as an amendment rather than silently replacing the original consent record.',
    futureHeading:'Future contact',
    futureQuestion:'May Narretrieve contact you later about follow-up interviews, photographs, video or project updates?',
    signatureHeading:'Declaration and signatures',
    signatureBody:'By signing below, the parties confirm that the consent information has been explained, that the participant has had the opportunity to ask questions, and that the permissions selected in this form reflect the participant’s choices.',
    footer:'Signed forms should be stored securely with the project consent records.'
  };
}
function ensureConsentText(r, reset = false){
  const defs = defaultConsentText(r);
  if (reset || !r.text || typeof r.text !== 'object') r.text = defs;
  else Object.keys(defs).forEach(k => { if (r.text[k] === undefined) r.text[k] = defs[k]; });
  return r;
}
function optLine(on, path, label){
  return `<button class="opt" data-act="toggleOpt" data-path="${esc(path)}" style="background:none;border:0;padding:0;text-align:left;cursor:pointer;width:100%">
    <span class="optBox${on ? ' on' : ''}">${on ? '✓' : ''}</span><span>${esc(label)}</span></button>`;
}
action('toggleOpt', d => {
  setPath(S, d.path, !getPath(S, d.path));
  scheduleSave();
  renderView(activeView);
});

function consentBlocks(){
  const r = ensureConsentText(activeRelease());
  const i = releaseIndex();
  const p = `consent.releases.${i}`;
  const T = `${p}.text`;
  const mask = S.consent.privacy ? ' style="filter:blur(4px)"' : '';
  const B = [];

  B.push({ html: `<div class="docBlock metaStrip">
    <span><b>Project:</b> ${editable(`${p}.projectName`, { tag:'span', ph:'Project' })}</span>
    <span><b>Assignment:</b> ${editable(`${p}.assignment`, { tag:'span', ph:'Assignment' })}</span>
    <span><b>Location:</b> ${editable(`${p}.location`, { tag:'span', ph:'Location' })}</span>
    <span><b>Date:</b> ${editable(`${p}.date`, { tag:'span', ph:'Date' })}</span>
    <span><b>Status:</b> ${esc(r.status)}</span>
  </div>` });

  B.push({ html: `<div class="docBlock labelled">
    <h4>1. ${editable(`${T}.introHeading`, { tag:'span', ph:'Heading' })}</h4>
    ${editable(`${T}.introBody`, { tag:'p', ph:'Introduction', multi:true })}
  </div>` });

  B.push({ html: `<div class="docBlock labelled">
    <h4>2. ${editable(`${T}.collectorHeading`, { tag:'span', ph:'Heading' })}</h4>
    ${editable(`${T}.collectorBody`, { tag:'p', ph:'Declaration', multi:true })}
    <div class="fGrid" style="margin-top:2.6mm">
      ${fLine('Name', `${p}.collector.name`)}
      ${fLine('Role', `${p}.collector.role`)}
    </div>
  </div>` });

  B.push({ html: `<div class="docBlock labelled"${mask}>
    <h4>3. ${editable(`${T}.personHeading`, { tag:'span', ph:'Heading' })}</h4>
    <div class="fGrid">
      ${fLine('Full name / representative', `${p}.participant.name`)}
      ${fLine('Age / date of birth', `${p}.participant.age`)}
      ${fLine('Address / location', `${p}.participant.address`)}
      ${fLine('Phone / email', `${p}.participant.contact`)}
    </div>
    ${r.type === 'child' ? `<div class="fGrid" style="margin-top:3mm">
      ${fLine('Parent / guardian name', `${p}.participant.guardian`)}
      ${fLine('Relationship to the child', `${p}.participant.guardianRelation`)}
    </div>` : ''}
  </div>` });

  B.push({ html: `<div class="docBlock labelled">
    <h4>4. ${editable(`${T}.documentationHeading`, { tag:'span', ph:'Heading' })}</h4>
    ${editable(`${T}.documentationBody`, { tag:'p', ph:'Body', multi:true })}
    <div class="optRow" style="margin-top:2.4mm">
      ${optLine(r.mediaScope.photo, `${p}.mediaScope.photo`, 'Photography')}
      ${optLine(r.mediaScope.video, `${p}.mediaScope.video`, 'Video recording')}
      ${optLine(r.mediaScope.audio, `${p}.mediaScope.audio`, 'Audio recording')}
      ${optLine(r.mediaScope.interview, `${p}.mediaScope.interview`, 'Interview / testimony')}
    </div>
  </div>` });

  B.push({ html: `<div class="docBlock labelled">
    <h4>5. ${editable(`${T}.useHeading`, { tag:'span', ph:'Heading' })}</h4>
    ${editable(`${T}.useBody`, { tag:'p', ph:'Body', multi:true })}
    <div class="optRow c3" style="margin-top:2.4mm">
      ${Object.entries(CONSENT_PERMISSION_LABELS)
        .filter(([k]) => !['photo','video','audio','interview'].includes(k))
        .map(([k, label]) => optLine(!!r.permissions[k], `${p}.permissions.${k}`, label)).join('')}
    </div>
  </div>` });

  B.push({ html: `<div class="docBlock labelled">
    <h4>6. ${editable(`${T}.protectionHeading`, { tag:'span', ph:'Heading' })}</h4>
    ${editable(`${p}.specialInstructions`, { tag:'p', ph:'Record any limits on identity, names, locations, sensitive information, publication channels or safeguarding here.', multi:true, style:'border:.6pt solid var(--pLine);padding:3mm;min-height:14mm' })}
  </div>` });

  B.push({ html: `<div class="docBlock labelled">
    <h4>7. ${editable(`${T}.futureHeading`, { tag:'span', ph:'Heading' })}</h4>
    <p>${editable(`${T}.futureQuestion`, { tag:'span', ph:'Question', multi:true })}</p>
    <div class="yesNo" style="margin-top:2mm">
      <button class="opt" data-act="futureContact" data-value="yes" style="background:none;border:0;padding:0;cursor:pointer"><span class="optBox${r.futureContact === 'yes' ? ' on' : ''}">${r.futureContact === 'yes' ? '✓' : ''}</span><span>Yes</span></button>
      <button class="opt" data-act="futureContact" data-value="no" style="background:none;border:0;padding:0;cursor:pointer"><span class="optBox${r.futureContact === 'no' ? ' on' : ''}">${r.futureContact === 'no' ? '✓' : ''}</span><span>No</span></button>
    </div>
    <div class="fGrid c1" style="margin-top:2.6mm">${fLine('Best contact / instructions', `${p}.bestContact`)}</div>
  </div>` });

  B.push({ html: `<div class="docBlock labelled">
    <h4>8. ${editable(`${T}.rightsHeading`, { tag:'span', ph:'Heading' })}</h4>
    ${editable(`${T}.rightsBody`, { tag:'p', ph:'Body', multi:true })}
  </div>` });

  B.push({ html: `<div class="docBlock labelled">
    <h4>9. ${editable(`${T}.signatureHeading`, { tag:'span', ph:'Heading' })}</h4>
    ${editable(`${T}.signatureBody`, { tag:'p', ph:'Declaration', multi:true })}
    <div class="sigGrid" style="margin-top:3mm;padding-top:0">
      ${sigCell(`${p}.participantSig`, r.participantSig, r.participant.name || 'Participant', 'Participant', `${p}.participant.name`, null)}
      ${sigCell(`${p}.collectorSig`, r.collectorSig, r.collector.name || 'Narretrieve representative', 'Narretrieve representative', `${p}.collector.name`, null)}
    </div>
    ${r.type === 'child' ? `<div class="sigGrid c1" style="margin-top:4mm;padding-top:0">
      ${sigCell(`${p}.guardianSig`, r.guardianSig, r.participant.guardian || 'Parent / guardian', 'Parent / legal guardian', `${p}.participant.guardian`, null)}
    </div>` : ''}
  </div>` });

  return B;
}
function consentPages(){
  const r = ensureConsentText(activeRelease());
  const i = releaseIndex();
  const p = `consent.releases.${i}`;
  const T = `${p}.text`;
  const head = `<div class="docHead ${presetDef(r.preset).head}">
      ${r.logoId ? `<img class="logo" src="${logoData(r.logoId)}" alt="">` : ''}
      <div class="titleBlock">
        <div class="org">${editable(`${T}.brandName`, { tag:'span', ph:'Organisation' })}</div>
        <h3>${editable(`${T}.title`, { tag:'span', ph:'Document title' })}</h3>
        ${r.showConsentId ? `<div class="ref">${editable(`${T}.consentIdLabel`, { tag:'span', ph:'Consent ID' })}: ${editable(`${p}.consentId`, { tag:'span', ph:'—' })}</div>` : ''}
      </div></div>`;
  const foot = `<div class="docFoot">
      <span>${editable(`${T}.footer`, { tag:'span', ph:'Footer note' })}</span>
      <span>${esc(r.consentId)} · {{page}}</span></div>`;
  return paginate(consentBlocks(), {
    pageClass: presetClasses(r.preset, r.pageSize, r.density), style: presetStyle(r.preset),
    headHtml: head, footHtml: foot, autoFit: r.density === 'auto', spine:'CONSENT'
  });
}

action('futureContact', d => {
  activeRelease().futureContact = d.value;
  scheduleSave(); renderView('consent');
});

/* ---- right-hand panels --------------------------------------------------- */
const CONSENT_PANELS = [
  ['forms','Release form'], ['projects','Projects'], ['participants','Participants'],
  ['templates','Templates'], ['register','Consent register'], ['exports','Exports'], ['settings','Settings']
];
function consentPanelBody(){
  const r = ensureConsentText(activeRelease());
  const i = releaseIndex();
  const p = `consent.releases.${i}`;
  switch (S.consent.panel){
    case 'projects': return `
      ${acc('Projects', listEditor('consent.projects', [
        { key:'name', label:'Project name' }, { key:'client', label:'Client / partner' },
        { key:'location', label:'Location' }, { key:'lead', label:'Project lead' },
        { key:'notes', label:'Notes', type:'textarea', rows:2 }
      ], { addLabel:'Add project' }), true)}
      ${acc('Link this release', `<div class="stack">
        ${field('Project on this release', input(`${p}.projectName`, { after:'render' }))}
        ${field('Client / partner', input(`${p}.clientName`, { after:'render' }))}
        ${field('Assignment', input(`${p}.assignment`, { after:'render' }))}
        ${field('Location', input(`${p}.location`, { after:'render' }))}
      </div>`, true)}`;

    case 'participants': return acc('Participant details', `<div class="stack">
        ${field('Full name / representative', input(`${p}.participant.name`, { after:'render' }))}
        <div class="grid2">
          ${field('Age / date of birth', input(`${p}.participant.age`, { after:'render' }))}
          ${field('Phone / email', input(`${p}.participant.contact`, { after:'render' }))}
        </div>
        ${field('Address / location', input(`${p}.participant.address`, { after:'render' }))}
        ${field('Parent / guardian', input(`${p}.participant.guardian`, { after:'render' }))}
        ${field('Relationship', input(`${p}.participant.guardianRelation`, { after:'render' }))}
        <div class="docRule" style="margin:4px 0"></div>
        ${field('Collector name', input(`${p}.collector.name`, { after:'render' }))}
        ${field('Collector role', input(`${p}.collector.role`, { after:'render' }))}
        <div class="inline">
          ${btn('Participant signs', { act:'drawSig', cls:'btn sm primary', data:{ path:`${p}.participantSig`, name: r.participant.name || 'Participant' } })}
          ${btn('Collector signs', { act:'drawSig', cls:'btn sm', data:{ path:`${p}.collectorSig`, name: r.collector.name || 'Collector' } })}
        </div>
      </div>`, true);

    case 'templates': return `
      ${acc('Release type', `<div class="stack">
        <div class="note neutral">Applying a release type rewrites the document wording and the default media scope for this record. Names, signatures and restrictions are kept.</div>
        <div class="presetGrid scroll" style="max-height:340px">
          ${Object.entries(CONSENT_TYPES).map(([key, t]) => `
            <button class="presetTile${r.type === key ? ' on' : ''}" data-act="applyConsentType" data-key="${esc(key)}">
              ${esc(t.name)}<small>${esc(String(t.standard).slice(0, 60))}…</small></button>`).join('')}
        </div>
      </div>`, true)}
      ${acc('Document wording', `<div class="stack">
        ${['introHeading','introBody','collectorHeading','collectorBody','personHeading','documentationHeading','documentationBody','useHeading','useBody','protectionHeading','futureHeading','futureQuestion','signatureHeading','signatureBody','footer']
          .map(k => field(titleCase(k.replace(/([A-Z])/g, ' $1')), /Body|Question/.test(k)
            ? textarea(`${p}.text.${k}`, { rows:3, after:'render' })
            : input(`${p}.text.${k}`, { after:'render' }))).join('')}
        ${btn('Reset wording to the template default', { act:'resetConsentText', cls:'btn sm' })}
      </div>`)}`;

    case 'register': {
      const rows = S.consent.releases;
      return `${acc('Consent register', `
        <div class="tableWrap" style="max-height:420px;border:1px solid var(--line);border-radius:var(--r-s)">
          <table class="data"><thead><tr><th>Consent ID</th><th>Participant</th><th>Type</th><th>Status</th><th>Signed</th></tr></thead>
          <tbody>${rows.map(x => `<tr data-act="relPick" data-id="${esc(x.id)}"${x.id === r.id ? ' class="on"' : ''}>
            <td>${esc(x.consentId)}</td><td>${esc(x.participant.name || '—')}</td>
            <td>${esc((CONSENT_TYPES[x.type] || {}).name || x.type)}</td>
            <td><span class="tag${x.status === 'Completed' ? ' ok' : ''}">${esc(x.status)}</span></td>
            <td>${x.participantSig ? '<span class="tag ok">Yes</span>' : '<span class="tag">No</span>'}</td>
          </tr>`).join('')}</tbody></table>
        </div>
        <div class="inline" style="margin-top:10px">${btn('Download register CSV', { act:'consentCsv', cls:'btn sm' })}</div>`, true)}`;
    }

    case 'exports': return acc('Exports & backup', `<div class="stack">
        ${btn('Export this release as PDF', { act:'relPdf', cls:'btn block primary' })}
        ${btn('Export this release as PNG', { act:'relPng', cls:'btn block' })}
        ${btn('Download consent register CSV', { act:'consentCsv', cls:'btn block' })}
        ${btn('Export all consent records as JSON', { act:'consentJson', cls:'btn block' })}
        <div class="note neutral">Consent records contain personal data. Store exports securely and follow the project safeguarding rules for sharing.</div>
      </div>`, true);

    case 'settings': return acc('Record settings', `<div class="stack">
        <div class="grid2">
          ${field('Status', select(`${p}.status`, CONSENT_STATUSES, { after:'render' }))}
          ${field('Language', select(`${p}.language`, CONSENT_LANGUAGES, { after:'render' }))}
          ${field('Page size', select(`${p}.pageSize`, [['A4','A4'],['Letter','US Letter']], { after:'render' }))}
          ${field('Text density', select(`${p}.density`, DENSITIES, { after:'render' }))}
          ${field('Logo', `<select data-model="${p}.logoId" data-after="render">${logoOptions(r.logoId)}</select>`)}
        </div>
        ${field('Consent ID', input(`${p}.consentId`, { after:'render' }))}
        ${checkbox(`${p}.showConsentId`, 'Show the consent ID on the document', { after:'render' })}
        ${checkbox('consent.privacy', 'Privacy screen — blur participant details on screen', { after:'render' })}
        <div class="docRule" style="margin:4px 0"></div>
        <div class="inline">
          ${btn('Duplicate release', { act:'relDup', cls:'btn sm' })}
          ${btn('Record an amendment', { act:'relAmend', cls:'btn sm' })}
          ${btn('Delete release', { act:'relDel', cls:'btn sm danger' })}
        </div>
      </div>`, true);

    default: return `
      ${acc('Release', `<div class="stack">
        <div class="grid2">
          ${field('Release type', select(`${p}.type`, Object.entries(CONSENT_TYPES).map(([k, t]) => [k, t.name]), { after:'render' }))}
          ${field('Status', select(`${p}.status`, CONSENT_STATUSES, { after:'render' }))}
        </div>
        ${field('Document title', input(`${p}.text.title`, { after:'render' }))}
        <div class="grid2">
          ${field('Consent ID', input(`${p}.consentId`, { after:'render' }))}
          ${field('Date', input(`${p}.date`, { type:'date', after:'render' }))}
        </div>
        ${field('Project', input(`${p}.projectName`, { after:'render' }))}
        ${field('Assignment', input(`${p}.assignment`, { after:'render' }))}
        ${field('Location', input(`${p}.location`, { after:'render' }))}
      </div>`, true)}
      ${acc('Design preset', presetPicker(`${p}.preset`, CONSENT_DOC_PRESETS, { after:'render' }), true)}
      ${acc('Person giving consent', `<div class="stack">
        ${field('Full name', input(`${p}.participant.name`, { after:'render' }))}
        <div class="grid2">
          ${field('Age / date of birth', input(`${p}.participant.age`, { after:'render' }))}
          ${field('Phone / email', input(`${p}.participant.contact`, { after:'render' }))}
        </div>
        ${field('Address / location', input(`${p}.participant.address`, { after:'render' }))}
      </div>`, true)}
      ${acc('What the consent covers', `<div class="stack">
        <div class="grid2">
          ${checkbox(`${p}.mediaScope.photo`, 'Photography', { after:'render' })}
          ${checkbox(`${p}.mediaScope.video`, 'Video recording', { after:'render' })}
          ${checkbox(`${p}.mediaScope.audio`, 'Audio recording', { after:'render' })}
          ${checkbox(`${p}.mediaScope.interview`, 'Interview / testimony', { after:'render' })}
        </div>
      </div>`, true)}
      ${acc('Permissions', `<div class="grid2">
        ${Object.entries(CONSENT_PERMISSION_LABELS).filter(([k]) => !['photo','video','audio','interview'].includes(k))
          .map(([k, label]) => checkbox(`${p}.permissions.${k}`, label, { after:'render' })).join('')}
      </div>`)}
      ${acc('Restrictions & contact', `<div class="stack">
        ${field('Special instructions / restrictions', textarea(`${p}.specialInstructions`, { rows:4, after:'render' }))}
        ${field('Future contact', select(`${p}.futureContact`, [['yes','Yes'],['no','No']], { after:'render' }))}
        ${field('Best contact / instructions', input(`${p}.bestContact`, { after:'render' }))}
      </div>`)}`;
  }
}

module('consent', {
  render(){
    const r = ensureConsentText(activeRelease());
    return `
      ${pageHead({
        kicker:'Informed consent · local-first',
        title:'Consent Studio',
        blurb:'Professional narrative consent and release forms with granular permissions and handwritten signatures for the person giving consent and the person collecting it.',
        actions:
          btn(S.consent.privacy ? 'Privacy screen on' : 'Privacy screen', { act:'consentPrivacy', cls: S.consent.privacy ? 'btn dark' : 'btn' }) +
          btn('Field mode', { act:'consentField' }) +
          btn('New release', { act:'relNew', cls:'btn primary' }) +
          btn('PDF', { act:'relPdf' })
      })}
      <div class="workspace">
        <div class="panel sticky scrollPane scroll">
          <div class="panelHead"><b>Consent Studio</b></div>
          <div class="railList">
            ${CONSENT_PANELS.map(([id, label]) => `
              <button class="railItem${S.consent.panel === id ? ' on' : ''}" data-act="consentPanel" data-panel="${id}"><b>${esc(label)}</b></button>`).join('')}
          </div>
          <div class="panelHead"><b>Records</b><span class="spacer"></span><span class="tag">${S.consent.releases.length}</span></div>
          <div class="railList">
            ${S.consent.releases.map(x => `
              <button class="railItem${x.id === r.id ? ' on' : ''}" data-act="relPick" data-id="${esc(x.id)}">
                <b>${esc(x.participant.name || 'Unnamed participant')}</b>
                <small>${esc(x.consentId)} · ${esc((CONSENT_TYPES[x.type] || {}).name || x.type)} · ${esc(x.status)}</small>
              </button>`).join('')}
          </div>
        </div>

        ${stage('consentStage', (r.text.title || 'Release') + ' · ' + r.consentId, consentPages(),
          btn('PNG', { act:'relPng', cls:'btn sm' }))}

        <div class="panel sticky scrollPane scroll">
          <div class="panelHead"><b>${esc((CONSENT_PANELS.find(x => x[0] === S.consent.panel) || CONSENT_PANELS[0])[1])}</b></div>
          ${consentPanelBody()}
        </div>
      </div>`;
  },
  preview(){
    const host = $('#consentStage');
    if (!host) return;
    host.innerHTML = consentPages();
    bindPane(host);
  },
  mounted(host){ bindPane($('#consentStage')); fitStages(host); }
});

action('consentPanel', d => { S.consent.panel = d.panel; save(); renderView('consent'); });
action('consentPrivacy', () => { S.consent.privacy = !S.consent.privacy; save(); renderView('consent'); });
action('relPick', d => { S.consent.activeId = d.id; save(); renderView('consent'); });
function newRelease(type = 'general'){
  const r = makeRelease(type);
  S.consent.releases.push(r);
  S.consent.activeId = r.id;
  save();
  return r;
}
action('relNew', () => { newRelease(activeRelease().type || 'general'); renderView('consent'); toast('New consent release created', 'good'); });
action('relDup', () => {
  const src = activeRelease();
  const r = JSON.parse(JSON.stringify(src));
  r.id = uid('rel');
  r.consentId = `NR-CR-${year()}-${String(S.consent.releases.length + 1).padStart(6, '0')}`;
  r.participantSig = ''; r.collectorSig = ''; r.guardianSig = ''; r.status = 'Draft';
  S.consent.releases.push(r); S.consent.activeId = r.id;
  save(); renderView('consent');
});
action('relAmend', () => {
  const src = activeRelease();
  const r = JSON.parse(JSON.stringify(src));
  r.id = uid('rel');
  r.consentId = src.consentId + '-A';
  r.status = 'Amended';
  r.participantSig = ''; r.collectorSig = '';
  S.consent.releases.push(r); S.consent.activeId = r.id;
  save(); renderView('consent');
  toast('Amendment record created and linked by ID', 'good');
});
action('relDel', () => {
  if (S.consent.releases.length <= 1) return toast('Keep at least one consent record.', 'bad');
  confirmDialog('Delete this consent record? Signed consent records should normally be archived instead of deleted.', () => {
    S.consent.releases = S.consent.releases.filter(x => x.id !== S.consent.activeId);
    S.consent.activeId = S.consent.releases[0].id;
    save(); renderView('consent');
  }, { yes:'Delete', danger:true });
});
action('applyConsentType', d => {
  const r = activeRelease();
  confirmDialog('Apply the ' + (CONSENT_TYPES[d.key] || {}).name + ' wording to this record?', () => {
    r.type = d.key;
    r.mediaScope = Object.assign({}, CONSENT_MEDIA_DEFAULTS[d.key] || CONSENT_MEDIA_DEFAULTS.general);
    r.title = (CONSENT_TYPES[d.key] || {}).title || r.title;
    ensureConsentText(r, true);
    save(); renderView('consent');
    toast('Release type applied', 'good');
  }, { yes:'Apply' });
});
action('resetConsentText', () => confirmDialog('Reset the document wording to the template default?', () => {
  ensureConsentText(activeRelease(), true); save(); renderView('consent');
}, { yes:'Reset' }));
action('relPdf', () => guard(exportPdf(pagesIn('consentStage'), 'Narretrieve_consent_' + activeRelease().consentId, activeRelease().pageSize)));
action('relPng', () => guard(exportPng(pagesIn('consentStage'), 'Narretrieve_consent_' + activeRelease().consentId)));
action('consentCsv', () => {
  const keys = ['consentId','type','status','participant','age','contact','address','project','assignment','location','date','photo','video','audio','interview','signed','restrictions'];
  const rows = S.consent.releases.map(r => ({
    consentId:r.consentId, type:(CONSENT_TYPES[r.type] || {}).name || r.type, status:r.status,
    participant:r.participant.name, age:r.participant.age, contact:r.participant.contact, address:r.participant.address,
    project:r.projectName, assignment:r.assignment, location:r.location, date:r.date,
    photo:r.mediaScope.photo ? 'Yes' : 'No', video:r.mediaScope.video ? 'Yes' : 'No',
    audio:r.mediaScope.audio ? 'Yes' : 'No', interview:r.mediaScope.interview ? 'Yes' : 'No',
    signed:r.participantSig ? 'Yes' : 'No', restrictions:r.specialInstructions
  }));
  dlText('Narretrieve_consent_register_' + today() + '.csv', 'text/csv', toCsv(rows, keys));
  toast('Consent register downloaded', 'good');
});
action('consentJson', () => {
  dlText('Narretrieve_consent_records_' + today() + '.json', 'application/json', JSON.stringify(S.consent, null, 2));
});

/* ---- field mode: guided capture ----------------------------------------- */
const FIELD_STEPS = [
  { title:'Who is giving consent?', body(p){ return `<div class="stack">
      ${field('Full name', input(`${p}.participant.name`, { after:'none' }))}
      <div class="grid2">
        ${field('Age / date of birth', input(`${p}.participant.age`, { after:'none' }))}
        ${field('Phone / email', input(`${p}.participant.contact`, { after:'none' }))}
      </div>
      ${field('Address / location', input(`${p}.participant.address`, { after:'none' }))}
    </div>`; } },
  { title:'What is being recorded?', body(p){ return `<div class="grid2">
      ${checkbox(`${p}.mediaScope.photo`, 'Photography', { after:'none' })}
      ${checkbox(`${p}.mediaScope.video`, 'Video recording', { after:'none' })}
      ${checkbox(`${p}.mediaScope.audio`, 'Audio recording', { after:'none' })}
      ${checkbox(`${p}.mediaScope.interview`, 'Interview / testimony', { after:'none' })}
    </div>`; } },
  { title:'Where may the material be used?', body(p){ return `<div class="grid2">
      ${Object.entries(CONSENT_PERMISSION_LABELS).filter(([k]) => !['photo','video','audio','interview'].includes(k))
        .map(([k, label]) => checkbox(`${p}.permissions.${k}`, label, { after:'none' })).join('')}
    </div>`; } },
  { title:'Any restrictions to respect?', body(p){ return `<div class="stack">
      ${field('Restrictions, safeguarding or identity limits', textarea(`${p}.specialInstructions`, { rows:5, after:'none' }))}
      ${field('Future contact', select(`${p}.futureContact`, [['yes','Yes'],['no','No']], { after:'none' }))}
      ${field('Best contact', input(`${p}.bestContact`, { after:'none' }))}
    </div>`; } },
  { title:'Signatures', body(p){
      const r = activeRelease();
      return `<div class="stack">
        <div class="note neutral">Read the form aloud where needed, confirm the participant understands, then capture both signatures.</div>
        <div class="inline">
          ${btn(r.participantSig ? 'Participant signed ✓' : 'Participant signs', { act:'drawSig', cls: r.participantSig ? 'btn sm' : 'btn sm primary', data:{ path:`${p}.participantSig`, name: r.participant.name || 'Participant' } })}
          ${btn(r.collectorSig ? 'Collector signed ✓' : 'Collector signs', { act:'drawSig', cls: r.collectorSig ? 'btn sm' : 'btn sm primary', data:{ path:`${p}.collectorSig`, name: r.collector.name || 'Collector' } })}
        </div>
        ${field('Status', select(`${p}.status`, CONSENT_STATUSES, { after:'none' }))}
      </div>`; } }
];
let fieldStep = 0;
action('consentField', () => { fieldStep = 0; renderFieldStep(); });
action('fieldStep', d => {
  fieldStep = clamp(Number(fieldStep) + Number(d.delta), 0, FIELD_STEPS.length - 1);
  renderFieldStep();
});
action('fieldClose', () => { $('#modalHost').innerHTML = ''; save(); renderView('consent'); });
function renderFieldStep(){
  const p = `consent.releases.${releaseIndex()}`;
  const step = FIELD_STEPS[fieldStep];
  const host = $('#modalHost');
  host.innerHTML = `<div class="overlay">
    <div class="dialog" style="max-width:620px">
      <div class="inline" style="justify-content:space-between">
        <span class="kicker">Field mode · step ${fieldStep + 1} of ${FIELD_STEPS.length}</span>
        ${btn('Close', { act:'fieldClose', cls:'btn xs ghost' })}
      </div>
      <h3 style="margin-top:8px">${esc(step.title)}</h3>
      <div class="bar" style="margin:10px 0 16px"><i style="width:${((fieldStep + 1) / FIELD_STEPS.length) * 100}%"></i></div>
      ${step.body(p)}
      <div class="dialogActions">
        ${fieldStep > 0 ? btn('Back', { act:'fieldStep', cls:'btn', data:{ delta:-1 } }) : ''}
        ${fieldStep < FIELD_STEPS.length - 1
          ? btn('Next', { act:'fieldStep', cls:'btn primary', data:{ delta:1 } })
          : btn('Finish', { act:'fieldClose', cls:'btn primary' })}
      </div>
    </div></div>`;
  bindPane(host);
}
