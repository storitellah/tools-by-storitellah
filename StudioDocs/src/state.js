/* ==========================================================================
   Default workspace and migrations.
   ========================================================================== */

const COMPANY = {
  name:'Narretrieve Productions LTD',
  short:'Narretrieve',
  tagline:'STORIES FOR A BETTER WORLD',
  email:'hello@narretrieve.com',
  website:'narretrieve.com',
  phone:'+254 736 350 881',
  city:'Nairobi, Kenya',
  address:'Narretrieve Productions Ltd\nTree Lane, Langata District\nNairobi, Kenya\nP.O. Box 59127 – 00100'
};

const AGREEMENT_CLAUSES = [
  ['Scope of Services','The Supplier will provide the agreed professional services for the assignment, including preparation, field production and delivery of the approved outputs.'],
  ['Editorial and Technical Standards','The Supplier will work to the agreed brief, technical specifications, safeguarding requirements and professional standards. Material must be accurate, respectful and suitable for the intended use.'],
  ['Intellectual Property and Usage','Rights, licences and permitted uses will follow the project brief and written commissioning terms. The Supplier must not grant conflicting rights to third parties.'],
  ['Confidentiality and Data Protection','Confidential project information, personal data, consent records and unpublished material must be handled securely and shared only with authorised parties.'],
  ['Conduct and Safeguarding','The Supplier will follow Narretrieve safeguarding, consent and dignity standards and any client-specific field protocols.'],
  ['Cancellation and Changes','Material changes to schedule, scope or location should be agreed in writing. Any cancellation costs or non-refundable commitments should be documented and approved.']
];

