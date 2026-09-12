/* ==========================================================================
   Business cards — 40 presets over 12 structural archetypes
   ========================================================================== */
function cardActive(){
  return S.cards.people.find(p => p.id === S.cards.activeId) || S.cards.people[0];
}
function cardIndex(){ return Math.max(0, S.cards.people.findIndex(p => p.id === cardActive().id)); }
function cardDims(){
  const f = S.cards.format === 'us' ? [88.9, 50.8] : S.cards.format === 'square' ? [65, 65] : [85, 55];
  return (S.cards.orientation === 'portrait' && S.cards.format !== 'square') ? [f[1], f[0]] : f;
}
function cardArch(id){
  const s = String(id || '');
  const has = w => s.includes(w);
  if (has('black-edition') || has('slate') || has('production-slate') || has('broadcast')) return 'slate';
  if (has('masthead') || has('publication') || has('magazine-cover') || has('documentary-title')) return 'masthead';
  if (has('column') || has('narrow')) return 'column';
  if (has('quote') || has('soundbite')) return 'quote';
  if (has('label') || has('archive') || has('press-pass') || has('caption')) return 'label';
  if (has('ticket') || has('dispatch')) return 'ticket';
  if (has('frame') || has('framed') || has('documentary-frame')) return 'frame';
  if (has('grid') || has('storyboard') || has('story-map') || has('timeline')) return 'grid';
  if (has('coral-edition') || has('band') || has('multimedia')) return 'band';
  if (has('contact-sheet') || has('transcript') || has('interview') || has('oral-history')) return 'sheet';
  if (has('center') || has('monograph') || has('human-story')) return 'center';
  return 'stack';
}
function cardFont(id){
  const s = String(id || '');
  if (/monograph|magazine|photo-essay|pull-quote|oral-history|human-story|feature/.test(s)) return 'Georgia,"Times New Roman",serif';
  if (/transcript|archive|dispatch|caption|contact-sheet|press-pass/.test(s)) return 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';
  if (/newspaper|newsroom|byline|dateline|storyline|report/.test(s)) return '"Helvetica Neue",Helvetica,Arial,sans-serif';
  return '"Inter","Poppins",Arial,sans-serif';
}
function cardCopy(p, key, fallback){
  const v = p.copy && p.copy[key] !== undefined ? p.copy[key] : fallback;
  return v == null ? '' : String(v);
}
function cardCopyEl(p, i, key, fallback, cls = 'cardKicker', style = ''){
  if (p.copy[key] === undefined) p.copy[key] = fallback;
  return `<span class="${cls}" data-edit="cards.people.${i}.copy.${key}" data-ph="${esc(fallback)}"${style ? ` style="${esc(style)}"` : ''}>${esc(cardCopy(p, key, fallback))}</span>`;
}
function cardEd(p, i, key, cls, ph){
  const v = p[key] == null ? '' : String(p[key]);
  return `<span class="${cls}${v.trim() ? '' : ' isEmpty'}" data-edit="cards.people.${i}.${key}" data-ph="${esc(ph)}">${esc(v)}</span>`;
}
function cardVars(p){
  /* Escaped: the font stacks contain double quotes and this lands in style="". */
  return esc([
    `--cAccent:${p.accent}`, `--cInk:${p.ink}`, `--cPaper:${p.paper}`,
    `--cBody:${cardFont(p.preset)}`, `--cDisplay:${cardFont(p.preset)}`
  ].join(';'));
}
function cardShell(p, extraStyle, inner, side){
  const [w, h] = cardDims();
  return `<div class="cardFace" data-card-side="${side}" style="${cardVars(p)};width:${w}mm;height:${h}mm;${extraStyle}">
    ${inner}${S.cards.showBleed ? '<div class="cardBleed"></div>' : ''}
  </div>`;
}
function cardMark(p){
  return `<img class="cardMark" src="${logoData(p.logoId)}" alt="">`;
}

