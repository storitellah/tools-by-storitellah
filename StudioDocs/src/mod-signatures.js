/* ==========================================================================
   Email signatures — Gmail-safe table markup, 48 layout presets
   ========================================================================== */
function sigActive(){
  return S.signatures.people.find(p => p.id === S.signatures.activeId) || S.signatures.people[0];
}
function sigIndex(){
  return Math.max(0, S.signatures.people.findIndex(p => p.id === sigActive().id));
}
/* Every preset is resolved to a layout archetype plus type treatment, so a
   preset can never reference a layout that does not exist. */
function sigLayout(id){
  const s = String(id || '');
  const has = w => s.includes(w);
  let arch = 'lockup';
  if (has('vertical') || has('column')) arch = 'stack';
  else if (has('masthead') || has('desk')) arch = 'masthead';
  else if (has('split')) arch = 'split';
  else if (has('centered')) arch = 'centered';
  else if (has('text') || has('minimal-v11') || has('nyt-minimal')) arch = 'text';
  else if (has('rail') || has('public-radio') || has('bar')) arch = 'bar';
  else if (has('compact') || has('wire')) arch = 'compact';
  else if (has('byline')) arch = 'byline';
  else if (has('rule')) arch = 'rule';
  const serif = has('serif') || s.startsWith('nyt') || s.startsWith('magazine') || s.startsWith('classic-serif');
  return {
    arch,
    font: serif ? 'Georgia, "Times New Roman", serif' : 'Arial, Helvetica, sans-serif',
    upper: has('newspaper') || has('ap-') || has('masthead') || has('archive'),
    accentBar: arch === 'bar',
    rule: !has('borderless') && arch !== 'text',
    tight: has('compact')
  };
}

function sigVal(p, key, i, mode){
  const v = p[key] == null ? '' : String(p[key]);
  if (mode === 'email') return esc(v);
  const empty = !v.trim();
  return `<span data-edit="signatures.people.${i}.${key}" data-ph="${esc(SIG_PH[key] || '')}"${empty ? ' class="isEmpty"' : ''}>${esc(v)}</span>`;
}
const SIG_PH = {
  name:'Full name', title:'Job title', descriptor:'One-line description', tagline:'Tagline',
  email:'name@narretrieve.com', phone:'+254 …', website:'narretrieve.com', location:'City, Country', company:'Company'
};

