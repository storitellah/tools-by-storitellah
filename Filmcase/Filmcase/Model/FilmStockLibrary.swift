import CoreGraphics
import Foundation

/// The shipped cameras. Order here is the order of the carousel.
///
/// To add a camera: append one `FilmStock` literal. Nothing else in the app
/// needs to change — the carousel, the live viewfinder, capture and the
/// import-and-develop screen all iterate this array.
enum FilmStockLibrary {

    static let all: [FilmStock] = [
        neutral,
        faded80s,
        instant,
        gold135,
        noir,
        ccd,
        neon3D,
        expired,
        vhs
    ]

    static let `default`: FilmStock = neutral

    static func stock(id: String) -> FilmStock {
        all.first { $0.id == id } ?? `default`
    }

    // MARK: 1 — Neutral

    /// The reference look: what the sensor saw, with just enough grain and
    /// corner falloff to sit next to the others without looking clinical.
    static let neutral = FilmStock(
        id: "neutral",
        name: "Neutral",
        caption: "Straight off the sensor",
        swatch: RGB(0.82, 0.82, 0.80),
        toneCurve: .filmic(lift: 0.005, shoulder: 0.005, contrast: 0.15),
        contrast: 1.02,
        saturation: 1.02,
        grain: Grain(intensity: 0.03, size: 1.2, shadowBias: 0.4, chroma: 0.1),
        vignette: Vignette(intensity: 0.12, innerRadius: 0.62, outerRadius: 1.15)
    )

    // MARK: 2 — Faded 80s negative

    /// Colour negative left in a shoebox: milky blacks, cyan shadows,
    /// dusty magenta highlights, saturation long gone.
    static let faded80s = FilmStock(
        id: "faded80s",
        name: "Faded 80s",
        caption: "Shoebox negative, colours gone soft",
        swatch: RGB(0.78, 0.66, 0.66),
        exposure: 0.12,
        temperature: Temperature(neutral: 6500, target: 6900, tint: 6),
        channelBias: ChannelBias(
            lift: RGB(0.045, 0.055, 0.075),
            gain: RGB(1.02, 0.99, 0.94),
            mid: RGB(0.02, -0.01, 0.03)
        ),
        toneCurve: .filmic(lift: 0.09, shoulder: 0.06, contrast: -0.35),
        contrast: 0.92,
        saturation: 0.72,
        softness: 0.0012,
        bloom: Bloom(intensity: 0.22, radius: 0.03, threshold: 0.66, tint: RGB(1.0, 0.92, 0.86)),
        grain: Grain(intensity: 0.075, size: 2.0, shadowBias: 0.5, chroma: 0.25),
        vignette: Vignette(intensity: 0.30, innerRadius: 0.45, outerRadius: 1.10)
    )

    // MARK: 3 — Instant film

    /// SX-70 chemistry: cool green shadows, warm chalky highlights, low
    /// contrast, a soft bloom and a heavy print border falloff.
    static let instant = FilmStock(
        id: "instant",
        name: "Instant",
        caption: "Peel-apart pack film",
        swatch: RGB(0.86, 0.83, 0.71),
        exposure: 0.18,
        temperature: Temperature(neutral: 6500, target: 6250, tint: -4),
        channelBias: ChannelBias(
            lift: RGB(0.02, 0.055, 0.05),
            gain: RGB(1.05, 1.0, 0.9),
            mid: RGB(0.03, 0.02, -0.03)
        ),
        toneCurve: .filmic(lift: 0.07, shoulder: 0.11, contrast: -0.2),
        contrast: 0.95,
        saturation: 0.86,
        softness: 0.0018,
        bloom: Bloom(intensity: 0.35, radius: 0.045, threshold: 0.6, tint: RGB(1.0, 0.95, 0.82)),
        grain: Grain(intensity: 0.05, size: 1.6, shadowBias: 0.3, chroma: 0.15),
        vignette: Vignette(intensity: 0.34, innerRadius: 0.40, outerRadius: 1.05)
    )

