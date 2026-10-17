const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

export const ICONS = {
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>'),
  redo: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>'),
  layout: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/>'),
  shuffle: svg('<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
  text: svg('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
  shape: svg('<circle cx="12" cy="12" r="8"/>'),
  logo: svg('<path d="M6 4v16M10 4v16M4 11l16-4M14 14v6M18 4v16"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>'),
  up: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
  down: svg('<path d="M12 5v14M19 12l-7 7-7-7"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>'),
  unlock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 017.5-2"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  guides: svg('<path d="M3 8h18M3 16h18M8 3v18M16 3v18" stroke-dasharray="2 2"/>'),
  zoomIn: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>'),
  zoomOut: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6"/>'),
  crop: svg('<path d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14"/>'),
  save: svg('<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8M8 21v-7h8v7"/>'),
  folder: svg('<path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>'),
  book: svg('<path d="M4 4h7a3 3 0 013 3v13a2 2 0 00-2-2H4zM20 4h-7a3 3 0 00-3 3v13a2 2 0 012-2h8z"/>'),
};

export function icon(name) {
  const s = document.createElement('span');
  s.innerHTML = ICONS[name] || '';
  return s.firstChild;
}
