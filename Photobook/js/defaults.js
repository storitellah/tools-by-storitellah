// Starting values for a new book. Every value here is copied into the book
// (or the template library) when it is created and is editable from then on —
// the app never reads these again for an existing book.

export const DEFAULT_SPEC = {
  trimW: 100,          // mm, finished page width
  trimH: 100,          // mm, finished page height
  bleed: 3,            // mm added on every outside edge
  safe: 5,             // mm inside the trim kept clear of text
  spine: 6,            // mm, used for the cover wrap export
  spineColor: '@ink',
  spineText: '{title}',
  spineTextColor: '@paper',
  dpi: 600,            // export resolution
  minDpi: 300,         // photos below this effective resolution are flagged
  jpgQuality: 0.95,
  cropMarks: true,     // trim marks in the PDF
  markLength: 5,       // mm
  markOffset: 3,       // mm gap between the bleed edge and a trim mark
  spreadAspect: 1.7,   // photos at least this wide are laid out as double spreads
  pageMultiple: 2,     // interior page count must be a multiple of this
  minPages: 0,         // pad the interior to at least this many pages
  colophon: true,      // auto-layout adds a colophon page at the end
};

export const DEFAULT_META = {
  title: "This Is Where We're From",
  subtitle: 'A photobook',
  author: 'Brian Otieno',
  year: String(new Date().getFullYear()),
  colophon: 'Kibera Stories',
};

export const DEFAULT_THEME = {
  colors: [
    { key: 'paper', name: 'Paper', value: '#FFFFFF' },
    { key: 'ink', name: 'Ink', value: '#0F0F0F' },
    { key: 'accent', name: 'Amber', value: '#FBB03B' },
    { key: 'soft', name: 'Charcoal', value: '#333333' },
    { key: 'mist', name: 'Mist', value: '#F4F1EC' },
  ],
  fonts: {
    display: { family: 'Bobby Jones', fallback: 'Lilita One' },
    body: { family: 'TT Norms', fallback: 'Outfit' },
  },
};

// Palette shortcuts in Book & theme → Colours. Each sets the values of the
// colour keys it names.
export const THEME_PRESETS = [
  { name: "This Is Where We're From", colors: [{ key: 'paper', name: 'Paper', value: '#FFFFFF' }, { key: 'ink', name: 'Ink', value: '#0F0F0F' }, { key: 'accent', name: 'Amber', value: '#FBB03B' }, { key: 'soft', name: 'Charcoal', value: '#333333' }, { key: 'mist', name: 'Mist', value: '#F4F1EC' }] },
  { name: 'Warm paper', colors: [{ key: 'paper', name: 'Paper', value: '#F6F1E7' }, { key: 'ink', name: 'Ink', value: '#1E1A16' }, { key: 'accent', name: 'Accent', value: '#C8553D' }, { key: 'soft', name: 'Soft', value: '#5B524A' }, { key: 'mist', name: 'Mist', value: '#EAE2D3' }] },
  { name: 'Gallery black', colors: [{ key: 'paper', name: 'Paper', value: '#111111' }, { key: 'ink', name: 'Ink', value: '#F2F2F2' }, { key: 'accent', name: 'Accent', value: '#FBB03B' }, { key: 'soft', name: 'Soft', value: '#A8A8A8' }, { key: 'mist', name: 'Mist', value: '#1E1E1E' }] },
  { name: 'Mono', colors: [{ key: 'paper', name: 'Paper', value: '#FFFFFF' }, { key: 'ink', name: 'Ink', value: '#000000' }, { key: 'accent', name: 'Accent', value: '#000000' }, { key: 'soft', name: 'Soft', value: '#555555' }, { key: 'mist', name: 'Mist', value: '#EEEEEE' }] },
];

// Font files the default theme looks for next to index.html. Missing files
// are skipped quietly and the fallback face is used instead.
export const DEFAULT_FONT_FILES = [
  { family: 'Bobby Jones', weight: 400, style: 'normal', url: 'fonts/BobbyJonesSoft.otf' },
  { family: 'TT Norms', weight: 300, style: 'normal', url: 'fonts/TTNorms-Light.otf' },
  { family: 'TT Norms', weight: 400, style: 'normal', url: 'fonts/TTNorms-Regular.otf' },
  { family: 'TT Norms', weight: 400, style: 'italic', url: 'fonts/TTNorms-Italic.otf' },
  { family: 'TT Norms', weight: 700, style: 'normal', url: 'fonts/TTNorms-Bold.otf' },
  { family: 'TT Norms', weight: 900, style: 'normal', url: 'fonts/TTNorms-Black.otf' },
];

// Logos imported into a new book's brand kit. `roles` says which logo a
// template means by @primary, @back and so on.
export const DEFAULT_LOGOS = [
  { key: 'wordmark-charcoal', name: 'Wordmark · charcoal', url: 'assets/logos/Logo-01.png' },
  { key: 'wordmark-white', name: 'Wordmark · white', url: 'assets/logos/Logo-02.png' },
  { key: 'mark-charcoal', name: 'Mark · charcoal', url: 'assets/logos/Logo-03.png' },
  { key: 'mark-white', name: 'Mark · white', url: 'assets/logos/Logo-04.png' },
  { key: 'wordmark-black', name: 'Wordmark · black', url: 'assets/logos/Logo-05.png' },
  { key: 'wordmark-white-black', name: 'Wordmark · white, black IS', url: 'assets/logos/Logo-06.png' },
  { key: 'mark-black', name: 'Mark · black', url: 'assets/logos/Logo-07.png' },
  { key: 'mark-black-alt', name: 'Mark · black (alt)', url: 'assets/logos/Logo-08.png' },
];

export const DEFAULT_LOGO_ROLES = {
  primary: 'wordmark-black',
  primaryLight: 'wordmark-white',
  mark: 'mark-black',
  markLight: 'mark-white',
  back: 'mark-black',
};

export const LOGO_ROLE_NAMES = {
  primary: 'Primary logo',
  primaryLight: 'Primary logo on dark',
  mark: 'Mark',
  markLight: 'Mark on dark',
  back: 'Back cover logo',
};

export const DEMO_PHOTOS = [
  '01-lighthouse.jpg', '02-lagoon-panorama.jpg', '03-rapids.jpg', '04-face-paint.jpg', '05-red-hat.jpg',
  '06-red-barn.jpg', '07-macaws.jpg', '08-mountain-stream-panorama.jpg', '09-old-town.jpg', '10-shutters.jpg',
  '11-caps.jpg', '12-regatta.jpg', '13-garden-portrait.jpg', '14-stone-house.jpg', '15-starting-line.jpg',
  '16-propeller.jpg', '17-keeper.jpg', '18-painted-house.jpg', '19-shoreline.jpg', '20-red-door.jpg',
].map((f) => 'demo/' + f);

// Defaults for a newly added element of each type.
export const ELEMENT_DEFAULTS = {
  image: { asset: null, zoom: 1, cx: 0.5, cy: 0.5, fit: 'cover', radius: 0, strokeW: 0, stroke: '@ink' },
  text: { text: 'Text', placeholder: '', font: '@body', size: 9, weight: 400, italic: false, color: '@ink', align: 'left', valign: 'top', upper: false, tracking: 0, leading: 1.3 },
  shape: { shape: 'rect', fill: '@accent', strokeW: 0, stroke: '@ink', seed: 7 },
  logo: { logo: '@primary' },
};
