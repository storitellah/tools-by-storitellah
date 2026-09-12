/* ==========================================================================
   Data & security
   ========================================================================== */
module('security', {
  render(){
    let bytes = 0;
    try { bytes = new Blob([localStorage.getItem(STORE_KEY) || '']).size; } catch {}
    return `
      ${pageHead({
        kicker:'Local data',
        title:'Data & Security',
        blurb:'StudioDocs opens directly with no password gate. Everything you type stays on this device unless you export it.',
        actions: btn('Back up workspace', { act:'exportVault', cls:'btn primary' }) + btn('Import backup', { act:'importVault' })
      })}
      <div class="grid3" style="margin-bottom:14px;align-items:start">
        ${[
          ['No password gate','StudioDocs opens directly. There is no password, unlock screen or automatic lock — the security boundary is your device and browser profile.'],
          ['Local-first storage','Workspace records live in this browser’s local storage. Nothing is sent to Narretrieve, to a cloud database, or to any analytics or tracking service.'],
          ['No outbound requests','The page loads no external scripts, stylesheets, fonts or images. A strict Content Security Policy blocks network access outright.'],
          ['Sanitised rendering','Every value you type is HTML-escaped before it reaches the page, and imported files are treated as inert data, never executed.'],
          ['Integrity manifests','Supplier packets include a SHA-256 hash for every file so a recipient can verify that nothing changed in transit.'],
          ['Your responsibility','No local application can protect a compromised device or operating system. Keep backups, and store exported consent records securely.']
        ].map(([h, p]) => `<div class="panel"><div class="panelBody">
            <h3 style="font-size:13px;color:var(--navy);margin-bottom:5px">${esc(h)}</h3>
            <p style="font-size:11.5px;line-height:1.65;color:var(--text-2)">${esc(p)}</p>
          </div></div>`).join('')}
      </div>

      <div class="grid3" style="align-items:start">
        <div class="panel">
          <div class="panelHead"><b>Workspace</b></div>
          <div class="panelBody stack">
            <div class="inline" style="justify-content:space-between"><span>Autosave</span><span class="tag ok">Always on</span></div>
            <div class="inline" style="justify-content:space-between"><span>Stored size</span><span class="tag">${(bytes / 1024).toFixed(0)} KB</span></div>
            <div class="inline" style="justify-content:space-between"><span>Storage key</span><span class="tag" style="font-family:var(--mono);font-size:9px">${esc(STORE_KEY)}</span></div>
            ${btn('Back up entire workspace', { act:'exportVault', cls:'btn block' })}
            ${btn('Import a backup file', { act:'importVault', cls:'btn block' })}
            ${btn('Reset workspace', { act:'resetVault', cls:'btn block danger' })}
          </div>
        </div>
        <div class="panel">
          <div class="panelHead"><b>Self-test</b></div>
          <div class="panelBody stack">
            <p style="font-size:11.5px;color:var(--text-2);line-height:1.6">Runs the internal checks for escaping, PDF and ZIP construction, QR encoding, CSV round-trips, pagination and state migration.</p>
            ${btn('Run self-test', { act:'runTests', cls:'btn block dark' })}
            <div class="logBox" id="testLog">Not run yet.</div>
          </div>
        </div>
        <div class="panel">
          <div class="panelHead"><b>Print</b></div>
          <div class="panelBody stack">
            <p style="font-size:11.5px;color:var(--text-2);line-height:1.6">Any document view can be printed straight from the browser. Only the document pages are printed — the sidebar, editors and toolbars are hidden.</p>
            ${btn('Print the current view', { act:'printView', cls:'btn block' })}
          </div>
        </div>
      </div>`;
  }
});

action('exportVault', () => {
  dlText('Narretrieve_StudioDocs_backup_' + today() + '.json', 'application/json',
    JSON.stringify({ app:'StudioDocs', version: APP_VERSION, exported: new Date().toISOString(), state: S }, null, 2));
  toast('Backup downloaded', 'good');
});
action('importVault', () => pickFile('application/json,.json', text => {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return toast('That file is not valid JSON.', 'bad'); }
  const incoming = parsed && parsed.state ? parsed.state : parsed;
  if (!incoming || typeof incoming !== 'object') return toast('That backup did not contain a workspace.', 'bad');
  confirmDialog('Replace the current workspace with this backup? Anything not exported will be lost.', () => {
    S = migrate(incoming);
    save();
    $('#brandMark').src = logoData(S.brand.defaultLogoId);
    renderNav();
    go('dashboard');
    toast('Backup restored', 'good');
  }, { yes:'Restore backup', danger:true });
}));
action('resetVault', () => confirmDialog('Reset StudioDocs to a clean workspace? Every record on this device will be deleted.', () => {
  resetState();
  $('#brandMark').src = logoData(S.brand.defaultLogoId);
  renderNav();
  go('dashboard');
  toast('Workspace reset', 'good');
}, { yes:'Reset everything', danger:true }));
action('printView', () => window.print());