function sigLinks(p, i, mode, L){
  const web = String(p.website || '').replace(/^https?:\/\//, '');
  const bits = [];
  if (p.email) bits.push(mode === 'email'
    ? `<a href="mailto:${esc(safeMail(p.email))}" style="color:${p.bodyColor};text-decoration:none">${esc(p.email)}</a>`
    : sigVal(p, 'email', i, mode));
  if (p.phone) bits.push(mode === 'email'
    ? `<a href="tel:${esc(safeTel(p.phone))}" style="color:${p.bodyColor};text-decoration:none">${esc(p.phone)}</a>`
    : sigVal(p, 'phone', i, mode));
  const line2 = [];
  if (web) line2.push(mode === 'email'
    ? `<a href="${esc(safeHttpUrl('https://' + web) || 'https://narretrieve.com')}" style="color:${p.accent};text-decoration:none">${esc(web)}</a>`
    : sigVal(p, 'website', i, mode));
  if (p.location) line2.push(sigVal(p, 'location', i, mode));
  const social = [];
  if (p.linkedin) social.push(mode === 'email'
    ? `<a href="${esc(safeHttpUrl(p.linkedin))}" style="color:${p.accent};text-decoration:none">LinkedIn</a>`
    : 'LinkedIn');
  if (p.instagram) social.push(mode === 'email'
    ? `<a href="${esc(safeHttpUrl(p.instagram))}" style="color:${p.accent};text-decoration:none">Instagram</a>`
    : 'Instagram');
  const sep = ` <span style="color:#B9B0AA">|</span> `;
  const base = `font:400 12px/1.62 ${L.font};color:${p.bodyColor}`;
  return [
    bits.length ? `<div style="${base}">${bits.join(sep)}</div>` : '',
    line2.length ? `<div style="${base}">${line2.join(sep)}</div>` : '',
    social.length ? `<div style="font:600 11px/1.6 ${L.font};color:${p.accent}">${social.join(sep)}</div>` : ''
  ].join('');
}

function signatureHtml(p, mode = 'preview'){
  const i = S.signatures.people.indexOf(p);
  const L = sigLayout(p.preset);
  const logo = p.showLogo
    ? `<img src="${mode === 'email' ? emailLogoData(p.logoId) : logoData(p.logoId)}" width="${clamp(p.logoWidth, 60, 190)}" alt="Narretrieve" style="display:block;width:${clamp(p.logoWidth, 60, 190)}px;height:auto;border:0;outline:none">`
    : '';
  const nameStyle = `font:700 ${L.arch === 'masthead' ? 15 : 16}px/1.25 ${L.font};color:${p.nameColor};${L.upper ? 'text-transform:uppercase;letter-spacing:.04em;' : ''}`;
  const roleStyle = `font:700 10.5px/1.5 ${L.font};color:${p.accent};letter-spacing:.12em;text-transform:uppercase`;
  const descStyle = `font:400 12px/1.6 ${L.font};color:${p.bodyColor}`;
  const tagStyle  = `font:700 10px/1.5 ${L.font};color:${p.accent};letter-spacing:.16em;text-transform:uppercase`;
  const rule = L.rule && p.showDivider ? `<div style="height:2px;background:${p.accent};width:64px;margin:9px 0"></div>` : '';
  const hair = `<div style="height:1px;background:#DDD6D1;margin:9px 0"></div>`;

  const nameBlock = `
    <div style="${nameStyle}">${sigVal(p, 'name', i, mode)}</div>
    ${p.title ? `<div style="${roleStyle}">${sigVal(p, 'title', i, mode)}</div>` : ''}
    ${p.descriptor ? `<div style="${descStyle};margin-top:5px">${sigVal(p, 'descriptor', i, mode)}</div>` : ''}`;
  const contact = sigLinks(p, i, mode, L);
  const tagline = p.showTagline && p.tagline ? `<div style="${tagStyle};margin-top:7px">${sigVal(p, 'tagline', i, mode)}</div>` : '';
  const wrap = inner => `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;font-family:${L.font}"><tr><td style="padding:0">${inner}</td></tr></table>`;

  switch (L.arch){
    case 'stack':
      return wrap(`${logo ? `<div style="margin-bottom:10px">${logo}</div>` : ''}${nameBlock}${rule}${contact}${tagline}`);
    case 'masthead':
      return wrap(`
        <div style="font:700 17px/1.2 ${L.font};color:${p.nameColor};letter-spacing:.24em;text-transform:uppercase">${sigVal(p, 'company', i, mode)}</div>
        <div style="height:2px;background:${p.accent};margin:8px 0 10px"></div>
        ${nameBlock}${contact}${tagline}`);
    case 'split':
      return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;font-family:${L.font}">
        <tr>
          <td style="padding:0 18px 0 0;vertical-align:top;border-right:2px solid ${p.accent}">
            ${logo ? `<div style="margin-bottom:9px">${logo}</div>` : ''}${nameBlock}
          </td>
          <td style="padding:0 0 0 18px;vertical-align:top">${contact}${tagline}</td>
        </tr></table>`;
    case 'centered':
      return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;font-family:${L.font};text-align:center">
        <tr><td style="padding:0;text-align:center">
          ${logo ? `<div style="margin:0 auto 10px;display:inline-block">${logo}</div>` : ''}
          ${nameBlock}
          ${L.rule && p.showDivider ? `<div style="height:2px;background:${p.accent};width:56px;margin:9px auto"></div>` : ''}
          ${contact}${tagline}
        </td></tr></table>`;
    case 'text':
      return wrap(`${nameBlock}${hair}${contact}${tagline}`);
    case 'bar':
      return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;font-family:${L.font}">
        <tr>
          <td style="width:4px;background:${p.accent}">&nbsp;</td>
          <td style="padding:0 0 0 14px;vertical-align:top">
            ${logo ? `<div style="margin-bottom:8px">${logo}</div>` : ''}${nameBlock}${contact}${tagline}
          </td>
        </tr></table>`;
    case 'compact':
      return wrap(`
        <div style="${nameStyle}">${sigVal(p, 'name', i, mode)}${p.title ? ` <span style="font-weight:400;color:${p.accent}">· ${sigVal(p, 'title', i, mode)}</span>` : ''}</div>
        ${contact}`);
    case 'byline':
      return wrap(`
        ${nameBlock}
        <div style="height:1px;background:${p.accent};margin:8px 0"></div>
        <table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
          ${logo ? `<td style="padding:0 14px 0 0;vertical-align:middle">${logo}</td>` : ''}
          <td style="vertical-align:middle">${contact}${tagline}</td>
        </tr></table>`);
    case 'rule':
      return wrap(`${nameBlock}${rule}${contact}${tagline}${logo ? `<div style="margin-top:11px">${logo}</div>` : ''}`);
    default: /* lockup */
      return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;font-family:${L.font}">
        <tr>
          ${logo ? `<td style="padding:0 16px 0 0;vertical-align:top">${logo}</td>` : ''}
          <td style="padding:0 0 0 ${logo ? 16 : 0}px;vertical-align:top;${logo && p.showDivider ? `border-left:1px solid #DDD6D1` : ''}">
            ${nameBlock}${L.tight ? '' : rule}${contact}${tagline}
          </td>
        </tr></table>`;
  }
}

function sigEmailHtml(p){
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:${p.bodyColor}">${signatureHtml(p, 'email')}</div>`;
}

module('signatures', {
  render(){
    const p = sigActive();
    const i = sigIndex();
    const chars = sigEmailHtml(p).length;
    return `
      ${pageHead({
        kicker:'Identity',
        title:'Email Signature Studio',
        blurb:'Gmail-safe signature layouts built only from your own content. Every field is editable on the form or directly on the preview.',
        actions:
          btn('Add person', { act:'sigAdd' }) +
          btn('Duplicate', { act:'sigDup' }) +
          btn('Delete', { act:'sigDel', cls:'btn danger' })
      })}
      <div class="workspace">
        <div class="panel sticky">
          <div class="panelHead"><b>Team</b><span class="spacer"></span><span class="tag">${S.signatures.people.length}</span></div>
          <div class="railList scroll" style="max-height:calc(100vh - 230px)">
            ${S.signatures.people.map(x => `
              <button class="railItem${x.id === p.id ? ' on' : ''}" data-act="sigPick" data-id="${esc(x.id)}">
                <b>${esc(x.name || 'Untitled profile')}</b><small>${esc(x.title || '—')}</small>
              </button>`).join('')}
          </div>
        </div>

        <div>
          <div class="stageWrap">
            <div class="stageBar noPrint">
              <span class="title">${esc(p.name || 'Signature')}</span>
              <span class="spacer"></span>
              <span class="tag${chars > 10000 ? ' warn' : ' ok'}">${chars.toLocaleString()} / 10,000 chars</span>
              ${btn('Copy for Gmail', { act:'sigCopyRich', cls:'btn primary sm' })}
              ${btn('Copy HTML', { act:'sigCopyHtml', cls:'btn sm' })}
              ${btn('Download .html', { act:'sigDownload', cls:'btn sm' })}
            </div>
            <div class="stage scroll" style="background:#DAD5D1">
              <div class="stageInner" id="sigStage" style="width:100%">
                <div class="sigPaper" id="sigPaper">${signatureHtml(p, 'preview')}</div>
              </div>
            </div>
          </div>
          <details class="panel" style="margin-top:12px">
            <summary style="padding:11px 13px;cursor:pointer;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-2)">HTML source</summary>
            <div class="panelBody"><textarea rows="8" readonly style="font:11px/1.6 var(--mono)">${esc(sigEmailHtml(p))}</textarea></div>
          </details>
        </div>

        <div class="panel sticky scrollPane scroll">
          <div class="panelHead"><b>Edit signature</b></div>
          ${acc('Design preset', presetPicker(`signatures.people.${i}.preset`, SIG_PRESETS, { after:'render' }), true)}
          ${acc('Person', `<div class="stack">
            ${field('Full name', input(`signatures.people.${i}.name`, { ph:'Full name', after:'render' }))}
            ${field('Job title', input(`signatures.people.${i}.title`, { ph:'Role' }))}
            ${field('Company', input(`signatures.people.${i}.company`, { ph: COMPANY.name }))}
            ${field('One-line descriptor', textarea(`signatures.people.${i}.descriptor`, { rows:2 }))}
            ${field('Tagline', input(`signatures.people.${i}.tagline`, { ph: COMPANY.tagline }))}
          </div>`, true)}
          ${acc('Contact', `<div class="stack">
            ${field('Email', input(`signatures.people.${i}.email`, { type:'email', ph:'name@narretrieve.com' }))}
            ${field('Phone', input(`signatures.people.${i}.phone`, { type:'tel', ph:'+254 …' }))}
            ${field('Website', input(`signatures.people.${i}.website`, { ph:'https://narretrieve.com' }))}
            ${field('Location', input(`signatures.people.${i}.location`, { ph:'Nairobi, Kenya' }))}
            ${field('LinkedIn URL', input(`signatures.people.${i}.linkedin`, { type:'url', ph:'https://www.linkedin.com/in/…' }))}
            ${field('Instagram URL', input(`signatures.people.${i}.instagram`, { type:'url', ph:'https://instagram.com/…' }))}
          </div>`)}
          ${acc('Logo & colour', `<div class="stack">
            ${field('Logo', `<select data-model="signatures.people.${i}.logoId">${logoOptions(p.logoId)}</select>`)}
            ${field('Logo width (px)', input(`signatures.people.${i}.logoWidth`, { type:'number' }), 'Between 60 and 190 px. Gmail scales images down, not up.')}
            <div class="grid3">
              ${field('Accent', `<input type="color" data-model="signatures.people.${i}.accent" value="${esc(p.accent)}">`)}
              ${field('Name', `<input type="color" data-model="signatures.people.${i}.nameColor" value="${esc(p.nameColor)}">`)}
              ${field('Body', `<input type="color" data-model="signatures.people.${i}.bodyColor" value="${esc(p.bodyColor)}">`)}
            </div>
            ${checkbox(`signatures.people.${i}.showLogo`, 'Show logo')}
            ${checkbox(`signatures.people.${i}.showTagline`, 'Show tagline')}
            ${checkbox(`signatures.people.${i}.showDivider`, 'Show divider rule')}
          </div>`)}
          ${acc('Gmail notes', `<div class="note neutral">Use <b>Copy for Gmail</b>, then paste into Gmail → Settings → Signature. The logo is embedded as a compact PNG so it survives the paste. Gmail truncates signatures over 10,000 characters.</div>`)}
        </div>
      </div>`;
  },
  preview(){
    const host = $('#sigPaper');
    if (!host) return;
    host.innerHTML = signatureHtml(sigActive(), 'preview');
    bindPane(host);
  },
  soft(){
    const p = sigActive();
    const row = $(`[data-act="sigPick"][data-id="${CSS.escape(p.id)}"] b`);
    if (row) row.textContent = p.name || 'Untitled profile';
  },
  mounted(host){ bindPane($('#sigPaper')); fitStages(host); }
});

action('sigPick', d => { S.signatures.activeId = d.id; save(); renderView('signatures'); });
action('sigAdd', () => {
  const p = makeSignature({ name:'New person', title:'ROLE', email:'', preset:'classic-lockup-v11' });
  S.signatures.people.push(p);
  S.signatures.activeId = p.id;
  save(); renderView('signatures');
});
action('sigDup', () => {
  const src = sigActive();
  const p = Object.assign(JSON.parse(JSON.stringify(src)), { id: uid('sig'), name: src.name + ' (copy)' });
  S.signatures.people.push(p);
  S.signatures.activeId = p.id;
  save(); renderView('signatures');
});
action('sigDel', () => {
  if (S.signatures.people.length <= 1) return toast('Keep at least one signature profile.', 'bad');
  confirmDialog('Delete this signature profile?', () => {
    S.signatures.people = S.signatures.people.filter(x => x.id !== S.signatures.activeId);
    S.signatures.activeId = S.signatures.people[0].id;
    save(); renderView('signatures');
  }, { yes:'Delete', danger:true });
});
action('sigCopyHtml', async () => {
  try { await navigator.clipboard.writeText(sigEmailHtml(sigActive())); toast('HTML copied', 'good'); }
  catch { toast('Clipboard blocked — use the HTML source box below.', 'bad'); }
});
action('sigCopyRich', async () => {
  const html = sigEmailHtml(sigActive());
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type:'text/html' }),
      'text/plain': new Blob([$('#sigPaper').innerText], { type:'text/plain' })
    })]);
    toast('Copied — paste into Gmail signature settings', 'good');
  } catch {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents($('#sigPaper'));
    sel.removeAllRanges(); sel.addRange(range);
    const ok = document.execCommand('copy');
    sel.removeAllRanges();
    toast(ok ? 'Copied — paste into Gmail' : 'Clipboard blocked — copy the HTML source instead.', ok ? 'good' : 'bad');
  }
});
action('sigDownload', () => {
  const p = sigActive();
  dlText(cleanFilename('Narretrieve_signature_' + (p.name || 'profile')) + '.html', 'text/html',
    `<!doctype html><meta charset="utf-8"><title>${esc(p.name)} — Narretrieve signature</title>${sigEmailHtml(p)}`);
});
