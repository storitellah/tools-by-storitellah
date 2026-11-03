import CoreGraphics
import Foundation

// MARK: - Component structs
//
// Everything a camera *is* lives in `FilmStock`. There is no per-stock code
// anywhere in the app: `FilmPipeline` reads these numbers and nothing else.
// Adding a tenth camera means appending one literal to `FilmStockLibrary`.

/// White-balance move. `neutral` is the temperature the shot is assumed to have
/// been lit at; `target` is where we push it. target < neutral cools the frame,
/// target > neutral warms it. `tint` slides green (-) to magenta (+).
struct Temperature: Hashable, Codable {
    var neutral: Double = 6500
    var target: Double = 6500
    var tint: Double = 0

    static let asShot = Temperature()
}

/// Five control points fed to `CIToneCurve`, in 0...1 input / 0...1 output.
/// Point 0 sets the black level (lift it to fog the shadows), point 4 the white.
struct ToneCurve: Hashable, Codable {
    var p0: CGPoint
    var p1: CGPoint
    var p2: CGPoint
    var p3: CGPoint
    var p4: CGPoint

    static let linear = ToneCurve(
        p0: CGPoint(x: 0.00, y: 0.00),
        p1: CGPoint(x: 0.25, y: 0.25),
        p2: CGPoint(x: 0.50, y: 0.50),
        p3: CGPoint(x: 0.75, y: 0.75),
        p4: CGPoint(x: 1.00, y: 1.00)
    )

    /// Convenience for the usual film shape: raised toe, rolled shoulder.
    /// `lift` raises pure black, `shoulder` pulls pure white down,
    /// `contrast` bends the middle (positive = S-curve).
    static func filmic(lift: Double = 0, shoulder: Double = 0, contrast: Double = 0) -> ToneCurve {
        let low = 0.25 + contrast * -0.06
        let high = 0.75 + contrast * 0.06
        return ToneCurve(
            p0: CGPoint(x: 0.00, y: lift),
            p1: CGPoint(x: 0.25, y: lift + (low * (1 - lift - shoulder))),
            p2: CGPoint(x: 0.50, y: lift + (0.5 * (1 - lift - shoulder))),
            p3: CGPoint(x: 0.75, y: lift + (high * (1 - lift - shoulder))),
            p4: CGPoint(x: 1.00, y: 1.0 - shoulder)
        )
    }

    var points: [CGPoint] { [p0, p1, p2, p3, p4] }
}

/// Per-channel colour bias, split the way a colourist thinks about it.
/// `lift` is added everywhere (shadow tint / base fog), `gain` multiplies
/// (highlight tint), `mid` pushes the mid-tones only via a quadratic bump.
struct ChannelBias: Hashable, Codable {
    var lift: RGB = .zero
    var gain: RGB = .one
    var mid: RGB = .zero

    static let none = ChannelBias()

    var isIdentity: Bool { lift == .zero && gain == .one && mid == .zero }
}

/// Channel-mixed black & white. `weights` are the R/G/B contributions to
/// luminance (they get normalised), `tint` optionally warms or cools the result.
struct Monochrome: Hashable, Codable {
    var weights: RGB = RGB(0.299, 0.587, 0.114)
    var tint: RGB = .one
    var tintAmount: Double = 0
}

/// Additive film grain. `size` is the grain cell in pixels at the reference
/// width, so grain stays visually identical between a 1080-wide preview and a
/// 4032-wide capture. `shadowBias` at 1.0 confines grain to the shadows,
/// `chroma` at 0 keeps it monochrome.
struct Grain: Hashable, Codable {
    var intensity: Double = 0
    var size: Double = 1
    var shadowBias: Double = 0
    var chroma: Double = 0

    static let none = Grain()
}

/// Darkened corners. Radii are fractions of half the image diagonal, so the
/// shape is resolution independent.
struct Vignette: Hashable, Codable {
    var intensity: Double = 0
    var innerRadius: Double = 0.45
    var outerRadius: Double = 1.05

    static let none = Vignette()
}

/// Highlight bleed. Everything above `threshold` is isolated, blurred by
/// `radius` (fraction of the reference width), tinted and screened back on.
struct Bloom: Hashable, Codable {
    var intensity: Double = 0
    var radius: Double = 0.02
    var threshold: Double = 0.7
    var tint: RGB = .one

    static let none = Bloom()
}

/// Red/blue channel misregistration. `amount` is a fraction of the reference
/// width; `angle` is the direction the red channel travels (blue goes the
/// other way).
struct ChromaShift: Hashable, Codable {
    var amount: Double
    var angle: Double = 0
}

/// Multiply-blended horizontal lines, for CRT and tape looks.
/// `spacing` is a fraction of image height, `darkness` how black the dark line is.
struct Scanlines: Hashable, Codable {
    var spacing: Double = 0.005
    var darkness: Double = 0.15
    var sharpness: Double = 0.6
}

/// Burned-in camera-back date, bottom right.
struct DateStampStyle: Hashable, Codable {
    var color: RGB = RGB(1.0, 0.42, 0.06)
    var glow: Double = 0.6
    /// Cap height as a fraction of image height.
    var height: Double = 0.028
    /// Inset from the right and bottom edges, as a fraction of image width.
    var margin: Double = 0.045
    var fontName: String = "Menlo-Bold"
    var format: DateStampFormat = .yyMMdd
}

enum DateStampFormat: String, Hashable, Codable {
    /// `'26 09 08` — the Konica/Fuji camera-back style.
    case yyMMdd
    /// `SEP 08 2026`
    case monthDayYear
}

// MARK: - The stock itself

/// One camera. Nine of these are shipped in `FilmStockLibrary`; the renderer
/// has no idea which one it is holding.
struct FilmStock: Identifiable, Hashable, Codable {
    var id: String
    var name: String
    var caption: String
    /// Tile colour in the carousel.
    var swatch: RGB

    var exposure: Double = 0
    var temperature: Temperature = .asShot
    var channelBias: ChannelBias = .none
    var toneCurve: ToneCurve = .linear
    var contrast: Double = 1.0
    var saturation: Double = 1.0
    var monochrome: Monochrome?

    /// 1.0 renders at full resolution; 0.5 renders at half and scales back up
    /// for a soft, low-line look.
    var resolutionScale: Double = 1.0
    /// Gaussian softening, as a fraction of the reference width.
    var softness: Double = 0

    var bloom: Bloom = .none
    var chromaShift: ChromaShift?
    var scanlines: Scanlines?
    var grain: Grain = .none
    var vignette: Vignette = .none
    var dateStamp: DateStampStyle?
}