function cardFront(p){
  const i = S.cards.people.indexOf(p);
  const arch = cardArch(p.preset);
  const pad = 'padding:7mm 7mm';
  const name = cardEd(p, i, 'name', 'cardName', 'Full name');
  const role = cardEd(p, i, 'title', 'cardRole', 'Role');
  const bio  = cardEd(p, i, 'bio', 'cardBio', 'Short descriptor');

  const body = {
    stack: () => `<div style="${pad};display:flex;flex-direction:column;height:100%;gap:0">
        ${cardMark(p)}
        <div style="flex:1 1 auto"></div>
        <div class="cardRule" style="margin-bottom:3mm"></div>
        ${name}${role}${bio}
      </div>`,
    masthead: () => `<div style="${pad};display:flex;flex-direction:column;height:100%">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:4mm">
          ${cardCopyEl(p, i, 'masthead', 'NARRETRIEVE', 'cardKicker', 'font-size:9px;letter-spacing:.3em')}
          ${cardCopyEl(p, i, 'edition', 'STORY EDITION', 'cardKicker', 'font-size:6px;opacity:.75')}
        </div>
        <div class="cardRule" style="margin:2.5mm 0 auto;border-top-width:2px"></div>
        <div>${name}${role}${bio}</div>
      </div>`,
    column: () => `<div style="${pad};display:grid;grid-template-columns:auto 1fr;gap:5mm;height:100%">
        <div style="border-right:1.2px solid var(--cAccent);padding-right:4mm;display:flex;flex-direction:column;justify-content:space-between">
          ${cardMark(p)}
          ${cardCopyEl(p, i, 'sideLabel', 'STORY', 'cardKicker', 'writing-mode:vertical-rl;transform:rotate(180deg);font-size:6px')}
        </div>
        <div style="display:flex;flex-direction:column;justify-content:center">${name}${role}${bio}</div>
      </div>`,
    quote: () => `<div style="${pad};display:flex;flex-direction:column;height:100%">
        ${cardCopyEl(p, i, 'quoteMark', '“', 'cardKicker', 'font-size:34px;line-height:.7;font-family:Georgia,serif;letter-spacing:0')}
        <div style="flex:1 1 auto;display:flex;align-items:center">${bio}</div>
        <div class="cardRule thin" style="margin:2.5mm 0"></div>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:3mm">
          <div>${name}${role}</div>${cardMark(p)}
        </div>
      </div>`,
    label: () => `<div style="${pad};height:100%;display:flex;flex-direction:column">
        <div style="border:1px solid var(--cAccent);padding:2mm 3mm;align-self:flex-start">
          ${cardCopyEl(p, i, 'heading', 'ARCHIVE / PERSON', 'cardKicker', 'font-size:6px')}
        </div>
        <div style="flex:1 1 auto"></div>
        ${name}${role}${bio}
        <div style="margin-top:3mm">${cardMark(p)}</div>
      </div>`,
    ticket: () => `<div style="height:100%;display:grid;grid-template-columns:1fr auto">
        <div style="${pad};display:flex;flex-direction:column;justify-content:space-between">
          ${cardCopyEl(p, i, 'heading', 'DISPATCH', 'cardKicker')}
          <div>${name}${role}${bio}</div>
        </div>
        <div style="border-left:1px dashed var(--cAccent);padding:7mm 4mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between">
          ${cardMark(p)}
          ${cardCopyEl(p, i, 'code', 'NRT / 001', 'cardKicker', 'writing-mode:vertical-rl;font-size:6px')}
        </div>
      </div>`,
    frame: () => `<div style="padding:4mm;height:100%">
        <div style="border:1px solid var(--cAccent);height:100%;padding:5mm;display:flex;flex-direction:column;justify-content:space-between">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:3mm">
            ${cardMark(p)}${cardCopyEl(p, i, 'frameLabel', 'FRAME 001', 'cardKicker', 'font-size:6px')}
          </div>
          <div>${name}${role}${bio}</div>
        </div>
      </div>`,
    grid: () => `<div style="${pad};height:100%;display:flex;flex-direction:column">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-top:.6px solid var(--cAccent);border-bottom:.6px solid var(--cAccent);padding:1.6mm 0;margin-bottom:auto">
          ${['beat1','beat2','beat3'].map((k, n) => cardCopyEl(p, i, k, ['CONTEXT','CHANGE','IMPACT'][n], 'cardKicker', 'font-size:5.6px')).join('')}
        </div>
        <div>${name}${role}${bio}</div>
        <div style="margin-top:3mm">${cardMark(p)}</div>
      </div>`,
    band: () => `<div style="height:100%;display:grid;grid-template-rows:auto 1fr">
        <div style="background:var(--cAccent);padding:3mm 7mm;display:flex;align-items:center;justify-content:space-between;gap:3mm">
          ${cardCopyEl(p, i, 'editionLine', 'NARRETRIEVE', 'cardKicker', 'color:#fff;font-size:7px;letter-spacing:.28em')}
          ${cardCopyEl(p, i, 'mediumLabel', 'MULTIMEDIA', 'cardKicker', 'color:#fff;font-size:5.6px;opacity:.85')}
        </div>
        <div style="padding:5mm 7mm 7mm;display:flex;flex-direction:column;justify-content:space-between">
          <div>${name}${role}${bio}</div>${cardMark(p)}
        </div>
      </div>`,
    sheet: () => `<div style="${pad};height:100%;display:flex;flex-direction:column;gap:2mm">
        ${cardCopyEl(p, i, 'heading', 'CONTACT SHEET', 'cardKicker')}
        <div class="cardRule thin"></div>
        <div style="flex:1 1 auto;display:flex;align-items:center">${name}</div>
        ${role}${bio}
        <div style="display:flex;justify-content:flex-end">${cardMark(p)}</div>
      </div>`,
    center: () => `<div style="${pad};height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:1mm">
        ${cardMark(p)}
        <div style="height:3mm"></div>
        ${name}${role}
        <div class="cardRule" style="width:16mm;margin:2mm auto"></div>
        ${bio}
      </div>`,
    slate: () => `<div style="${pad};height:100%;display:flex;flex-direction:column;justify-content:space-between;background:#1D1A1B;color:#F4EFEC">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:3mm">
          <img class="cardMark" src="${logoData(/white|light/i.test(logoById(p.logoId).name) ? p.logoId : 'logo4')}" alt="">
          ${cardCopyEl(p, i, 'slate', 'MULTIMEDIA / 001', 'cardKicker', 'font-size:6px')}
        </div>
        <div>
          <span class="cardName" style="color:#fff">${esc(p.name || '')}</span>
          ${role}
          <div class="cardBio" style="color:#B7ADA8">${esc(p.bio || '')}</div>
        </div>
      </div>`
  }[arch];

  const extra = arch === 'slate' ? 'background:#1D1A1B' : '';
  return cardShell(p, extra, body(), 'front');
}

