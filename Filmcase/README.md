# Filmcase

A vintage film camera for iPhone. The viewfinder is not a live preview with a
filter painted on top — every frame the camera produces is pushed through the
selected film stock and *that* is what you see, at display refresh rate. The
shutter runs the sensor's full-resolution still through the same pipeline, so
the photo you get is the photo you framed.

Nine cameras ship with it. A camera is one `FilmStock` value: temperature, tone
curve, channel bias, saturation, grain, vignette, bloom and an optional chroma
shift, plus a few extras. There is no per-camera code anywhere.

SwiftUI, AVFoundation and Core Image on a Metal-backed context. No third-party
packages, no accounts, no analytics, no network calls.

---

## Build and run

Requirements: **Xcode 15.0 or newer**, **iOS 17.0** deployment target, and a
real iPhone for the camera (the Simulator has no camera, though the develop
screen and the film roll work there).

```bash
git clone <this repo>
cd tools-by-storitellah/Filmcase
open Filmcase.xcodeproj
```

Then in Xcode:

1. Select the **Filmcase** scheme and your iPhone as the destination.
2. Set a development team: target **Filmcase** → *Signing & Capabilities* →
   *Team*. Change the bundle identifier if `com.storitellah.filmcase` is taken.
3. ⌘R.

First launch asks for camera access. Saving a frame to Photos asks for
add-only photo library access, the first time you tap Save.

From the command line:

```bash
xcodebuild -project Filmcase.xcodeproj -scheme Filmcase \
  -destination 'platform=iOS Simulator,name=iPhone 15' build
```

## Tests

```bash
xcodebuild test -project Filmcase.xcodeproj -scheme Filmcase \
  -destination 'platform=iOS Simulator,name=iPhone 15'
```

`FilmPipelineDeterminismTests` is the important one. It builds a fixed test
chart in code (no asset files), develops it through a fixed stock with a fixed
seed, and asserts the bytes come back identical — twice on one renderer, and
again on a renderer that shares no context with the first. It also proves the
seed is load-bearing (a different seed moves the grain), that the date stamp
reaches the pixels, that all nine stocks are reproducible and distinct, and
that the grain offsets are the pinned values rather than anything derived from
`Hasher`, which is salted per process.

Two checks run anywhere, with or without Xcode:

```bash
python3 Scripts/check_sources.py      # parses the Swift, memberwise-init calls, Apple-only imports, no network APIs
python3 Scripts/check_xcodeproj.py    # project references, build phases, settings, plists, scheme
```

`check_sources.py` parses the sources properly if you give it a grammar:

```bash
pip install tree-sitter tree_sitter_swift
```

Without it, it falls back to a string- and comment-aware delimiter balance and
says so in its output. Neither mode type-checks — that is what Xcode is for —
but the grammar catches real syntax errors, and the rest of the checks catch
the project-file and initialiser mistakes that are easy to make by hand.

`Scripts/make_xcodeproj.py` regenerates `Filmcase.xcodeproj` from what is on
disk. The project file is committed, so you only need it after adding, moving
or deleting a source file — and `check_xcodeproj.py` will tell you if you
forgot.

## Adding a film stock

A camera is data. Append one literal to `Filmcase/Model/FilmStockLibrary.swift`
and add it to `all`:

```swift
static let sunFaded = FilmStock(
    id: "sunfaded",                       // stable: it is what gets persisted
    name: "Sun Faded",                    // shown under the carousel tile
    caption: "Left on the dashboard",     // one line under the viewfinder
    swatch: RGB(0.86, 0.74, 0.58),        // the carousel tile colour
    exposure: 0.15,                       // EV
    temperature: Temperature(neutral: 6500, target: 7200, tint: 5),
    channelBias: ChannelBias(
        lift: RGB(0.05, 0.04, 0.02),      // added everywhere: shadow tint, base fog
        gain: RGB(1.04, 1.0, 0.92),       // multiplied: highlight tint
        mid: RGB(0.03, 0.0, -0.02)        // mid-tones only, zero at both ends
    ),
    toneCurve: .filmic(lift: 0.08, shoulder: 0.05, contrast: -0.3),
    contrast: 0.95,
    saturation: 0.8,
    bloom: Bloom(intensity: 0.3, radius: 0.035, threshold: 0.65, tint: RGB(1.0, 0.9, 0.75)),
    grain: Grain(intensity: 0.07, size: 1.8, shadowBias: 0.5, chroma: 0.2),
    vignette: Vignette(intensity: 0.3, innerRadius: 0.45, outerRadius: 1.1)
)

static let all: [FilmStock] = [..., sunFaded]
```

