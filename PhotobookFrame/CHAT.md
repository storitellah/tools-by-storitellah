# Photobook Frame — build chat

A record of the conversation in which **Photobook Frame by [Storitellah](https://storitellah.com)** was reviewed, fixed and published with Claude Code (November 2026).
The user's messages are verbatim. Claude's replies are condensed, and behind-the-scenes tool output (file edits, test runs) is summarised.

---

## 1 · Request

> **User:** *(attached `photobook_frame_pro_1.html`)* Analyse this tool, create a GitHub repo to host the code, and name it Photobook Frame. Check for any bugs and fix them. Make the repo visually interesting in the README and host it on GitHub.io

### Claude

**Analysis.** The upload is a single 5.4 MB HTML file. About 5 MB of that is four sample photos embedded as base64. The rest is a three-column photobook editor built with Tailwind (Play CDN) and Lucide icons:

- a photo library with EXIF parsing (date, camera, exposure, GPS);
- a desk with rulers, draggable guides and magnetic snapping, holding the cover wrap or a double-page spread;
- an inspector with cover/spread templates, paper, book size, fonts, arrange controls, 14 film looks with 7 sliders, and EXIF date stamps;
- a spread timeline;
- PNG export of a spread and print-to-PDF of the whole book.

**Where it lives.** This session can only push to `storitellah/tools-by-storitellah`, so creating a separate repository wasn't possible. Following that repo's conventions, the tool went in as its own folder, `PhotobookFrame/`, with a README, a build chat and a row in the root table. GitHub Pages serves it from that folder once Pages is switched on for the repository.

**Bug hunt.** The original was first committed unchanged. A headless-browser harness then loaded it with the CDNs served from local copies, and scripted repros confirmed these bugs:

1. Overlapping async renders: rapid slider input left 28 elements on the spread for 2 photos.
2. The margin slider re-added the story template's text boxes on every step (8 after a short drag) and dropped extra photos.
3. Switching cover templates swapped the front and back photos and deleted user text. Switching inside templates also deleted user text.
4. Holding Space to pan also "clicked" the last button pressed. The V/H/R shortcuts in the tooltips did nothing.
5. Double-click to edit text never worked, because the first click rebuilt the DOM.
6. Exported text was squeezed onto one line instead of wrapping, and ignored tracking.
7. The on-screen zoom origin differed from the export, so prints were cropped differently from the preview.
8. Custom backgrounds were stretched in exports.
9. Print came out at Letter size, about 110 dpi, with no font wait.
10. Text disappeared on dark paper.
11. Undecodable uploads were added as broken photos. Damaged EXIF made valid photos fail. A drop outside the drop box replaced the app with the file.
12. The render cache kept a JPEG for every slider position.
13. Date stamps baked in the fallback font. The Google Font loader didn't wait for the font or check that it existed.
14. Canvas filters are missing in Safari before 18, so looks did nothing there.
15. Rulers and snapping used a different custom-size clamp from the layout.
16. Smaller issues: the cover could be duplicated, the Looks tab kept stale photo data, the UTC date was used as the fallback, and there was no warning before leaving.

**Fixes.** All of the above were fixed and re-tested. Template-made items are now tagged (role and slot), so a re-layout keeps user content. Export text is laid out at design size, so wrapping and variable-font optical size match the screen. A pixel fallback for canvas filters matches Chrome to within 0.74/255 on average.

**Branding.** The app is now "Photobook Frame by Storitellah" with a link to storitellah.com. Exports (spread PNGs, the print/PDF and edited photos) carry a small "Photobook Frame by Storitellah · storitellah.com" credit. It's on by default and can be turned off under *Templates → Export*. The visible "Snapseed" labels became "Looks" and "Photo Studio". There's a favicon, a "Download the build chat" link, and this chat embedded in the page.

**README.** A banner graphic, badges, a feature grid, screenshots of the real app and its exports, usage steps, keyboard shortcuts and a table of the bugs fixed.