function cardBack(p){
  const i = S.cards.people.indexOf(p);
  const [w] = cardDims();
  const qr = qrSvg(qrPayload(p), 58);
  const lines = [
    ['email', p.email, 'name@narretrieve.com'],
    ['phone', p.phone, '+254 …'],
    ['website', p.website, 'narretrieve.com'],
    ['linkedin', String(p.linkedin || '').replace(/^https?:\/\/(www\.)?/, ''), 'linkedin.com/in/…'],
    ['location', p.location, 'City, Country']
  ].filter(([, v]) => String(v || '').trim());

  return cardShell(p, '', `<div style="padding:7mm;height:100%;display:grid;grid-template-columns:1fr auto;gap:5mm">
      <div style="display:flex;flex-direction:column;min-width:0">
        ${cardEd(p, i, 'backHeading', 'cardKicker', 'CONTACT')}
        <div class="cardRule" style="margin:2mm 0 3mm"></div>
        <div class="cardContact" style="flex:1 1 auto">
          ${lines.map(([k, , ph]) => `<div>${cardEd(p, i, k === 'linkedin' ? 'linkedin' : k, '', ph)}</div>`).join('')}
        </div>
        ${cardEd(p, i, 'backFooter', 'cardKicker', COMPANY.tagline)}
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:2mm">
        ${cardMark(p)}
        ${qr}
        ${cardEd(p, i, 'qrLabel', 'cardKicker', 'SAVE CONTACT')}
      </div>
    </div>`, 'back');
}