function makeSignature(over = {}){
  return Object.assign({
    id: uid('sig'), name:'', title:'', email:'', phone:'', website:'https://narretrieve.com',
    location: COMPANY.city, linkedin:'', instagram:'', descriptor:'', tagline: COMPANY.tagline,
    company: COMPANY.name, logoId:'logo1', preset:'editorial-rule-v11',
    accent: BRAND.coral, nameColor: BRAND.navy, bodyColor: BRAND.ink,
    logoWidth: 118, showLogo: true, showTagline: true, showDivider: true
  }, over);
}
function makeCardPerson(over = {}){
  return Object.assign({
    id: uid('card'), name:'', title:'', email:'', phone:'', website: COMPANY.website,
    linkedin:'', location: COMPANY.city, bio:'', logoId:'logo1', qrTarget:'vcard',
    preset:'editorial-masthead', accent: BRAND.coral, paper: BRAND.paper, ink: BRAND.ink,
    copy:{}, backHeading:'CONTACT', backFooter: COMPANY.tagline, qrLabel:'SAVE CONTACT'
  }, over);
}
function makeInvoice(type = 'invoice'){
  const n = (S && S.invoices ? S.invoices.docs.length : 0) + 1;
  const prefix = type === 'quote' ? 'NRT-QTE' : type === 'proforma' ? 'NRT-PRO' : 'NRT-INV';
  return {
    id: uid('inv'), type,
    number: `${prefix}-${year()}-${String(n).padStart(3, '0')}`,
    preset:'coral-ledger', pageSize:'A4', density:'standard', logoId:'logo1',
    accent: BRAND.coral, secondary: BRAND.navy,
    date: today(), due: addDays(today(), 30), currency:'USD',
    company:{ name: COMPANY.name, address:'Nairobi, Kenya', email: COMPANY.email, website: COMPANY.website, tax:'', reg:'' },
    client:{ name:'', contact:'', address:'', email:'', po:'', so:'' },
    project:'', subject:'Visual storytelling services',
    items:[{ desc:'Visual storytelling services', qty:1, rate:0 }],
    taxLabel:'VAT', taxRate:0, discount:0,
    bank:'Bank: \nAccount name: \nAccount number: \nSWIFT / BIC: ',
    notes:'Thank you for working with Narretrieve.',
    terms:'Payment due within 30 days unless otherwise agreed in writing.'
  };
}
function makeProductionDoc(key = 'sow'){
  const t = PROD_TEMPLATES[key] || PROD_TEMPLATES.sow;
  const labels = PROD_ITEM_LABELS[key] || PROD_ITEM_LABELS.sow;
  return {
    id: uid('prod'), template: key, category: t.category, title: t.name,
    preset:'editorial', pageSize:'A4', density:'standard', logoId:'logo1',
    reference: `NRT-${key.toUpperCase()}-${year()}-${String(Math.floor(Math.random() * 900) + 100)}`,
    date: today(), lead: t.lead,
    firstParty: COMPANY.name, counterparty:'', clientOrg:'', project:'', location:'',
    sections: (t.sections || []).map(([title, body]) => ({ title, body })),
    itemLabels: labels.slice(),
    items: (PROD_TEMPLATE_ITEMS[key] || []).map(r => r.slice()),
    firstPartyRole:'Narretrieve representative', counterpartyRole:'Client representative',
    firstPartySig:'', counterpartySig:'', firstPartyName:'', counterpartyName:''
  };
}
function makeRelease(type = 'general'){
  const n = (S && S.consent ? S.consent.releases.length : 0) + 1;
  const t = CONSENT_TYPES[type] || CONSENT_TYPES.general;
  return {
    id: uid('rel'),
    consentId: `NR-CR-${year()}-${String(n).padStart(6, '0')}`,
    type, status:'Draft', title: t.title,
    preset:'editorial', pageSize:'A4', density:'standard', logoId:'logo1', language:'English',
    showConsentId: true,
    projectId:'', projectName:'Community Storytelling Documentation',
    clientName:'', assignment:'Participatory photography and interview documentation',
    location: 'Nairobi', date: today(),
    participant:{ name:'Sample Participant', age:'', contact:'', address:'Nairobi', guardian:'', guardianRelation:'' },
    mediaScope: Object.assign({}, CONSENT_MEDIA_DEFAULTS[type] || CONSENT_MEDIA_DEFAULTS.general),
    permissions: { firstName:true, fullName:true, location:true, website:true, social:true, print:true, reports:true, exhibitions:true, fundraising:false, advocacy:true, archive:true },
    futureContact:'no', bestContact:'',
    specialInstructions:'Use informed consent, protect dignity, and follow project-specific safeguarding instructions.',
    collector:{ name:'Narretrieve team', role:'Narretrieve representative' },
    participantSig:'', collectorSig:'', guardianSig:'',
    signedDateParticipant:'', signedDateCollector:'',
    text:null
  };
}
function makeSpec(){
  return {
    activeMode:'photo',
    reference:`NRT-SPEC-${year()}-001`,
    project:'', client:'', supplier:'', location:'',
    date: today(), logoId:'logo1', preset:'editorial-brief', pageSize:'A4', density:'standard',
    photo: JSON.parse(JSON.stringify(SPEC_DEFAULTS.photo)),
    video: JSON.parse(JSON.stringify(SPEC_DEFAULTS.video)),
    audio: JSON.parse(JSON.stringify(SPEC_DEFAULTS.audio))
  };
}
function makeLetterhead(){
  return {
    pageSize:'A4', density:'standard', preset:'editorial', logoId:'logo1', useWordmark: true,
    wordmark:'NARRETRIEVE', tagline: COMPANY.tagline,
    company: COMPANY.name,
    contact:`${COMPANY.name}\nTree Lane, Langata District\nNairobi, Kenya\nP.O. Box 59127 – 00100\n${COMPANY.website}`,
    date: today(), reference:`NRT/${year()}/001`,
    recipient:'Recipient Name', recipientOrg:'Organisation', recipientAddress:'Address, City / Country',
    subject:'Letter subject',
    paragraphs:[
      'Dear Recipient,',
      'Write your letter directly on the page. Every paragraph behaves like a normal document editor and keeps its natural size and spacing.',
      'Replace this text with project correspondence, assignment letters, formal notices, cover letters, client communication or supplier instructions. Add or remove paragraphs from the editor on the right, and the page count follows the content.',
      'Kind regards,'
    ],
    signOff:'Brian Otieno', signOffRole:'Storyteller · Narretrieve Productions LTD',
    signature:'', footer: COMPANY.website
  };
}
function makeSupplierGuide(){
  return {
    preset:'editorial', pageSize:'A4', density:'auto', logoId:'logo1',
    title:'Supplier Invoicing & Payment Details',
    reference:`NRT-SUPINV-${year()}-001`, date: today(),
    intro:'Please complete the relevant details below and submit this information with your invoice. This helps Narretrieve Productions Ltd verify the supplier, assignment and payment instructions before processing.',
    invoiceToLabel:'Invoice to', invoiceTo: COMPANY.address,
    supplierName:'', supplierDate:'', supplierAddress:'', supplierEmail:'', supplierPhone:'',
    invoiceNumber:'', poNumber:'',
    requirements:'Your invoice should show your name or business name, address, invoice date, invoice number, assignment or project reference, PO or SO number where supplied, a clear description of the services provided, currency, applicable taxes and the total amount due. Kenyan suppliers should issue invoices through eTIMS.',
    kenyaNote:'Choose the approved payment method and provide the matching details. Invoices should be issued via eTIMS.',
    mpesaName:'', mpesaNumber:'', bankAccountName:'', bankAccountNumber:'', kraPin:'',
    intlBeneficiary:'', intlBank:'', intlAccount:'', intlSwift:'', intlBankAddress:'', intlRouting:'',
    submission:'Submit the invoice using the invoicing email, contact or submission method stated in your assignment documentation. Before sending, check the supplier name, invoice number, date, PO / SO reference, bank or M-PESA details, currency and total amount.',
    note:'Keep a copy of the submitted invoice and supporting documents for your records.'
  };
}

