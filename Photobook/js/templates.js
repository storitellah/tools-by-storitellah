// The starter template library. On first run these are copied into the
// template store; after that they are ordinary, editable, deletable records.
//
// Geometry is in fractions of the template's area: a page for cover, back and
// page templates, the full two-page spread for spread templates. Any edge at 0
// or 1 is drawn out to the bleed automatically.
//
// tags drive auto-layout:
//   photo      usable for photographs (image slots are filled in order)
//   title      the first interior page
//   endpaper   inside front and inside back covers
//   colophon   closing page
//   filler     used to keep a double spread starting on a left page
//   default    preferred cover or back template

const img = (x, y, w, h, o = {}) => ({ type: 'image', x, y, w, h, ...o });
const txt = (x, y, w, h, text, o = {}) => ({ type: 'text', x, y, w, h, text, ...o });
const shape = (x, y, w, h, o = {}) => ({ type: 'shape', x, y, w, h, ...o });
const logo = (x, y, w, h, l = '@back') => ({ type: 'logo', x, y, w, h, logo: l });

const display = { font: '@display', weight: 400, upper: true, leading: 0.95 };
const body = { font: '@body', weight: 400 };
const caption = (x, y, w, h, o = {}) => txt(x, y, w, h, '', { ...body, size: 6.5, color: '@soft', placeholder: 'Add a caption', leading: 1.35, ...o });

