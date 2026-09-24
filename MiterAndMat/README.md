# Miter & Mat

A browser tool for framing photo mockups in hardwood frame styles. It is one
HTML file with no build step. Its only network requests are for Google Fonts and
JSZip (for batch ZIP export). Open `index.html` in a browser.

## What it does

- **Batch:** add one photo or many (choose, drop or paste). Step through them
  with the thumbnails or the ‹ › buttons, and drag the preview to move each
  photo's crop.
- **Frames that fit the photo:** every frame takes its photo's exact aspect
  ratio. You set one size, either the art's long side or the outside of the
  frame, from 4" to 48". There are quick picks from 5" to 36", and the moulding
  width is adjustable.
- **Frames:** 16 styles. Each is drawn procedurally with wood grain, a
  gallery, round, slim, stepped or gilded profile, and mitered corners. Every
  rail is cut from a different board. **New boards** re-rolls the grain, and
  each photo in a batch gets its own boards.
- **Looks from the page:** one click applies any of the four framed examples
  the page shows, such as "Black Walnut Gallery with a red mat".
- **Mat:** beveled, float mount or none. Colors are Classic white, off-white,
  black, red, five linen neutrals or custom.
- **Background:** 12 colors (including the page's suggested creamy off-white and
  sage green), a custom color, or transparent. Soft wall light, shadow and
  glazing glare can each be turned off.
- **Layout:** fit to the frame, or fix the image shape at 1:1, 4:5, 2:3, 3:2,
  16:9 or 9:16. You can adjust the space around the frame.
- **Export:** a PNG of the current photo, or all photos as one ZIP, at 1600,
  3200 or 4800 px on the long side. The ZIP uses JSZip from cdnjs. If that
  can't load, the tool offers the PNGs one at a time.

## Frame catalogue

Frames come from a Framebridge "Walnut Gallery" product page and its
"American Hardwoods" recommendations.

| Frame | Profile | Finish (from the page) |
| --- | --- | --- |
| Walnut Gallery | Gallery | Solid walnut, espresso to light brown. 13/16" wide × 1 1/4" deep (listed) |
| Black Walnut Gallery | Gallery | Walnut, black finish |
| Indigo Walnut Gallery | Gallery | Walnut, deep navy blue finish |
| Cherry Gallery | Gallery | Solid cherry |
| Ash Gallery | Gallery | Solid ash, natural |
| Bleached Maple Gallery | Gallery | Maple, whitewashed |
| Walnut Round | Round | Solid walnut |
| Black Walnut Round | Round | Walnut, black finish |
| Indigo Walnut Round | Round | Walnut, deep navy blue finish |
| Cherry Round | Round | Cherry |
| Ash Round | Round | Solid ash |
| Bleached Maple Round | Round | Bleached maple, whitewashed |
| Stratton | Stepped (interpreted) | Pine, warm walnut stain, traditional design (FAQ) |
| Richmond | Gilded (interpreted) | Gold (float-mount example) |
| Irvine Slim | Slim (interpreted) | Named for float-mounted wedding details; finish not described |
| White Gallery | Gallery (interpreted) | Generic white frame; the page says Walnut Gallery blends with "even white frames" |

Only Walnut Gallery lists its dimensions. The other frames use the same size
by default, and the tool labels that size as assumed. The page doesn't
describe Irvine Slim's finish, so the slim natural-wood look here is an
interpretation.

The renderings are approximations for mockups, not product photos.
