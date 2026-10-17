# Photobook

A browser tool for designing small square photobooks, 10 × 10 cm by default,
in the visual language of *This Is Where We're From*. Drop photos in and the
tool lays out a complete book: cover, title page, photo pages, double spreads,
colophon and a back cover with the project logo. You can change any part of it.
Preview the book as a flipbook and export print-ready PDF or high-resolution JPGs.

It's a static site: plain HTML, CSS and ES modules, with no build step, no
framework and no dependencies. Your photos stay in your browser.

## Install on a Mac

1. Download the disk image for your Mac:
   - **Photobook-1.0.0-AppleSilicon.dmg**: Macs with an M1, M2, M3 or M4 chip
   - **Photobook-1.0.0-Intel.dmg**: older Macs with an Intel processor

   To check which you have, open  → **About This Mac** and look at
   **Chip** or **Processor**.
2. Double-click the `.dmg`. A window opens with Photobook, an Applications
   folder and *How to install.txt*.
3. Drag **Photobook** onto **Applications**, then eject the disk image.
4. Open Photobook from Applications or Launchpad. The first time, macOS
   blocks it because the app isn't registered with Apple (it has an ad-hoc
   signature, not an Apple Developer ID):
   - Click **Done** on the message.
   - Open **System Settings → Privacy & Security**, scroll to *"Photobook was
     blocked…"* and click **Open Anyway**. Confirm with your password.
   - On macOS 14 Sonoma or earlier you can instead right-click the app,
     choose **Open**, then **Open**.

   If macOS says the app *"is damaged"*, run `xattr -cr /Applications/Photobook.app`
   in Terminal and open it again.

Your books are stored in `~/Library/Application Support/Photobook` and stay
there when you update or reinstall the app. The app needs macOS 11 Big Sur or
later and works offline.

To build the disk images yourself (on Linux or macOS), run
`python3 scripts/build_mac.py`. The script's docstring lists the tools it
uses. The Mac app is the same web app inside a small Electron shell
(`mac/main.js`).

## Run it in a browser

The modules and demo photos load over HTTP, so you need a local server:

```bash
cd Photobook
python3 -m http.server 8000
# open http://localhost:8000
```

The first launch builds a demo book from the photos in `demo/`. To start your
own book, open **☰ → New empty book** and drop photos onto the window.

Any static host works: Cloudflare Pages, Netlify or GitHub Pages, with
`Photobook/` as the site root.

**Single file:** `dist/photobook.html` is the whole tool in one file — code,
styles, logos and demo photos inlined. Double-click it to open it in Chrome,
Edge, Firefox or Safari, no server needed. Rebuild it after changing the source
with `python3 scripts/build_single.py` (needs Node for `npx esbuild`). Opened
from disk, it can't read the licensed font files from `fonts/`; add them inside
the tool under Book & theme → Fonts.

## What it does

**Drop photos, get a book.** Drop photos onto an empty book and it lays out the
whole book. If the book already has pages, new photos go onto new spreads
before the closing spread. Dropping a photo onto a frame puts it in that frame.

Auto-layout scores every template in the library against each photo's shape
and picks the closest fit. It prefers one or two photos per page, because the
pages are small. It also avoids repeating the previous layout.

**Double spreads** are detected and treated as one design:

- A photo at least as wide as the *double spread aspect* (1.7 by default) is
  laid across both pages. It always starts on a left page; if it would land on
  a right page, a page is pulled forward or a filler page is added.
- Any spread where a photo crosses the gutter is marked **DOUBLE SPREAD** in the
  editor, the filmstrip and the flipbook.
- When exporting single pages, a photo that crosses the gutter continues into
  the gutter-side bleed of both pages. Content that only touches the gutter
  doesn't spill into the facing page's bleed.
- Export can also produce lay-flat spreads (one file per spread).

**Templates** cover front covers (5), back covers (4, all with the project
logo), single pages (17, including title, quote, colophon and endpaper pages)
and double spreads (4). **Layout** opens a panel of visual previews:

- Every preview is the actual result for the page you're on. The tool copies
  the page, applies the template exactly as Apply would, and draws it with the
  same renderer used for print, so the preview shows your photos, fonts and
  colours. Empty frames show as *Drop a photo*.
- Hovering (or tabbing to) a preview shows that result full size on the page,
  marked PREVIEW. Moving away restores your page. Clicking applies it.
- On a spread, choose the left or right page; *Across the spread* layouts
  preview the whole spread.
- The template library (Book & theme → Templates) shows a thumbnail for every
  template. **Shuffle** cycles through layouts with
the same number of photos. **Save as template** turns any page you've designed
into a new template. The library is stored with your data: rename, retag,
duplicate, delete, export or import templates under **Book & theme →
Templates**, and restore the starter set at any time. Tags (`photo`, `title`,
`endpaper`, `colophon`, `filler`, `default`) control where auto-layout uses
each template.

**Everything is editable.**

- Drag elements to move them, use the handles to resize (Shift keeps the
  proportions) and the top handle to rotate. Elements snap to page edges,
  centres, the gutter, the safe margin and other elements; hold Alt to place
  freely.
- Double-click a photo to reposition it inside its frame: drag to move it,
  scroll to zoom.
- Double-click text to type on the page. The inspector sets font, size, weight,
  alignment, line height, tracking, capitals and colour.
- Add frames, text, shapes (including the hand-drawn circle from the logo) and
  logos.
- Arrow keys nudge (Shift for 5 mm). Ctrl/⌘+Z undoes, Ctrl/⌘+D duplicates and
  Delete removes.