export const BUILTIN_TEMPLATES = [
  // ---------- Covers ----------
  {
    id: 'cover-bleed', name: 'Full-bleed photo', scope: 'cover', tags: ['default'], bg: ['@ink'],
    elements: [
      img(0, 0, 1, 1),
      shape(0.7, 0.06, 0.24, 0.24, { shape: 'blob', fill: '@accent', seed: 11 }),
      txt(0.7, 0.06, 0.24, 0.24, '{year}', { ...display, size: 11, color: '@ink', align: 'center', valign: 'middle' }),
      txt(0.08, 0.62, 0.84, 0.3, '{title}', { ...display, size: 22, color: '@paper', valign: 'bottom' }),
    ],
  },
  {
    id: 'cover-framed', name: 'Framed photo', scope: 'cover', tags: [], bg: ['@paper'],
    elements: [
      img(0.1, 0.1, 0.8, 0.58),
      txt(0.1, 0.72, 0.8, 0.14, '{title}', { ...display, size: 17, color: '@ink' }),
      txt(0.1, 0.86, 0.8, 0.06, '{subtitle}', { ...body, size: 7, color: '@soft' }),
    ],
  },
  {
    id: 'cover-amber', name: 'Amber with photo', scope: 'cover', tags: [], bg: ['@accent'],
    elements: [
      img(0.12, 0.12, 0.76, 0.52),
      txt(0.12, 0.69, 0.76, 0.22, '{title}', { ...display, size: 18, color: '@ink' }),
    ],
  },
  {
    id: 'cover-logo', name: 'Logo only', scope: 'cover', tags: [], bg: ['@paper'],
    elements: [
      logo(0.15, 0.22, 0.7, 0.5, '@primary'),
      txt(0.1, 0.82, 0.8, 0.06, '{subtitle}', { ...body, size: 7, color: '@soft', align: 'center', upper: true, tracking: 120 }),
    ],
  },
  {
    id: 'cover-type', name: 'Big type, small photo', scope: 'cover', tags: [], bg: ['@ink'],
    elements: [
      txt(0.08, 0.08, 0.84, 0.5, '{title}', { ...display, size: 24, color: '@accent' }),
      img(0.5, 0.56, 0.42, 0.36),
      txt(0.08, 0.86, 0.38, 0.06, '{author}', { ...body, size: 6.5, color: '@paper', valign: 'bottom' }),
    ],
  },

  // ---------- Back covers (all carry the project logo) ----------
  {
    id: 'back-logo', name: 'Logo, centred', scope: 'back', tags: ['default'], bg: ['@paper'],
    elements: [
      logo(0.36, 0.28, 0.28, 0.28, '@back'),
      txt(0.15, 0.62, 0.7, 0.08, '{title}', { ...display, size: 9, color: '@ink', align: 'center' }),
      txt(0.15, 0.7, 0.7, 0.08, '{author} · {year}', { ...body, size: 6.5, color: '@soft', align: 'center' }),
      txt(0.1, 0.88, 0.8, 0.05, '{colophon}', { ...body, size: 5.5, color: '@soft', align: 'center', upper: true, tracking: 140 }),
    ],
  },
  {
    id: 'back-dark', name: 'Dark with logo', scope: 'back', tags: [], bg: ['@ink'],
    elements: [
      logo(0.2, 0.26, 0.6, 0.42, '@primaryLight'),
      txt(0.15, 0.76, 0.7, 0.08, '{subtitle}', { ...body, size: 7, color: '@paper', align: 'center' }),
      txt(0.1, 0.88, 0.8, 0.05, '{colophon}', { ...body, size: 5.5, color: '@accent', align: 'center', upper: true, tracking: 140 }),
    ],
  },
  {
    id: 'back-amber', name: 'Amber with mark', scope: 'back', tags: [], bg: ['@accent'],
    elements: [
      logo(0.38, 0.12, 0.24, 0.24, '@back'),
      txt(0.14, 0.44, 0.72, 0.34, '', { ...body, size: 7.5, color: '@ink', align: 'center', leading: 1.45, placeholder: 'A few lines about the book' }),
      txt(0.1, 0.88, 0.8, 0.05, '{title} · {year}', { ...body, size: 5.5, color: '@ink', align: 'center', upper: true, tracking: 140 }),
    ],
  },
  {
    id: 'back-photo', name: 'Photo strip and logo', scope: 'back', tags: [], bg: ['@paper'],
    elements: [
      img(0, 0, 1, 0.5),
      logo(0.4, 0.6, 0.2, 0.2, '@back'),
      txt(0.1, 0.86, 0.8, 0.05, '{title} · {author}', { ...body, size: 6, color: '@soft', align: 'center' }),
    ],
  },

  // ---------- Single pages ----------
  { id: 'page-bleed', name: 'Full bleed', scope: 'page', tags: ['photo'], bg: ['@paper'], elements: [img(0, 0, 1, 1)] },
  { id: 'page-margin', name: 'Centred with margin', scope: 'page', tags: ['photo'], bg: ['@paper'], elements: [img(0.1, 0.1, 0.8, 0.8)] },
  { id: 'page-small', name: 'Small, centred', scope: 'page', tags: ['photo'], bg: ['@paper'], elements: [img(0.28, 0.28, 0.44, 0.44)] },
  {
    id: 'page-caption', name: 'Photo with caption', scope: 'page', tags: ['photo'], bg: ['@paper'],
    elements: [img(0.08, 0.08, 0.84, 0.7), caption(0.08, 0.82, 0.84, 0.1)],
  },
  { id: 'page-portrait', name: 'Portrait', scope: 'page', tags: ['photo'], bg: ['@paper'], elements: [img(0.2, 0.08, 0.6, 0.84)] },
  { id: 'page-portrait-bleed', name: 'Portrait, bleed edge', scope: 'page', tags: ['photo'], bg: ['@paper'], elements: [img(0, 0, 0.68, 1), caption(0.72, 0.8, 0.24, 0.14)] },
  { id: 'page-landscape', name: 'Landscape', scope: 'page', tags: ['photo'], bg: ['@paper'], elements: [img(0.08, 0.22, 0.84, 0.56)] },
  {
    id: 'page-landscape-top', name: 'Landscape, top bleed', scope: 'page', tags: ['photo'], bg: ['@paper'],
    elements: [img(0, 0, 1, 0.66), caption(0.08, 0.72, 0.84, 0.18)],
  },
  {
    id: 'page-two-portrait', name: 'Two portraits', scope: 'page', tags: ['photo'], bg: ['@paper'],
    elements: [img(0.06, 0.18, 0.43, 0.64), img(0.51, 0.18, 0.43, 0.64)],
  },
  {
    id: 'page-two-landscape', name: 'Two landscapes', scope: 'page', tags: ['photo'], bg: ['@paper'],
    elements: [img(0.18, 0.06, 0.64, 0.43), img(0.18, 0.51, 0.64, 0.43)],
  },
  {
    id: 'page-three', name: 'One large, two small', scope: 'page', tags: ['photo'], bg: ['@paper'],
    elements: [img(0.06, 0.06, 0.5, 0.88), img(0.58, 0.06, 0.36, 0.43), img(0.58, 0.51, 0.36, 0.43)],
  },
  {
    id: 'page-grid', name: 'Grid of four', scope: 'page', tags: ['photo'], bg: ['@paper'],
    elements: [img(0.08, 0.08, 0.41, 0.41), img(0.51, 0.08, 0.41, 0.41), img(0.08, 0.51, 0.41, 0.41), img(0.51, 0.51, 0.41, 0.41)],
  },
  {
    id: 'page-title', name: 'Title page', scope: 'page', tags: ['title'], bg: ['@paper'],
    elements: [
      txt(0.12, 0.3, 0.76, 0.26, '{title}', { ...display, size: 15, color: '@ink', align: 'center', valign: 'bottom' }),
      txt(0.12, 0.58, 0.76, 0.08, '{subtitle}', { ...body, size: 7, color: '@soft', align: 'center' }),
      logo(0.44, 0.8, 0.12, 0.12, '@mark'),
    ],
  },
  {
    id: 'page-quote', name: 'Quote', scope: 'page', tags: ['filler'], bg: ['@paper'],
    elements: [
      txt(0.14, 0.2, 0.72, 0.6, '', { ...display, size: 12, color: '@ink', align: 'center', valign: 'middle', leading: 1.05, placeholder: 'A line from the story' }),
    ],
  },
  { id: 'page-amber', name: 'Solid amber', scope: 'page', tags: ['endpaper'], bg: ['@accent'], elements: [] },
  { id: 'page-blank', name: 'Blank', scope: 'page', tags: [], bg: ['@paper'], elements: [] },
  {
    id: 'page-colophon', name: 'Colophon', scope: 'page', tags: ['colophon'], bg: ['@paper'],
    elements: [
      logo(0.08, 0.08, 0.14, 0.14, '@mark'),
      txt(0.08, 0.62, 0.84, 0.3, '{title}\n{subtitle}\n\nPhotographs by {author}\n© {year} {colophon}', { ...body, size: 6, color: '@soft', valign: 'bottom', leading: 1.45 }),
    ],
  },

  // ---------- Double spreads ----------
  { id: 'spread-bleed', name: 'Across the spread', scope: 'spread', tags: ['photo'], bg: ['@paper', '@paper'], elements: [img(0, 0, 1, 1)] },
  { id: 'spread-band', name: 'Panorama band', scope: 'spread', tags: ['photo'], bg: ['@paper', '@paper'], elements: [img(0, 0.2, 1, 0.6)] },
  {
    id: 'spread-band-caption', name: 'Panorama with caption', scope: 'spread', tags: ['photo'], bg: ['@paper', '@paper'],
    elements: [img(0, 0.1, 1, 0.64), caption(0.54, 0.8, 0.4, 0.12)],
  },
  {
    id: 'spread-dark-band', name: 'Panorama on ink', scope: 'spread', tags: ['photo'], bg: ['@ink', '@ink'],
    elements: [img(0.04, 0.22, 0.92, 0.56)],
  },
];
