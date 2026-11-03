# Keepframe

**An instant-film print studio by [Storitellah](https://storitellah.com).**

Keepframe is one self-contained HTML file. It turns any photo into a mini, square or wide instant-film style print, then lays the prints out on a true-size sheet so you can print and cut them at home.

**Live page:** <https://claude.ai/artifact/KwiGmLpKLJKLvkAth6sSJP> (private until shared from its Share menu).

Or open `index.html` in any modern browser. There's nothing to install and no build step. Your photos never leave your device.

## Print sizes

| Format | Card | Photo window |
| --- | --- | --- |
| Mini | 54 × 86 mm | 46 × 62 mm |
| Square | 72 × 86 mm | 62 × 62 mm |
| Wide | 108 × 86 mm | 99 × 62 mm |

## Features

- **Any image format.** The browser decodes JPG, PNG, WebP, AVIF, GIF, BMP, SVG and ICO directly. HEIC/HEIF and TIFF use small decoders that load on demand ([heic2any](https://github.com/alexcorvi/heic2any), [UTIF.js](https://github.com/photopea/UTIF.js)). For RAW camera files (CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2, PEF…) and PSD, Keepframe uses the full-size JPEG preview stored inside the file. EXIF orientation is respected.
- **Framing.** Drag to reposition, scroll or pinch to zoom, rotate and mirror.
- **Frames.** 10 frame colours plus a custom colour picker, with optional rounded corners.
- **Film looks.** Instant, Sunny, Faded, Cool, Vivid, Mono and Sepia presets. You can fine-tune brightness, contrast, saturation, warmth, tint, fade, vignette, grain and glow.
- **Captions.** Handwritten, marker, script, typewriter or serif text on the bottom border, with ink colours and an optional retro orange date stamp.
- **Batch tools.** Add copies of any print, apply one style to every photo, and download every print as a 300 dpi PNG or JPG (zipped).
- **Tool name on every render.** Each print has a tiny "Keepframe · Storitellah" mark on its border, and each sheet has a "Made with Keepframe by Storitellah" credit line. Both are on by default and can be switched off.
- **Print sheet.** A4, Letter, A5, A3, Legal, 4×6 or 5×7, in portrait or landscape, with adjustable margin and gap. Prints rotate automatically when that fits more on a page. Choose corner crop marks, a dashed outline or no guides. Download a true-size PDF, print directly (standalone only), or download the sheets as 300 dpi PNGs to send to a photo lab.

## Printing tips

In the print dialog, set **Scale 100% / Actual size** and choose the same paper size as in Keepframe. Matte photo paper or 200–300 gsm card gives the most instant-print feel.

## Note on offline use

Everything works offline except the HEIC/TIFF decoders and the caption fonts, which load from public CDNs the first time they're needed. Offline, captions fall back to system fonts.

## Build chat

[`CHAT.md`](CHAT.md) is the conversation this tool was built in. A copy is embedded in `index.html`, so the **Download the build chat** link in the footer works even when the HTML file is used on its own. After editing `CHAT.md`, refresh the embedded copy with `python3 Scripts/embed_chat.py Keepframe`.

## Hosted page

The live page is built from `index.html` with `python3 Scripts/build_artifact.py Keepframe`. When it runs on claude.ai, it asks the viewer before saving each download, and the PDF button stands in for Print, which the viewer blocks.
