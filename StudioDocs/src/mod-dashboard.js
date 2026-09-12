/* ==========================================================================
   Dashboard
   ========================================================================== */
module('dashboard', {
  render(){
    const eq = S.equipment || [];
    const assigned = eq.filter(e => String(e.status || '').toLowerCase() === 'assigned').length;
    const service = eq.filter(e => e.nextService && e.nextService <= addDays(today(), 30)).length;
    const invoices = S.invoices.docs;
    const outstanding = invoices
      .filter(d => d.type !== 'quote')
      .reduce((sum, d) => sum + invoiceTotals(d).total, 0);
    const signed = S.consent.releases.filter(r => r.participantSig).length;

    const metrics = [
      [S.signatures.people.length, 'signature profiles', 'signatures'],
      [S.cards.people.length, 'business card profiles', 'cards'],
      [S.suppliers.records.length, 'supplier records', 'suppliers'],
      [eq.length, 'equipment assets', 'equipment'],
      [invoices.length, 'InvoYou documents', 'invoices'],
      [S.consent.releases.length, 'consent records', 'consent'],
      [S.production.docs.length, 'production documents', 'production'],
      [allLogos().length, 'logo variants', 'brand']
    ];

    const quick = [
      ['consent', 'New consent release', 'Start an informed-consent or release form with granular permissions and drawn signatures.'],
      ['invoices', 'New invoice or quotation', 'Raise an invoice, proforma or quotation on Narretrieve letterhead and export a PDF.'],
      ['agreements', 'New supplier agreement', 'Draft a photography or videography contract with editable clauses and signature fields.'],
      ['production', 'New production document', 'Statements of work, call sheets, risk assessments, NDAs and grant reports.'],
      ['packet', 'Build a supplier packet', 'Bundle the current agreement, consent, specification and invoice into one ZIP with a SHA-256 manifest.'],
      ['equipment', 'Equipment register', 'Track cameras, lenses, sound, lighting, assignment status and service dates.']
    ];

    return `
      ${pageHead({
        kicker: COMPANY.name,
        title: 'Studio document workspace',
        blurb: 'Identity, contracts, production documents, supplier records, informed-consent records, capture specifications, invoices and quotations — all in one local-first workspace.',
        actions: btn('Back up workspace', { act:'exportVault', cls:'btn' }) + btn('New consent release', { act:'dashNewConsent', cls:'btn primary' })
      })}

      <div class="metricGrid" style="margin-bottom:18px">
        ${metrics.map(([n, label, view]) => `
          <button class="metric" data-act="goto" data-view="${view}">
            <b>${esc(String(n))}</b><span>${esc(label)}</span>
          </button>`).join('')}
      </div>

      <div class="grid2" style="margin-bottom:18px;align-items:start">
        <div class="panel">
          <div class="panelHead"><b>Studio status</b></div>
          <div class="panelBody stack">
            <div class="inline" style="justify-content:space-between"><span>Equipment currently assigned</span><span class="tag${assigned ? ' coral' : ''}">${assigned} of ${eq.length}</span></div>
            <div class="inline" style="justify-content:space-between"><span>Service due within 30 days</span><span class="tag${service ? ' warn' : ' ok'}">${service}</span></div>
            <div class="inline" style="justify-content:space-between"><span>Consent records with a signature</span><span class="tag${signed ? ' ok' : ''}">${signed} of ${S.consent.releases.length}</span></div>
            <div class="inline" style="justify-content:space-between"><span>Invoiced and proforma value</span><span class="tag">${esc(money(outstanding, invoices[0] ? invoices[0].currency : 'USD'))}</span></div>
          </div>
        </div>
        <div class="panel">
          <div class="panelHead"><b>How your data is held</b></div>
          <div class="panelBody stack">
            <p style="font-size:12px;line-height:1.65;color:var(--text-2)">StudioDocs runs entirely in this browser. Records are saved to local storage on this device, the page makes no network requests, and nothing is sent to Narretrieve or any third party. Use <b>Back up workspace</b> before clearing site data or moving to another machine.</p>
            <div class="inline">
              ${btn('Export backup', { act:'exportVault', cls:'btn sm' })}
              ${btn('Import backup', { act:'importVault', cls:'btn sm' })}
              ${btn('Data & security', { act:'goto', cls:'btn sm ghost', data:{ view:'security' } })}
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panelHead"><b>Start something</b></div>
        <div class="panelBody">
          <div class="actionGrid">
            ${quick.map(([view, title, blurb]) => `
              <button class="actionCard" data-act="goto" data-view="${view}">
                <b>${esc(title)}</b><p>${esc(blurb)}</p><span class="go">Open →</span>
              </button>`).join('')}
          </div>
        </div>
      </div>`;
  }
});

action('goto', d => go(d.view));
action('dashNewConsent', () => { newRelease(); go('consent'); });
