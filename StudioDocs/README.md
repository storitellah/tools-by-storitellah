# StudioDocs by Narretrieve

A local-first production document suite for [Narretrieve Productions LTD](https://narretrieve.com).
One self-contained HTML file — open `index.html` in any modern browser. No server, no build
step to run it, no network requests, no accounts.

## Modules

| Module | What it does |
| --- | --- |
| **Dashboard** | Workspace metrics, studio status and quick actions. |
| **Email Signatures** | 48 Gmail-safe signature layouts built only from your own content. Copy as rich text, copy HTML or download a `.html` file. |
| **Business Cards** | 40 card presets over 12 structural archetypes, front and back, vCard/URL QR code, PNG and two-sided PDF at true card size. |
| **Branded Letterhead** | Direct-edit letterhead. Paragraphs flow onto extra pages only when the letter needs them. |
| **Brand & Logos** | The eight supplied Narretrieve logo variants plus your own custom logos, colour system and usage guidance. |
| **Supplier Agreements** | Photography and videography contracts with editable clauses, 21 design presets and drawn signatures. |
| **Production Documents** | 11 client, contractor and field templates — MSA, SOW, PSEA, NDA, call sheet, risk assessment, ATA carnet and more. |
| **Consent Studio** | Informed-consent and release records with 14 release types, granular permissions, a privacy screen, a guided field mode, a consent register and CSV/JSON exports. |
| **Capture Specifications** | Photo, video and audio field briefs with equipment lists pulled from the register. |
| **InvoYou** | Invoices, proforma invoices and quotations — 20 presets, custom colours, tax and discount handling. |
| **Supplier Invoicing** | A printable one-page payment-details form to send to suppliers before they invoice. |
| **Supplier Records** | Freelancer and contractor directory with assignment history linked to Supplier Agreements. |
| **Equipment Register** | Cameras, lenses, sound, lighting and computers with assignment status, service dates and CSV import/export. |
| **Supplier Packet** | Bundles selected documents and uploads into one ZIP with a SHA-256 manifest. |
| **Data & Security** | Backup, restore, reset and a 27-check self-test. |

## Two ways to edit everything

Every word on every document is editable in two places, and the two stay in step:

- **Directly on the page.** Click any text on a preview — headings, clauses, labels, table cells,
  ruled form fields, footers — and type. The page is not rebuilt underneath you, so the caret
  never jumps.
- **In the side panel.** Grouped, collapsible form fields for the same values, plus the things a
  document can't express inline: presets, page size, text density, colours, logos, and repeatable
  lists (clauses, deliverables, line items, shot lists) with drag-to-reorder.

## Pagination

Documents are laid out by measuring each block against the real page box and packing only what
fits, with a verification pass that pushes a trailing block forward if it would overflow by even a
pixel. Pages are therefore added only when the content needs them. Setting **Text density** to
*Fit automatically* tries a tighter setting first and keeps it only if it saves a page.

## Exports

- **PNG** — one file per page at 3× scale.
- **PDF** — pages rasterised at 2.6× and wrapped in a hand-built PDF container (no libraries).
- **ZIP** — supplier packets, stored (uncompressed) entries plus a SHA-256 manifest.
- **CSV / JSON** — equipment, suppliers and the consent register; CSV cells starting with
  `= + - @` are neutralised against formula injection.
- **Print** — any document view prints straight from the browser; only the pages are printed.

## Privacy and security posture

- No password gate. The security boundary is the device and browser profile.
- Records live in `localStorage` under `studiodocs.narretrieve.v26`. Nothing is sent anywhere.
- A strict Content Security Policy (`default-src 'none'`, `connect-src 'none'`) blocks network
  access outright; there are no external scripts, stylesheets, fonts or images.
- All user values are HTML-escaped before rendering; imported files are treated as inert data.
- Consent records contain personal data — export them only where you can store them securely.

## Working on the source

`index.html` is generated. Edit the files in `src/` and rebuild:

```sh
node build.mjs
```

| File | Contents |
| --- | --- |
| `src/app.css` | Design system: tokens, shell, panels, forms, tables, modals, responsive and print rules. |
| `src/doc.css` | The paper model — page box, header archetypes, meta grids, ruled fields, tables, signatures, cards. |
| `src/qr.js` | Self-contained QR encoder. |
| `src/data.js` | Generated: brand logos, seed equipment, and every preset and template table. |
| `src/core.js` | State, persistence, two-way binding, routing, presets, pagination, rasterisation, PDF/ZIP/CSV, signature pad. |
| `src/state.js` | Default workspace and migrations. |
| `src/mod-*.js` | One file per module. |

Presets never hand-write a layout: a preset id resolves to a header archetype plus CSS custom
properties, so adding one cannot break the page. Card and signature presets resolve to a
structural archetype the same way. The self-test in **Data & Security** asserts that every preset
in every table resolves, and that every module renders.