    // MARK: 4 — Warm Gold 135

    /// Consumer 200-speed colour: golden hour whether or not it is,
    /// deep reds, clean fine grain.
    static let gold135 = FilmStock(
        id: "gold135",
        name: "Gold 135",
        caption: "Warm consumer colour, 200 speed",
        swatch: RGB(0.92, 0.72, 0.32),
        exposure: 0.05,
        temperature: Temperature(neutral: 6500, target: 7400, tint: 4),
        channelBias: ChannelBias(
            lift: RGB(0.018, 0.012, 0.0),
            gain: RGB(1.06, 1.01, 0.93),
            mid: RGB(0.05, 0.02, -0.02)
        ),
        toneCurve: .filmic(lift: 0.03, shoulder: 0.03, contrast: 0.4),
        contrast: 1.06,
        saturation: 1.16,
        bloom: Bloom(intensity: 0.24, radius: 0.028, threshold: 0.72, tint: RGB(1.0, 0.80, 0.55)),
        grain: Grain(intensity: 0.045, size: 1.3, shadowBias: 0.45, chroma: 0.12),
        vignette: Vignette(intensity: 0.22, innerRadius: 0.52, outerRadius: 1.12)
    )

    // MARK: 5 — Gritty B&W

    /// Pushed Tri-X: red-weighted mix so skies go dark, hard S-curve,
    /// coarse grain that lands mostly in the shadows.
    static let noir = FilmStock(
        id: "noir",
        name: "Tri-X Push",
        caption: "Pushed black & white, coarse grain",
        swatch: RGB(0.30, 0.30, 0.31),
        exposure: -0.05,
        toneCurve: .filmic(lift: 0.02, shoulder: 0.01, contrast: 0.85),
        contrast: 1.18,
        monochrome: Monochrome(
            weights: RGB(0.42, 0.44, 0.14),
            tint: RGB(1.0, 0.98, 0.94),
            tintAmount: 0.12
        ),
        grain: Grain(intensity: 0.16, size: 2.4, shadowBias: 0.55, chroma: 0.0),
        vignette: Vignette(intensity: 0.42, innerRadius: 0.38, outerRadius: 1.05)
    )

    // MARK: 6 — Y2K CCD digicam

    /// Early-2000s compact: cool cast, over-eager saturation, clipped
    /// highlights, a faint sensor pattern and just-visible fringing.
    static let ccd = FilmStock(
        id: "ccd",
        name: "CCD 2003",
        caption: "Y2K digicam, flash-lit and clipped",
        swatch: RGB(0.55, 0.78, 0.86),
        exposure: 0.2,
        temperature: Temperature(neutral: 6500, target: 6150, tint: -6),
        channelBias: ChannelBias(
            lift: RGB(0.0, 0.012, 0.02),
            gain: RGB(0.98, 1.02, 1.05),
            mid: RGB(-0.02, 0.02, 0.02)
        ),
        toneCurve: .filmic(lift: 0.0, shoulder: -0.04, contrast: 0.7),
        contrast: 1.14,
        saturation: 1.34,
        bloom: Bloom(intensity: 0.30, radius: 0.016, threshold: 0.80, tint: RGB(0.92, 0.98, 1.0)),
        chromaShift: ChromaShift(amount: 0.0016, angle: 0.0),
        scanlines: Scanlines(spacing: 0.0022, darkness: 0.05, sharpness: 0.2),
        grain: Grain(intensity: 0.055, size: 1.0, shadowBias: 0.8, chroma: 0.65),
        vignette: Vignette(intensity: 0.20, innerRadius: 0.55, outerRadius: 1.12)
    )

    // MARK: 7 — Neon-violet 3D