That is the whole job. The carousel, the live viewfinder, capture and the
import-and-develop screen all iterate `FilmStockLibrary.all`, so the new camera
appears in each of them. `FilmStockLibraryTests` will hold you to a unique id,
a name, a caption and a working `resolutionScale`; bump the expected count in
`testShipsNineCameras`.

Fields you can leave out have sensible defaults. The ones worth knowing:

| Field | What it does |
| --- | --- |
| `exposure` | EV, applied first |
| `temperature` | `target` above `neutral` warms, below cools; `tint` is green (−) to magenta (+) |
| `channelBias` | `lift` / `gain` / `mid` per channel — shadows, highlights, mid-tones |
| `toneCurve` | five control points; `.filmic(lift:shoulder:contrast:)` builds the usual shape |
| `contrast`, `saturation` | 1.0 is untouched |
| `monochrome` | channel-mixed B&W with an optional tone |
| `resolutionScale` | below 1.0 renders small and scales back up, for a tape look |
| `softness` | Gaussian blur, as a fraction of image width |
| `bloom` | isolate above `threshold`, blur by `radius`, tint, screen back on |
| `chromaShift` | pull the red and blue records apart by `amount` along `angle` |
| `scanlines` | multiply-blended horizontal lines |
| `grain` | `intensity`, `size` (px at 1080 wide), `shadowBias`, `chroma` |
| `vignette` | radii are fractions of the half-diagonal, so it is resolution independent |
| `dateStamp` | burned-in camera-back date, bottom right |

Distances (`radius`, `amount`, `margin`, `spacing`) are fractions of the image,
and grain `size` is quoted at 1080 px wide and scaled, so a stock looks the same
in the 1080-wide viewfinder as in a 4032-wide capture.

## How it fits together

```
Filmcase/
  Model/       FilmStock and the nine literals. Pure data, no Core Image.
  Render/      FilmPipeline (the look), FilmRenderer (rasterising), CIContextFactory.
  Camera/      Capture session, the Metal viewfinder, permissions.
  Roll/        On-disk film roll and the Photos hand-off.
  UI/          SwiftUI screens.
```

The pipeline, in order: exposure → temperature → channel bias → tone curve →
contrast and saturation → monochrome → resolution scale → softness → bloom →
chroma shift → scanlines → grain → vignette → date stamp → clamp.

Two things make it reproducible, which is what the determinism test leans on:

* **Grain is positioned, not generated.** `FilmPipeline` reads a fixed noise
  field at an offset derived from a seed with splitmix64. Live frames pass a
  frame counter so the grain moves; a capture picks one seed and stores it with
  the frame.
* **The date stamp arrives as text.** The pipeline never sees a `Date`, so
  `apply(to:stock:seed:stampText:)` is a pure function of its arguments.

The Core Image working colour space is pinned to sRGB rather than Core Image's
default linear space, because tone curves and lifts are authored the way a
colourist reads them — as moves on display-referred values.

## Privacy

Everything happens on the device. There is no account, no analytics and no
networking code, and `Scripts/check_sources.py` fails if anyone adds any. Captures live in the app's own container; they reach your photo library
only when you tap Save, through add-only authorisation. Imports come through
`PhotosPicker`, which runs out of process, so the app never gains read access to
your library. `PrivacyInfo.xcprivacy` declares no tracking and no collected
data.

If camera access is denied, the app says so and offers a shortcut into Settings
— and still lets you develop photos you already have.

## Out of scope

No video modes, no effect lenses, and not a forty-stock library. Nine good
looks.