- Text can include fields: `{title}`, `{subtitle}`, `{author}`, `{year}`,
  `{colophon}`, `{page}`, plus any field you add under **Book & theme → Book**.
  Change the title once and every page that shows it updates.
- **Book & theme** holds everything book-wide:
  - page size, bleed, safe margin and spine
  - export resolution and the warning threshold
  - JPEG quality and crop marks
  - the auto-layout rules
  - named colours (layouts refer to these, so changing one recolours the book)
  - display and body fonts and font files
  - logo files and which logo goes where (the back cover uses the *Back cover
    logo*)

**Preview.** **Preview** opens a flipbook built from the same renderer as the
print files. Turn pages by clicking, dragging, or with ←/→, Home and End.

**Export** checks the book first. It flags:

- photos below 300 effective dpi
- empty frames
- text outside the safe area or across the gutter
- missing fonts
- an interior page count that isn't a multiple of the printer's requirement

Then it renders every page from your original photo files, not previews:

- **PDF**: one page per book page (or per spread), trim plus 3 mm bleed on
  every edge, with `TrimBox`/`BleedBox` set and optional crop marks placed
  outside the bleed.
- **JPG**: a ZIP of JPEGs, each with its resolution written into the file. A
  README with the print spec is included.
- Resolutions are 300, 450, 600 (default), 900 or 1200 dpi. At 600 dpi a page
  is 2504 × 2504 px.
- Optional **cover wrap**: back cover, spine (width, colour and text are
  settings) and front cover as one piece.
- Export the whole book or just the current spread.

**Storage and backup.** Photos, fonts, logos, books and templates are stored in
the browser's IndexedDB on this device. Originals are kept untouched and the
editor works from previews. Nothing is uploaded. From the **☰** menu:

- **Download backup** saves a `.photobook` file. It's a ZIP containing the book,
  your templates and every original file.
- **Restore from backup** loads that file in any browser. You can also drop a
  `.photobook` file onto the window.
- **Back up to a folder** (Chrome and Edge) writes the book and its files into
  a folder you choose and keeps it updated a few seconds after every change. If
  the browser asks again after a restart, use **Reconnect backup folder**.
- **Storage on this device** shows usage and requests persistent storage so the
  browser doesn't evict it.

Several books can live side by side. Open, duplicate or delete them from
**☰ → Open another book**.

## Fonts

The default theme uses the project typefaces, **Bobby Jones Soft** (display)
and **TT Norms** (body). They are licensed files, so they are not committed
here. Until they're added, the tool uses **Lilita One** and **Outfit** (SIL Open
Font License, bundled in `fonts/fallback/` so it works offline). Export flags this as a note, not an error. You can add the
licensed fonts in either of two ways:

- **In the app:** Book & theme → Fonts → *Add font files*, then choose
  `BobbyJonesSoft.otf` and the `TTNorms-*.otf` files. They're stored with your
  data and included in backups. Files whose names match the theme's expected
  file names attach to the right family automatically.
- **On the server:** put the same files in `Photobook/fonts/` (see
  `fonts/README.md`). They're git-ignored. Check that your licence allows web
  use before deploying them publicly.

Text is drawn into the page images, so exported PDFs and JPGs never depend on
fonts being installed at the printer.

## Colour

Browsers render in sRGB, so the files are sRGB. Most photobook printers accept
sRGB and convert to CMYK themselves. If your printer needs CMYK or PDF/X,
convert the exported PDF in Acrobat or with your printer's tool.

## Layout of the code

```
index.html          shell
css/app.css         interface styles
js/main.js          boot, actions, keyboard, drag-and-drop of files
js/state.js         app state, undo/redo, autosave, books, template store
js/db.js            IndexedDB
js/assets.js        photo/logo/font import, previews, bitmap cache, font loading
js/defaults.js      starting values for a new book (spec, palette, logos, fonts)
js/templates.js     the starter template library (data)
js/layout.js        auto-layout, applying templates, saving pages as templates
js/render.js        the one renderer used by the editor, flipbook and exports
js/editor.js        the stage: selection, drag, resize, rotate, snap, crop, text
js/panels.js        photo tray, filmstrip, page bar, inspector, template picker
js/design.js        Book & theme dialog
js/flipbook.js      preview
js/export.js        preflight, JPG with DPI, PDF writer, export runs
js/exportui.js      export dialog
js/zip.js           ZIP writer/reader (backups, JPG export)
js/backup.js        .photobook backups and folder backup
js/books.js         books menu
scripts/build_single.py  builds dist/photobook.html
scripts/build_mac.py     builds the macOS .dmg files
mac/                     Electron shell for the Mac app, install guide
fonts/fallback/          Lilita One and Outfit (OFL)
dist/photobook.html      the single-file build
assets/logos/       This Is Where We're From logos (Logo-01 … Logo-08)
demo/               demo photos
fonts/              drop licensed font files here (git-ignored)
```

Book geometry is stored as fractions of the page or spread, and text sizes in
points. That lets a book survive a change of page size. Any element edge
placed at the page edge is extended to the bleed automatically.

## Demo photos

`demo/` holds 20 photos cropped from the Kodak Lossless True Color Image
Suite. Kodak released those images for unrestricted use. They're 500 px
crops, upscaled (Lanczos) to roughly 1800 px, or 3400 px for the two
panoramas, so the demo book prints at sensible resolution. They show how the
tool works; they're not examples of print quality. Replace them with your own
photographs.