function defaultState(){
  const sigs = [
    makeSignature({ name:'Brian Otieno', title:'STORYTELLER', email:'brian@narretrieve.com', phone:'+254 736 350 881',
      linkedin:'https://www.linkedin.com/in/storitellah/', descriptor:'Visual storytelling for organisations creating positive change.', preset:'editorial-rule-v11' }),
    makeSignature({ name:'Natalia Jidovanu', title:'HEAD OF DEVELOPMENT', email:'natalia@narretrieve.com', phone:'+254 701 074 167',
      linkedin:'https://www.linkedin.com/in/natalia-jidovanu-10723081/', descriptor:'Visual storytelling for organisations creating positive change.', preset:'classic-lockup-v11' }),
    makeSignature({ name: COMPANY.name, title: COMPANY.tagline, email: COMPANY.email,
      linkedin:'https://www.linkedin.com/company/narretrieve', descriptor:'Photography, film and multimedia storytelling.', tagline:'', preset:'newspaper-masthead-v11' })
  ];
  const cards = [
    makeCardPerson({ name:'Brian Otieno', title:'STORYTELLER', email:'brian@narretrieve.com', phone:'+254 736 350 881',
      linkedin:'https://www.linkedin.com/in/storitellah/', bio:'Visual storytelling for organisations creating positive change.' }),
    makeCardPerson({ name:'Natalia Jidovanu', title:'HEAD OF DEVELOPMENT', email:'natalia@narretrieve.com', phone:'+254 701 074 167',
      linkedin:'https://www.linkedin.com/in/natalia-jidovanu-10723081/', bio:'Stories for a better world.', preset:'minimal-grid' })
  ];
  return {
    version: 26,
    brand:{ defaultLogoId:'logo1', customLogos:[] },
    signatures:{ people: sigs, activeId: sigs[0].id },
    cards:{ people: cards, activeId: cards[0].id, format:'eu', orientation:'landscape', showBleed:false, showBack:true },
    letterhead: makeLetterhead(),
    agreement:{
      kind:'Photography', preset:'classic-contract', pageSize:'A4', density:'standard', logoId:'logo1',
      title:'Photography Services Agreement', reference:`NRT-AGR-${year()}-001`, date: today(),
      company:{ name: COMPANY.name, address:'Nairobi, Kenya', email: COMPANY.email, website: COMPANY.website, signatory:'', signatoryRole:'' },
      supplier:{ name:'', company:'', role:'Photographer', email:'', phone:'', address:'', city:'', country:'' },
      project:'', clientPartner:'', locations:'Nairobi, Kenya',
      startDate:'', endDate:'', fieldworkDays:'', deliveryDeadline:'',
      subject:'Photography services assignment',
      intro:'This agreement sets out the services, responsibilities, deliverables, fees and working terms for the assignment.',
      deliverables:[
        'Edited high-resolution photographs in the agreed format.',
        'Caption and metadata information for selected images.',
        'Delivery of original or source files only where explicitly agreed in writing.'
      ],
      clauses: AGREEMENT_CLAUSES.map(([title, body]) => ({ title, body })),
      feeAmount:'', currency:'USD', feeBasis:'Project fee', paymentDays:'30 days',
      taxNote:'Applicable taxes or withholding will be handled according to the commissioning terms and local law.',
      paymentText:'Payment is due after receipt and acceptance of the agreed deliverables and a valid invoice.',
      ackTitle:'Acceptance',
      ackText:'By signing below, both parties confirm that they understand and accept the terms of this agreement.',
      companySig:'', supplierSig:''
    },
    production:{ docs:[makeProductionDoc('sow')], activeId:'' },
    consent:{
      releases:[makeRelease('general')], activeId:'', panel:'forms', privacy:false,
      projects:[{ id: uid('proj'), name:'Community Storytelling Documentation', client:'', location:'Nairobi', lead:'Narretrieve team', notes:'' }]
    },
    specs: makeSpec(),
    invoices:{ docs:[], activeId:'' },
    supplierGuide: makeSupplierGuide(),
    suppliers:{ records:[], activeId:'', search:'' },
    equipment: JSON.parse(JSON.stringify(SEED_EQUIPMENT)),
    equipmentUi:{ activeId:'', search:'', category:'', status:'' },
    packet:{ supplier:'', project:'', note:'', checked:{}, files:[] },
    ui:{ }
  };
}