function vcard(p){
  return ['BEGIN:VCARD','VERSION:3.0',
    'FN:' + (p.name || ''), 'TITLE:' + (p.title || ''), 'ORG:' + COMPANY.name,
    'EMAIL:' + (safeMail(p.email) || ''), 'TEL:' + safeTel(p.phone),
    'URL:https://' + String(p.website || 'narretrieve.com').replace(/^https?:\/\//, ''),
    'END:VCARD'].join('\n');
}
function qrPayload(p){
  if (p.qrTarget === 'website') return safeHttpUrl('https://' + String(p.website || '').replace(/^https?:\/\//, '')) || 'https://narretrieve.com';
  if (p.qrTarget === 'linkedin') return safeHttpUrl(p.linkedin) || 'https://narretrieve.com';
  if (p.qrTarget === 'email') return safeMail(p.email) ? 'mailto:' + p.email : 'https://narretrieve.com';
  return vcard(p);
}
function qrSvg(payload, size){
  try {
    const q = NRTQR.encode(payload, { ecLevel:'M' });
    const quiet = 3;
    const module = size / (q.size + quiet * 2);
    const path = NRTQR.toPath(q, module, quiet);
    return `<svg class="cardQr" width="${size}" height="${size}" viewBox="0 0 ${path.extent} ${path.extent}" aria-label="QR code"><rect width="${path.extent}" height="${path.extent}" fill="#fff"/><path d="${path.d}" shape-rendering="crispEdges"/></svg>`;
  } catch {
    return `<div class="cardQr" style="border:1px dashed var(--cAccent)"></div>`;
  }
}

module('cards', {
  render(){
    const p = cardActive();
    const i = cardIndex();
    const copyFields = CARD_PRESET_COPY[p.preset] || [];
    return `
      ${pageHead({
        kicker:'Identity',
        title:'Business Card Studio',
        blurb:'Editorial, documentary and publication-inspired card layouts. Presets set the structure only — every word on the card is yours to edit, on the form or on the card itself.',
        actions:
          btn('Add person', { act:'cardAdd' }) +
          btn('Duplicate', { act:'cardDup' }) +
          btn('Delete', { act:'cardDel', cls:'btn danger' })
      })}
      <div class="workspace">
        <div class="panel sticky">
          <div class="panelHead"><b>Team</b><span class="spacer"></span><span class="tag">${S.cards.people.length}</span></div>
          <div class="railList scroll" style="max-height:calc(100vh - 230px)">
            ${S.cards.people.map(x => `
              <button class="railItem${x.id === p.id ? ' on' : ''}" data-act="cardPick" data-id="${esc(x.id)}">
                <b>${esc(x.name || 'Untitled card')}</b><small>${esc(x.title || '—')}</small>
              </button>`).join('')}
          </div>
        </div>

        ${stage('cardStage', (p.name || 'Business card') + ' · ' + cardDims().join(' × ') + ' mm',
          `<div class="cardStage">${cardFront(p)}${S.cards.showBack ? cardBack(p) : ''}</div>`,
          btn('Front PNG', { act:'cardPng', cls:'btn sm', data:{ side:'front' } }) +
          btn('Back PNG', { act:'cardPng', cls:'btn sm', data:{ side:'back' } }) +
          btn('PDF (both sides)', { act:'cardPdf', cls:'btn primary sm' })
        )}

        <div class="panel sticky scrollPane scroll">
          <div class="panelHead"><b>Card editor</b></div>
          ${acc('Person', `<div class="stack">
            ${field('Full name', input(`cards.people.${i}.name`, { ph:'Full name', after:'render' }))}
            ${field('Role', input(`cards.people.${i}.title`, { ph:'Role' }))}
            ${field('Descriptor', textarea(`cards.people.${i}.bio`, { rows:2, ph:'Short descriptor' }))}
            ${field('Email', input(`cards.people.${i}.email`, { type:'email' }))}
            ${field('Phone', input(`cards.people.${i}.phone`, { type:'tel' }))}
            ${field('Website', input(`cards.people.${i}.website`))}
            ${field('LinkedIn', input(`cards.people.${i}.linkedin`, { type:'url' }))}
            ${field('Location', input(`cards.people.${i}.location`))}
          </div>`, true)}
          ${acc('Design preset', presetPicker(`cards.people.${i}.preset`, CARD_PRESETS, { after:'render' }), true)}
          ${copyFields.length ? acc('Preset wording', `<div class="stack">
            ${copyFields.map(([key, label, def]) => field(label, `<input type="text" data-model="cards.people.${i}.copy.${esc(key)}" value="${esc(cardCopy(p, key, def))}" placeholder="${esc(def)}">`)).join('')}
          </div>`, true) : ''}
          ${acc('Back of card', `<div class="stack">
            ${field('Back heading', input(`cards.people.${i}.backHeading`))}
            ${field('Back footer', input(`cards.people.${i}.backFooter`))}
            ${field('QR caption', input(`cards.people.${i}.qrLabel`))}
            ${field('QR code target', select(`cards.people.${i}.qrTarget`, [['vcard','Contact card (vCard)'],['website','Website'],['linkedin','LinkedIn'],['email','Email address']]))}
            ${checkbox('cards.showBack', 'Show the back of the card')}
          </div>`)}
          ${acc('Format & colour', `<div class="stack">
            <div class="grid2">
              ${field('Size', select('cards.format', [['eu','85 × 55 mm (EU)'],['us','88.9 × 50.8 mm (US)'],['square','65 × 65 mm']]))}
              ${field('Orientation', select('cards.orientation', [['landscape','Landscape'],['portrait','Portrait']]))}
            </div>
            ${field('Logo', `<select data-model="cards.people.${i}.logoId">${logoOptions(p.logoId)}</select>`)}
            <div class="grid3">
              ${field('Accent', `<input type="color" data-model="cards.people.${i}.accent" value="${esc(p.accent)}">`)}
              ${field('Paper', `<input type="color" data-model="cards.people.${i}.paper" value="${esc(p.paper)}">`)}
              ${field('Ink', `<input type="color" data-model="cards.people.${i}.ink" value="${esc(p.ink)}">`)}
            </div>
            ${checkbox('cards.showBleed', 'Show 3 mm safe-area guide')}
          </div>`)}
        </div>
      </div>`;
  },
  preview(){
    const host = $('#cardStage');
    if (!host) return;
    const p = cardActive();
    host.innerHTML = `<div class="cardStage">${cardFront(p)}${S.cards.showBack ? cardBack(p) : ''}</div>`;
    bindPane(host);
  },
  soft(){
    const p = cardActive();
    const row = $(`[data-act="cardPick"][data-id="${CSS.escape(p.id)}"] b`);
    if (row) row.textContent = p.name || 'Untitled card';
  },
  mounted(host){ bindPane($('#cardStage')); fitStages(host); }
});

action('cardPick', d => { S.cards.activeId = d.id; save(); renderView('cards'); });
action('cardAdd', () => {
  const p = makeCardPerson({ name:'New person', title:'ROLE' });
  S.cards.people.push(p); S.cards.activeId = p.id;
  save(); renderView('cards');
});
action('cardDup', () => {
  const src = cardActive();
  const p = Object.assign(JSON.parse(JSON.stringify(src)), { id: uid('card'), name: src.name + ' (copy)' });
  S.cards.people.push(p); S.cards.activeId = p.id;
  save(); renderView('cards');
});
action('cardDel', () => {
  if (S.cards.people.length <= 1) return toast('Keep at least one card profile.', 'bad');
  confirmDialog('Delete this business card profile?', () => {
    S.cards.people = S.cards.people.filter(x => x.id !== S.cards.activeId);
    S.cards.activeId = S.cards.people[0].id;
    save(); renderView('cards');
  }, { yes:'Delete', danger:true });
});
action('cardPng', d => {
  const node = $(`#cardStage [data-card-side="${d.side}"]`);
  if (!node) return toast('Turn the back of the card on first.', 'bad');
  guard(exportPng(node, 'Narretrieve_card_' + (cardActive().name || 'profile') + '_' + d.side));
});
action('cardPdf', () => {
  const nodes = $$('#cardStage .cardFace');
  const [w, h] = cardDims();
  guard((async () => {
    const pages = [];
    for (const node of nodes){
      const c = await nodeToCanvas(node, 8);
      pages.push({ data: c.toDataURL('image/jpeg', 0.96), widthPt: w * 2.8346, heightPt: h * 2.8346, pxW: c.width, pxH: c.height });
    }
    dlBytes(cleanFilename('Narretrieve_card_' + (cardActive().name || 'profile')) + '.pdf', 'application/pdf', buildPdf(pages));
    toast('Card PDF downloaded', 'good');
  })());
});