    /// Anaglyph-adjacent club look: violet mids, cold blue shadows, a wide
    /// red/cyan split and a lot of bloom.
    static let neon3D = FilmStock(
        id: "neon3d",
        name: "Neon 3D",
        caption: "Violet split, anaglyph fringe",
        swatch: RGB(0.62, 0.34, 0.95),
        exposure: -0.08,
        temperature: Temperature(neutral: 6500, target: 6300, tint: 14),
        channelBias: ChannelBias(
            lift: RGB(0.02, 0.0, 0.075),
            gain: RGB(1.04, 0.90, 1.12),
            mid: RGB(0.04, -0.05, 0.08)
        ),
        toneCurve: .filmic(lift: 0.04, shoulder: 0.02, contrast: 0.6),
        contrast: 1.10,
        saturation: 1.22,
        bloom: Bloom(intensity: 0.55, radius: 0.05, threshold: 0.55, tint: RGB(0.85, 0.45, 1.0)),
        chromaShift: ChromaShift(amount: 0.006, angle: 0.0),
        grain: Grain(intensity: 0.06, size: 1.5, shadowBias: 0.4, chroma: 0.4),
        vignette: Vignette(intensity: 0.40, innerRadius: 0.40, outerRadius: 1.02)
    )

    // MARK: 8 — Expired film

    /// Ten years past the date, stored warm: fogged base, yellow-green cast,
    /// dead shadows, red halation around every highlight.
    static let expired = FilmStock(
        id: "expired",
        name: "Expired",
        caption: "Ten years past the date stamp",
        swatch: RGB(0.72, 0.74, 0.42),
        exposure: 0.22,
        temperature: Temperature(neutral: 6500, target: 6800, tint: -14),
        channelBias: ChannelBias(
            lift: RGB(0.075, 0.085, 0.03),
            gain: RGB(1.02, 1.03, 0.82),
            mid: RGB(0.03, 0.05, -0.06)
        ),
        toneCurve: .filmic(lift: 0.13, shoulder: 0.05, contrast: -0.5),
        contrast: 0.88,
        saturation: 0.78,
        softness: 0.0015,
        bloom: Bloom(intensity: 0.42, radius: 0.055, threshold: 0.58, tint: RGB(1.0, 0.42, 0.30)),
        chromaShift: ChromaShift(amount: 0.0022, angle: 2.2),
        grain: Grain(intensity: 0.13, size: 2.6, shadowBias: 0.6, chroma: 0.5),
        vignette: Vignette(intensity: 0.46, innerRadius: 0.36, outerRadius: 1.0)
    )

    // MARK: 9 — VHS

    /// Tape: half-line resolution, chroma bleeding sideways, scanlines,
    /// and the camcorder's date burned into the bottom right.
    static let vhs = FilmStock(
        id: "vhs",
        name: "VHS",
        caption: "Tape, tracking, date burned in",
        swatch: RGB(0.38, 0.62, 0.58),
        exposure: 0.1,
        temperature: Temperature(neutral: 6500, target: 6200, tint: -8),
        channelBias: ChannelBias(
            lift: RGB(0.02, 0.045, 0.05),
            gain: RGB(0.98, 1.03, 1.0),
            mid: RGB(-0.02, 0.03, 0.01)
        ),
        toneCurve: .filmic(lift: 0.07, shoulder: 0.04, contrast: 0.25),
        contrast: 1.05,
        saturation: 0.94,
        resolutionScale: 0.5,
        softness: 0.0022,
        bloom: Bloom(intensity: 0.34, radius: 0.03, threshold: 0.62, tint: RGB(0.80, 1.0, 0.95)),
        chromaShift: ChromaShift(amount: 0.0045, angle: 0.0),
        scanlines: Scanlines(spacing: 0.0042, darkness: 0.16, sharpness: 0.45),
        grain: Grain(intensity: 0.08, size: 1.8, shadowBias: 0.35, chroma: 0.55),
        vignette: Vignette(intensity: 0.28, innerRadius: 0.48, outerRadius: 1.10),
        dateStamp: DateStampStyle()
    )
}