function migrate(s){
  const d = defaultState();
  if (!s || typeof s !== 'object') return d;

  /* Fill in anything a previous version did not have, without discarding data. */
  const merge = (target, src) => {
    Object.keys(src).forEach(k => {
      if (target[k] === undefined) target[k] = src[k];
      else if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && typeof target[k] === 'object' && !Array.isArray(target[k])) merge(target[k], src[k]);
    });
    return target;
  };
  merge(s, d);
  s.version = 26;

  if (!Array.isArray(s.signatures.people) || !s.signatures.people.length) s.signatures.people = d.signatures.people;
  s.signatures.people.forEach(p => merge(p, makeSignature()));
  if (!s.signatures.people.some(p => p.id === s.signatures.activeId)) s.signatures.activeId = s.signatures.people[0].id;

  if (!Array.isArray(s.cards.people) || !s.cards.people.length) s.cards.people = d.cards.people;
  s.cards.people.forEach(p => { merge(p, makeCardPerson()); if (!p.copy || typeof p.copy !== 'object') p.copy = {}; });
  if (!s.cards.people.some(p => p.id === s.cards.activeId)) s.cards.activeId = s.cards.people[0].id;

  if (!Array.isArray(s.production.docs) || !s.production.docs.length) s.production.docs = d.production.docs;
  s.production.docs.forEach(doc => {
    if (!Array.isArray(doc.sections)) doc.sections = [];
    if (!Array.isArray(doc.items)) doc.items = [];
    if (!Array.isArray(doc.itemLabels) || doc.itemLabels.length !== 4) doc.itemLabels = (PROD_ITEM_LABELS[doc.template] || PROD_ITEM_LABELS.sow).slice();
  });
  if (!s.production.docs.some(x => x.id === s.production.activeId)) s.production.activeId = s.production.docs[0].id;

  if (!Array.isArray(s.consent.releases) || !s.consent.releases.length) s.consent.releases = d.consent.releases;
  s.consent.releases.forEach(r => {
    merge(r, makeRelease(r.type || 'general'));
    if (!r.mediaScope || typeof r.mediaScope !== 'object') r.mediaScope = Object.assign({}, CONSENT_MEDIA_DEFAULTS.general);
  });
  if (!s.consent.releases.some(r => r.id === s.consent.activeId)) s.consent.activeId = s.consent.releases[0].id;
  if (!Array.isArray(s.consent.projects) || !s.consent.projects.length) s.consent.projects = d.consent.projects;

  ['photo','video','audio'].forEach(m => { s.specs[m] = merge(s.specs[m] || {}, SPEC_DEFAULTS[m]); });

  if (!Array.isArray(s.invoices.docs)) s.invoices.docs = [];
  if (!s.invoices.docs.length){ const inv = makeInvoice('invoice'); s.invoices.docs.push(inv); s.invoices.activeId = inv.id; }
  s.invoices.docs.forEach(doc => {
    merge(doc, makeInvoice(doc.type || 'invoice'));
    if (!Array.isArray(doc.items) || !doc.items.length) doc.items = [{ desc:'', qty:1, rate:0 }];
  });
  if (!s.invoices.docs.some(x => x.id === s.invoices.activeId)) s.invoices.activeId = s.invoices.docs[0].id;

  if (!Array.isArray(s.equipment)) s.equipment = JSON.parse(JSON.stringify(SEED_EQUIPMENT));
  s.equipment.forEach(e => EQ_KEYS.forEach(k => { if (e[k] === undefined) e[k] = ''; }));

  if (!Array.isArray(s.suppliers.records)) s.suppliers.records = [];
  if (!Array.isArray(s.letterhead.paragraphs) || !s.letterhead.paragraphs.length){
    s.letterhead.paragraphs = String(s.letterhead.body || d.letterhead.paragraphs.join('\n\n'))
      .split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  }
  delete s.letterhead.body;
  if (!Array.isArray(s.brand.customLogos)) s.brand.customLogos = [];
  if (!s.packet.checked || typeof s.packet.checked !== 'object') s.packet.checked = {};
  if (!Array.isArray(s.packet.files)) s.packet.files = [];
  return s;
}
