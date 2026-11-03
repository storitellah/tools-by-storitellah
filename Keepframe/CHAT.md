# Keepframe — build chat

A record of the conversation in which **Keepframe by [Storitellah](https://storitellah.com)** was designed and built with Claude Code (November 2026).
The user's messages are verbatim. Claude's replies are condensed, and behind-the-scenes tool output (file edits, test runs) is summarised.

---

## 1 · Request

> **User:** Design and develop and standalone html tool that I can use to transform and print photos into mini size / wide size and square instax style photo prints. This tool should be able to convert images of any format. Give it a unique name by Storitellah and hyperlink to storitellah.com

### What Claude did

- Looked over the `tools-by-storitellah` repo (it already had **Filmcase**, an iPhone film-camera app) and picked the name **Keepframe**.
- Wrote the whole tool as a single file, `Keepframe/index.html`:
  - **Sizes:** Mini 54 × 86 mm, Square 72 × 86 mm, Wide 108 × 86 mm (card + photo window).
  - **Decoding:** native browser formats, plus on-demand HEIC (heic2any) and TIFF (UTIF.js). RAW and PSD files fall back to their embedded full-size JPEG preview.
  - **Editing:** drag, zoom, pinch, rotate and mirror. Frame colours, film-look presets with fine-tune sliders, handwritten captions and a retro date stamp.
  - **Output:** copies, "apply style to all", 300 dpi PNG/JPG downloads, and a zip of all prints (built-in zip writer).
  - **Print sheet:** 7 paper sizes with auto-rotating packing, crop marks or outline guides, true-size print / save as PDF, and 300 dpi sheet PNGs.
- Tested it end to end in headless Chromium with JPG, PNG, TIFF and a fake NEF. All decoded; the zip, sheet PNG (2550 × 3300 for Letter) and PDF page size were correct, with no console errors. Fixed two layout bugs the screenshots exposed.
- Added `Keepframe/README.md` and a row in the root README. Committed, pushed and opened draft PR #6.

### Claude's reply (summary)

> Built **Keepframe by Storitellah** — a single HTML file you open in any browser, with nothing to install and no uploads… Things to know: HEIC/TIFF decoders and caption fonts load from public CDNs the first time they're needed; border sizes are close approximations of real film; print at 100% / "Actual size" for true dimensions.

---

## 2 · Follow-up

> **User:** Include the tool name in the HTML render and add a downloadable version of this chat as well. Do this for all future projects

### What Claude did

- **Tool name in the render:**
  - Every rendered print now carries a tiny "Keepframe · Storitellah" mark in the bottom-right corner of its border (on by default; toggle under *Frame*).
  - Every print sheet (screen preview, PNG export, and print/PDF) has a "Made with Keepframe by Storitellah · storitellah.com" credit line below the prints (toggle under *Cutting guides*).
- **Downloadable chat:**
  - Added this file (`Keepframe/CHAT.md`).
  - Embedded a copy inside `index.html`, so the **Download the build chat** link works even when the HTML file is used on its own.
- **For all future projects:** added a repo-level `CLAUDE.md` asking every future tool to show its name (by Storitellah, linked to storitellah.com) in what it renders, and to ship a downloadable `CHAT.md` of its build conversation.

---

## 3 · Publishing

> **User:** Publish Keepframe as a live web page I can share, include the tool name in the HTML render, and add a downloadable version of this tool in the chat. Do this for all future projects

### What Claude did

- **Live page:** published Keepframe as a claude.ai page at <https://claude.ai/artifact/KwiGmLpKLJKLvkAth6sSJP>. It starts private; share it from the page's **Share** menu.
- **Hosted mode.** The claude.ai viewer blocks plain downloads and the print dialog, so the tool now:
  - asks the viewer before each download (prints, zips, sheets and this chat);
  - adds a **Download true-size PDF** button, which works everywhere and replaces Print on the hosted page;
  - uses a two-tap "Clear all" in place of a confirm dialog.
- **Tool name:** "Keepframe by Storitellah" is the page title, the header, the footer, a mark on every print and a credit line on every sheet and PDF (the PDF metadata names it too).
- **Downloadable copy in the chat:** sent `Keepframe/index.html` as a file in the chat. It is the standalone version, which runs in any browser with no install.
- **For all future projects:** `CLAUDE.md` now says to publish every tool as a live page (`Scripts/build_artifact.py` turns `index.html` into the hosted page body) and to send the standalone file in the chat.
