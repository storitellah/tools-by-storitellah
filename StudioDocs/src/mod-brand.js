/* ==========================================================================
   Brand & logo library
   ========================================================================== */
module('brand', {
  render(){
    const custom = S.brand.customLogos || [];
    const cardFor = (l, isCustom) => {
      const dark = /white|light/i.test(l.name);
      return `<div class="logoCard">
        <div class="shot${dark ? ' dark' : ''}"><img src="${l.data}" alt="${esc(l.name)}"></div>
        <b>${esc(l.name)}</b>
        <p>${isCustom ? 'Custom logo stored in this workspace' : 'Official Narretrieve supplied logo'}</p>
        <div class="inline">
          ${S.brand.defaultLogoId === l.id
            ? '<span class="tag coral">Default</span>'
            : btn('Set default', { act:'setDefaultLogo', cls:'btn xs', data:{ id:l.id } })}
          ${btn('Download PNG', { act:'downloadLogo', cls:'btn xs', data:{ id:l.id } })}
          ${LOGOS_EMAIL[l.id] ? btn('Email PNG', { act:'downloadLogo', cls:'btn xs', data:{ id:l.id, email:'1' } }) : ''}
          ${isCustom ? btn('Remove', { act:'removeLogo', cls:'btn xs danger', data:{ id:l.id } }) : ''}
        </div>
      </div>`;
    };

    return `
      ${pageHead({
        kicker:'Brand system',
        title:'Brand & logo library',
        blurb:'Every supplied Narretrieve logo variant, your own custom client logos, and the core brand guidelines StudioDocs applies across documents.',
        actions: btn('Add custom logo', { act:'addLogo', cls:'btn primary' })
      })}

      <div class="panel" style="margin-bottom:14px">
        <div class="panelHead"><b>Official logos</b></div>
        <div class="panelBody"><div class="logoGrid">${LOGOS.map(l => cardFor(l, false)).join('')}</div></div>
      </div>

      <div class="panel" style="margin-bottom:14px">
        <div class="panelHead"><b>Custom logos</b><span class="spacer"></span><span class="tag">${custom.length}</span></div>
        <div class="panelBody">
          ${custom.length
            ? `<div class="logoGrid">${custom.map(l => cardFor(l, true)).join('')}</div>`
            : '<div class="empty">No custom logos yet. Add a client or partner logo to use it on co-branded documents.</div>'}
        </div>
      </div>

      <div class="grid3" style="align-items:start">
        <div class="panel">
          <div class="panelHead"><b>Colour system</b></div>
          <div class="panelBody">
            <div class="grid2">
              ${[['Coral', BRAND.coral], ['Terracotta', BRAND.terracotta], ['Navy', BRAND.navy], ['Ink', BRAND.ink], ['Paper', BRAND.paper], ['White', BRAND.white]].map(([n, c]) => `
                <div>
                  <div style="height:46px;border-radius:7px;border:1px solid var(--line);background:${c}"></div>
                  <div style="font-size:11px;font-weight:650;margin-top:6px">${esc(n)}</div>
                  <div style="font-size:10.5px;color:var(--text-3);font-family:var(--mono)">${esc(c)}</div>
                </div>`).join('')}
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panelHead"><b>Typography</b></div>
          <div class="panelBody stack">
            <p style="font-size:12px;line-height:1.65;color:var(--text-2)">Interface and identity use a clean geometric sans — Inter or Poppins where installed, with Arial and Helvetica as dependable email and document fallbacks. Georgia and other serifs are used deliberately for editorial and newspaper-inspired document presets.</p>
            <div style="font:600 22px var(--sans)">Aa — Inter / Poppins</div>
            <div style="font:600 22px Georgia,serif">Aa — Georgia editorial</div>
          </div>
        </div>
        <div class="panel">
          <div class="panelHead"><b>Logo use</b></div>
          <div class="panelBody">
            <ul style="margin:0;padding-left:16px;font-size:12px;line-height:1.75;color:var(--text-2)">
              <li>Use coral or navy on light backgrounds.</li>
              <li>Use the light variants on dark surfaces.</li>
              <li>Keep clear space of at least the height of the mark.</li>
              <li>Do not stretch, skew, recolour or add effects.</li>
              <li>Prefer the full lockup on formal documents and the symbol for compact applications.</li>
            </ul>
          </div>
        </div>
      </div>`;
  }
});

action('setDefaultLogo', d => {
  S.brand.defaultLogoId = d.id;
  $('#brandMark').src = logoData(d.id);
  save();
  renderView('brand');
  toast('Default logo updated', 'good');
});
action('downloadLogo', d => {
  const l = logoById(d.id);
  const data = d.email ? emailLogoData(d.id) : l.data;
  dlBytes(cleanFilename('Narretrieve_' + l.name + (d.email ? '_email' : '')) + '.png', 'image/png', dataUrlBytes(data));
});
action('addLogo', () => {
  pickFile('image/png,image/jpeg,image/webp,image/svg+xml', (dataUrl, file) => {
    if (String(dataUrl).length > 2_500_000) return toast('That image is too large — use a file under ~1.8 MB.', 'bad');
    S.brand.customLogos.push({ id: uid('logo'), name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Custom logo', data: dataUrl });
    save();
    renderView('brand');
    toast('Logo added', 'good');
  }, 'dataurl');
});
action('removeLogo', d => {
  confirmDialog('Remove this custom logo? Documents using it will fall back to the default Narretrieve logo.', () => {
    S.brand.customLogos = S.brand.customLogos.filter(l => l.id !== d.id);
    if (S.brand.defaultLogoId === d.id) S.brand.defaultLogoId = 'logo1';
    save();
    renderView('brand');
  }, { yes:'Remove', danger:true });
});