action('runTests', () => {
  const log = [];
  let failed = 0;
  const t = (name, fn) => {
    try {
      const ok = fn();
      log.push(`<span class="${ok ? 'ok' : 'bad'}">${ok ? 'PASS' : 'FAIL'}</span>  ${esc(name)}`);
      if (!ok) failed++;
    } catch (e){
      log.push(`<span class="bad">FAIL</span>  ${esc(name)} <span class="dim">— ${esc(e.message)}</span>`);
      failed++;
    }
  };

  t('HTML escaping', () => esc('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;');
  t('URL guard rejects javascript:', () => safeHttpUrl('javascript:alert(1)') === '');
  t('URL guard accepts https', () => safeHttpUrl('https://narretrieve.com') === 'https://narretrieve.com/');
  t('Email guard', () => safeMail('a@b.co') === 'a@b.co' && safeMail('nope') === '');
  t('Filename cleaner strips traversal', () => cleanFilename('../../etc/passwd') === 'etc_passwd');
  t('Path get/set', () => { const o = {}; setPath(o, 'a.b.0.c', 7); return getPath(o, 'a.b.0.c') === 7; });
  t('Money formatting', () => money(1234.5, 'USD') === '$1,234.50');
  t('Date arithmetic', () => addDays('2026-01-01', 31) === '2026-02-01');
  t('CSV round-trip', () => {
    const rows = [{ a:'x,y', b:'he said "hi"' }];
    const parsed = parseCsv(toCsv(rows, ['a','b']));
    return parsed[0].a === 'x,y' && parsed[0].b === 'he said "hi"';
  });
  t('CSV formula injection is neutralised', () => csvCell('=cmd()').startsWith('"\'='));
  t('QR encoder', () => NRTQR.encode('https://narretrieve.com', { ecLevel:'M' }).size >= 21);
  t('QR encodes a full vCard', () => NRTQR.encode(vcard(cardActive()), { ecLevel:'M' }).size >= 21);
  t('CRC32 known vector', () => crc32(new TextEncoder().encode('123456789')) === 0xCBF43926);
  t('ZIP container header', () => { const z = zipBuild([{ name:'a.txt', data:new TextEncoder().encode('hello') }]); return z[0] === 0x50 && z[1] === 0x4b; });
  t('PDF container header', () => {
    const px = document.createElement('canvas'); px.width = px.height = 4;
    const pdf = buildPdf([{ data: px.toDataURL('image/jpeg', 0.5), widthPt:595, heightPt:842, pxW:4, pxH:4 }]);
    return String.fromCharCode(...pdf.slice(0, 5)) === '%PDF-';
  });
  t('Invoice totals with tax and discount', () => {
    const d = { items:[{ qty:2, rate:100 }], discount:50, taxRate:10 };
    const r = invoiceTotals(d);
    return r.sub === 200 && Math.abs(r.total - 165) < 1e-9;
  });
  t('Every nav view has a module', () => NAV.flatMap(g => g.items).every(([id]) => typeof MODULES[id] === 'object'));
  t('Every module renders a string', () => Object.values(MODULES).every(m => typeof m.render() === 'string'));
  t('Every document preset resolves', () => {
    const all = [...AGREEMENT_PRESETS, ...INVOICE_PRESETS, ...CONSENT_DOC_PRESETS, ...PROD_PRESETS, ...SPEC_PRESETS];
    return all.every(([id]) => typeof presetStyle(id) === 'string' && /h-/.test(presetDef(id).head));
  });
  t('Every card preset resolves to an archetype', () =>
    CARD_PRESETS.every(([id]) => typeof cardArch(id) === 'string' && cardArch(id).length > 0));
  t('Every signature preset resolves to a layout', () =>
    SIG_PRESETS.every(([id]) => ['lockup','stack','masthead','split','centered','text','bar','compact','byline','rule'].includes(sigLayout(id).arch)));
  t('Pagination returns at least one page', () => paginate([{ html:'<div class="docBlock">x</div>' }], {
    pageClass:'page', style: presetStyle('editorial'), size:'A4', headHtml:'', footHtml:''
  }).includes('class="page"'));
  t('Migration fills a minimal workspace', () => {
    const m = migrate({ version:1 });
    return !!(m.signatures.people.length && m.equipment.length && m.invoices.docs.length && m.consent.releases.length);
  });
  t('Migration keeps existing records', () => {
    const m = migrate(JSON.parse(JSON.stringify(S)));
    return m.equipment.length === S.equipment.length && m.consent.releases.length === S.consent.releases.length;
  });
  t('Consent text defaults are complete', () => {
    const r = makeRelease('child');
    ensureConsentText(r);
    return Object.values(defaultConsentText(r)).every(v => typeof v === 'string' && v.length > 0);
  });
  t('Production templates all build', () => Object.keys(PROD_TEMPLATES).every(k => makeProductionDoc(k).sections.length > 0));
  t('Logos all carry PNG data', () => allLogos().every(l => String(l.data).startsWith('data:image/')));

  const el = $('#testLog');
  el.innerHTML = log.join('\n') + `\n\n<span class="${failed ? 'bad' : 'ok'}">${failed ? failed + ' test(s) failed' : 'All ' + log.length + ' tests passed'}</span>`;
  toast(failed ? failed + ' test(s) failed' : 'All tests passed', failed ? 'bad' : 'good');
});
