import CoreGraphics
import CoreImage
import Foundation

/// Turns a `FilmStock` into a `CIImage` transformation.
///
/// This is the single place a look is applied: the live viewfinder, the
/// full-resolution capture and the import-and-develop screen all call
/// `apply(to:stock:seed:stampText:)`. Nothing here branches on a stock's
/// identity, only on its numbers, which is what makes a new camera pure data.
///
/// The function is pure: same input image + stock + seed + stamp text always
/// produces the same output. Grain is positioned from `seed` rather than from a
/// random number generator, and the date stamp arrives as finished text rather
/// than as a `Date`. `FilmPipelineDeterminismTests` leans on both.
enum FilmPipeline {

    /// Stock parameters that are quoted in pixels (currently only grain cell
    /// size) are quoted at this width and scaled to whatever they are given, so
    /// a 1080-wide preview and a 4032-wide capture look the same.
    static let referenceWidth: CGFloat = 1080

    // MARK: - Entry point

    static func apply(to input: CIImage, stock: FilmStock, seed: UInt64, stampText: String? = nil) -> CIImage {
        let extent = input.extent
        guard !extent.isInfinite, extent.width > 1, extent.height > 1 else { return input }

        var image = input
        image = applyExposure(image, stock)
        image = applyTemperature(image, stock)
        image = applyChannelBias(image, stock)
        image = applyToneCurve(image, stock)
        image = applyColorControls(image, stock)
        image = applyMonochrome(image, stock)
        image = applyResolutionScale(image, stock, extent: extent)
        image = applySoftness(image, stock, extent: extent)
        image = applyBloom(image, stock, extent: extent)
        image = applyChromaShift(image, stock, extent: extent)
        image = applyScanlines(image, stock, extent: extent)
        image = applyGrain(image, stock, seed: seed, extent: extent)
        image = applyVignette(image, stock, extent: extent)
        image = applyDateStamp(image, stock, text: stampText, extent: extent)

        return image
            .applyingFilter("CIColorClamp", parameters: [
                "inputMinComponents": CIVector(x: 0, y: 0, z: 0, w: 0),
                "inputMaxComponents": CIVector(x: 1, y: 1, z: 1, w: 1)
            ])
            .cropped(to: extent)
    }

    // MARK: - Stages

    private static func applyExposure(_ image: CIImage, _ stock: FilmStock) -> CIImage {
        guard stock.exposure != 0 else { return image }
        return image.applyingFilter("CIExposureAdjust", parameters: [kCIInputEVKey: stock.exposure])
    }

    /// `CITemperatureAndTint` re-maps the colour the image currently treats as
    /// neutral onto a new one, so a target above `neutral` warms the frame and a
    /// target below it cools the frame.
    private static func applyTemperature(_ image: CIImage, _ stock: FilmStock) -> CIImage {
        let t = stock.temperature
        guard t.target != t.neutral || t.tint != 0 else { return image }
        return image.applyingFilter("CITemperatureAndTint", parameters: [
            "inputNeutral": CIVector(x: t.neutral, y: 0),
            "inputTargetNeutral": CIVector(x: t.target, y: t.tint)
        ])
    }

    /// Lift and gain go through a colour matrix (a per-channel multiply plus an
    /// offset); the mid-tone push goes through a per-channel quadratic, which is
    /// what `CIColorPolynomial` is for. The bump `4m·x·(1 - x)` peaks at 50%
    /// grey and vanishes at both ends, so mid-tone tinting never fogs the blacks
    /// or stains the whites.
    private static func applyChannelBias(_ image: CIImage, _ stock: FilmStock) -> CIImage {
        let bias = stock.channelBias
        guard !bias.isIdentity else { return image }
        var out = image

        if bias.gain != .one || bias.lift != .zero {
            out = out.applyingFilter("CIColorMatrix", parameters: [
                "inputRVector": CIVector(x: bias.gain.r, y: 0, z: 0, w: 0),
                "inputGVector": CIVector(x: 0, y: bias.gain.g, z: 0, w: 0),
                "inputBVector": CIVector(x: 0, y: 0, z: bias.gain.b, w: 0),
                "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
                "inputBiasVector": CIVector(x: bias.lift.r, y: bias.lift.g, z: bias.lift.b, w: 0)
            ])
        }

        if bias.mid != .zero {
            func coefficients(_ m: Double) -> CIVector {
                CIVector(x: 0, y: 1 + 4 * m, z: -4 * m, w: 0)
            }
            out = out.applyingFilter("CIColorPolynomial", parameters: [
                "inputRedCoefficients": coefficients(bias.mid.r),
                "inputGreenCoefficients": coefficients(bias.mid.g),
                "inputBlueCoefficients": coefficients(bias.mid.b),
                "inputAlphaCoefficients": CIVector(x: 0, y: 1, z: 0, w: 0)
            ])
        }

        return out
    }

    private static func applyToneCurve(_ image: CIImage, _ stock: FilmStock) -> CIImage {
        let curve = stock.toneCurve
        guard curve != .linear else { return image }
        return image.applyingFilter("CIToneCurve", parameters: [
            "inputPoint0": CIVector(cgPoint: curve.p0),
            "inputPoint1": CIVector(cgPoint: curve.p1),
            "inputPoint2": CIVector(cgPoint: curve.p2),
            "inputPoint3": CIVector(cgPoint: curve.p3),
            "inputPoint4": CIVector(cgPoint: curve.p4)
        ])
    }

    private static func applyColorControls(_ image: CIImage, _ stock: FilmStock) -> CIImage {
        guard stock.contrast != 1 || stock.saturation != 1 else { return image }
        return image.applyingFilter("CIColorControls", parameters: [
            kCIInputContrastKey: stock.contrast,
            kCIInputSaturationKey: stock.saturation,
            kCIInputBrightnessKey: 0
        ])
    }

    /// Channel-mixed monochrome plus an optional tone. One matrix does both:
    /// each input channel contributes its normalised weight to every output
    /// channel, scaled by the tone that channel should carry.
    private static func applyMonochrome(_ image: CIImage, _ stock: FilmStock) -> CIImage {
        guard let mono = stock.monochrome else { return image }
        let sum = max(0.0001, mono.weights.r + mono.weights.g + mono.weights.b)
        let w = RGB(mono.weights.r / sum, mono.weights.g / sum, mono.weights.b / sum)
        let amount = mono.tintAmount
        let tone = RGB(
            1 + (mono.tint.r - 1) * amount,
            1 + (mono.tint.g - 1) * amount,
            1 + (mono.tint.b - 1) * amount
        )
        func column(_ weight: Double) -> CIVector {
            CIVector(x: weight * tone.r, y: weight * tone.g, z: weight * tone.b, w: 0)
        }
        return image.applyingFilter("CIColorMatrix", parameters: [
            "inputRVector": column(w.r),
            "inputGVector": column(w.g),
            "inputBVector": column(w.b),
            "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
            "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 0)
        ])
    }

    /// Renders down and back up again, so detail is thrown away the way a tape
    /// format throws it away rather than merely blurred.
    private static func applyResolutionScale(_ image: CIImage, _ stock: FilmStock, extent: CGRect) -> CIImage {
        let scale = stock.resolutionScale
        guard scale > 0, scale < 1 else { return image }
        let down = image.applyingFilter("CILanczosScaleTransform", parameters: [
            kCIInputScaleKey: scale,
            kCIInputAspectRatioKey: 1.0
        ])
        return down
            .transformed(by: CGAffineTransform(scaleX: 1 / scale, y: 1 / scale))
            .clampedToExtent()
            .cropped(to: extent)
    }

    private static func applySoftness(_ image: CIImage, _ stock: FilmStock, extent: CGRect) -> CIImage {
        guard stock.softness > 0 else { return image }
        let radius = stock.softness * Double(extent.width)
        guard radius > 0.01 else { return image }
        return image
            .clampedToExtent()
            .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: radius])
            .cropped(to: extent)
    }

    /// Isolate everything above the threshold, rescale it back to a full range,
    /// blur it, tint it, and screen it on top.
    private static func applyBloom(_ image: CIImage, _ stock: FilmStock, extent: CGRect) -> CIImage {
        let bloom = stock.bloom
        guard bloom.intensity > 0 else { return image }

        let gain = 1.0 / max(0.05, 1.0 - bloom.threshold)
        var highlights = image.clampedToExtent().applyingFilter("CIColorMatrix", parameters: [
            "inputRVector": CIVector(x: gain, y: 0, z: 0, w: 0),
            "inputGVector": CIVector(x: 0, y: gain, z: 0, w: 0),
            "inputBVector": CIVector(x: 0, y: 0, z: gain, w: 0),
            "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
            "inputBiasVector": CIVector(
                x: -bloom.threshold * gain,
                y: -bloom.threshold * gain,
                z: -bloom.threshold * gain,
                w: 0
            )
        ])

        highlights = highlights.applyingFilter("CIColorClamp", parameters: [
            "inputMinComponents": CIVector(x: 0, y: 0, z: 0, w: 0),
            "inputMaxComponents": CIVector(x: 1, y: 1, z: 1, w: 1)
        ])

        let radius = max(0.1, bloom.radius * Double(extent.width))
        highlights = highlights.applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: radius])

        let strength = bloom.intensity
        highlights = highlights
            .applyingFilter("CIColorMatrix", parameters: [
                "inputRVector": CIVector(x: bloom.tint.r * strength, y: 0, z: 0, w: 0),
                "inputGVector": CIVector(x: 0, y: bloom.tint.g * strength, z: 0, w: 0),
                "inputBVector": CIVector(x: 0, y: 0, z: bloom.tint.b * strength, w: 0),
                "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
                "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 0)
            ])
            .cropped(to: extent)

        return highlights
            .applyingFilter("CIScreenBlendMode", parameters: [kCIInputBackgroundImageKey: image])
            .cropped(to: extent)
    }

    /// Pull the red and blue records apart along `angle`, leave green where it
    /// is, and add the three back together.
    private static func applyChromaShift(_ image: CIImage, _ stock: FilmStock, extent: CGRect) -> CIImage {
        guard let shift = stock.chromaShift, shift.amount != 0 else { return image }
        let distance = shift.amount * Double(extent.width)
        let dx = cos(shift.angle) * distance
        let dy = sin(shift.angle) * distance
        let clamped = image.clampedToExtent()

        func channel(_ vector: CIVector, carriesAlpha: Bool) -> CIImage {
            clamped.applyingFilter("CIColorMatrix", parameters: [
                "inputRVector": CIVector(x: vector.x, y: 0, z: 0, w: 0),
                "inputGVector": CIVector(x: 0, y: vector.y, z: 0, w: 0),
                "inputBVector": CIVector(x: 0, y: 0, z: vector.z, w: 0),
                "inputAVector": CIVector(x: 0, y: 0, z: 0, w: carriesAlpha ? 1 : 0),
                "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 0)
            ])
        }

        let red = channel(CIVector(x: 1, y: 0, z: 0), carriesAlpha: false)
            .transformed(by: CGAffineTransform(translationX: dx, y: dy))
        let blue = channel(CIVector(x: 0, y: 0, z: 1), carriesAlpha: false)
            .transformed(by: CGAffineTransform(translationX: -dx, y: -dy))
        let green = channel(CIVector(x: 0, y: 1, z: 0), carriesAlpha: true)

        let redGreen = red.applyingFilter("CIAdditionCompositing", parameters: [
            kCIInputBackgroundImageKey: green
        ])
        return blue
            .applyingFilter("CIAdditionCompositing", parameters: [kCIInputBackgroundImageKey: redGreen])
            .cropped(to: extent)
    }

    private static func applyScanlines(_ image: CIImage, _ stock: FilmStock, extent: CGRect) -> CIImage {
        guard let lines = stock.scanlines, lines.darkness > 0 else { return image }
        let period = max(2.0, lines.spacing * Double(extent.height))
        let dark = max(0.0, 1.0 - lines.darkness)

        guard let generator = CIFilter(name: "CIStripesGenerator", parameters: [
            "inputCenter": CIVector(x: 0, y: 0),
            "inputColor0": CIColor(red: 1, green: 1, blue: 1, alpha: 1),
            "inputColor1": CIColor(red: dark, green: dark, blue: dark, alpha: 1),
            "inputWidth": period / 2.0,
            "inputSharpness": lines.sharpness
        ]), let stripes = generator.outputImage else { return image }

        // The generator varies along x; a quarter turn makes the lines horizontal.
        let horizontal = stripes.transformed(by: CGAffineTransform(rotationAngle: .pi / 2))
        return horizontal
            .applyingFilter("CIMultiplyBlendMode", parameters: [kCIInputBackgroundImageKey: image])
            .cropped(to: extent)
    }

    /// Grain is applied as soft light over a noise field centred on 50% grey,
    /// which keeps every value positive (no reliance on signed intermediates)
    /// and gives the natural roll-off film has: strongest through the mid-tones,
    /// quieter in the deepest blacks and blown highlights.
    ///
    /// Peak deviation lands near `0.5 * intensity` at mid grey.
    private static func applyGrain(_ image: CIImage, _ stock: FilmStock, seed: UInt64, extent: CGRect) -> CIImage {
        let grain = stock.grain
        guard grain.intensity > 0 else { return image }

        guard let generator = CIFilter(name: "CIRandomGenerator"),
              let raw = generator.outputImage else { return image }

        let offset = noiseOffset(for: seed)
        var noise = raw.transformed(by: CGAffineTransform(translationX: offset.x, y: offset.y))

        let cell = max(1.0, grain.size * Double(extent.width) / Double(referenceWidth))
        if cell > 1.0 {
            noise = noise.samplingNearest().transformed(by: CGAffineTransform(scaleX: cell, y: cell))
        }

        // Mix the four independent random channels down to `chroma` colour, then
        // scale the result around 0.5 by the amplitude.
        let amplitude = min(1.0, grain.intensity * 2.0)
        let chroma = min(1.0, max(0.0, grain.chroma))
        let shared = (1.0 - chroma) / 3.0
        let own = shared + chroma
        func column(_ index: Int) -> CIVector {
            CIVector(
                x: (index == 0 ? own : shared) * amplitude,
                y: (index == 1 ? own : shared) * amplitude,
                z: (index == 2 ? own : shared) * amplitude,
                w: 0
            )
        }
        let centre = 0.5 * (1.0 - amplitude)
        let field = noise.applyingFilter("CIColorMatrix", parameters: [
            "inputRVector": column(0),
            "inputGVector": column(1),
            "inputBVector": column(2),
            "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0),
            "inputBiasVector": CIVector(x: centre, y: centre, z: centre, w: 1)
        ]).cropped(to: extent)

        let grained = field
            .applyingFilter("CISoftLightBlendMode", parameters: [kCIInputBackgroundImageKey: image])
            .cropped(to: extent)

        guard grain.shadowBias > 0 else { return grained }

        // Mask carries `1 - shadowBias * luma` in both colour and alpha, so
        // `CIBlendWithMask` (which reads alpha) keeps grain in the shadows.
        let bias = min(1.0, grain.shadowBias)
        func maskColumn(_ weight: Double) -> CIVector {
            let value = -bias * weight
            return CIVector(x: value, y: value, z: value, w: value)
        }
        let mask = image.applyingFilter("CIColorMatrix", parameters: [
            "inputRVector": maskColumn(0.2126),
            "inputGVector": maskColumn(0.7152),
            "inputBVector": maskColumn(0.0722),
            "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0),
            "inputBiasVector": CIVector(x: 1, y: 1, z: 1, w: 1)
        ])

        return grained.applyingFilter("CIBlendWithMask", parameters: [
            kCIInputBackgroundImageKey: image,
            kCIInputMaskImageKey: mask
        ]).cropped(to: extent)
    }

    private static func applyVignette(_ image: CIImage, _ stock: FilmStock, extent: CGRect) -> CIImage {
        let vignette = stock.vignette
        guard vignette.intensity > 0 else { return image }

        let halfDiagonal = sqrt(Double(extent.width * extent.width + extent.height * extent.height)) / 2.0
        let corner = max(0.0, 1.0 - vignette.intensity)
        guard let generator = CIFilter(name: "CIRadialGradient", parameters: [
            "inputCenter": CIVector(x: extent.midX, y: extent.midY),
            "inputRadius0": max(0.0, vignette.innerRadius) * halfDiagonal,
            "inputRadius1": max(0.01, vignette.outerRadius) * halfDiagonal,
            "inputColor0": CIColor(red: 1, green: 1, blue: 1, alpha: 1),
            "inputColor1": CIColor(red: corner, green: corner, blue: corner, alpha: 1)
        ]), let gradient = generator.outputImage else { return image }

        return gradient
            .applyingFilter("CIMultiplyBlendMode", parameters: [kCIInputBackgroundImageKey: image])
            .cropped(to: extent)
    }

    /// Burns the camera-back date into the bottom right, with a soft glow
    /// underneath so it reads as light through the negative rather than as a
    /// sticker on top.
    private static func applyDateStamp(_ image: CIImage, _ stock: FilmStock, text: String?, extent: CGRect) -> CIImage {
        guard let style = stock.dateStamp,
              let text, !text.isEmpty else { return image }

        guard let generator = CIFilter(name: "CITextImageGenerator", parameters: [
            "inputText": text,
            "inputFontName": style.fontName,
            "inputFontSize": 64.0,
            "inputScaleFactor": 1.0
        ]), let rendered = generator.outputImage,
            !rendered.extent.isInfinite,
            !rendered.extent.isNull,
            rendered.extent.height > 1 else { return image }

        // White premultiplied text, so red already carries alpha: one matrix
        // paints it and leaves the coverage untouched.
        let tinted = rendered.applyingFilter("CIColorMatrix", parameters: [
            "inputRVector": CIVector(x: style.color.r, y: style.color.g, z: style.color.b, w: 0),
            "inputGVector": CIVector(x: 0, y: 0, z: 0, w: 0),
            "inputBVector": CIVector(x: 0, y: 0, z: 0, w: 0),
            "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
            "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 0)
        ])

        let targetHeight = max(1.0, style.height * Double(extent.height))
        let scale = targetHeight / Double(rendered.extent.height)
        let scaled = tinted.transformed(by: CGAffineTransform(scaleX: scale, y: scale))

        let margin = style.margin * Double(extent.width)
        let dx = Double(extent.maxX) - margin - Double(scaled.extent.maxX)
        let dy = Double(extent.minY) + margin - Double(scaled.extent.minY)
        let placed = scaled.transformed(by: CGAffineTransform(translationX: dx, y: dy))

        var output = image
        if style.glow > 0 {
            let glow = placed
                .clampedToExtent()
                .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: targetHeight * 0.4])
                .cropped(to: placed.extent.insetBy(dx: -targetHeight, dy: -targetHeight))
                .applyingFilter("CIColorMatrix", parameters: [
                    "inputRVector": CIVector(x: style.glow, y: 0, z: 0, w: 0),
                    "inputGVector": CIVector(x: 0, y: style.glow, z: 0, w: 0),
                    "inputBVector": CIVector(x: 0, y: 0, z: style.glow, w: 0),
                    "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0),
                    "inputBiasVector": CIVector(x: 0, y: 0, z: 0, w: 0)
                ])
            output = glow
                .applyingFilter("CIAdditionCompositing", parameters: [kCIInputBackgroundImageKey: output])
                .cropped(to: extent)
        }

        return placed
            .applyingFilter("CISourceOverCompositing", parameters: [kCIInputBackgroundImageKey: output])
            .cropped(to: extent)
    }

    // MARK: - Seeding

    /// Grain is a fixed noise field read from a seed-derived position, so the
    /// same seed always lands on the same grains. Splitmix64, one constant,
    /// no dependency on `Hasher` (which is randomly salted per process).
    static func noiseOffset(for seed: UInt64) -> CGPoint {
        var state = seed &+ 0x9E3779B97F4A7C15
        func next() -> UInt64 {
            state &+= 0x9E3779B97F4A7C15
            var z = state
            z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
            z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
            return z ^ (z >> 31)
        }
        let x = Double(next() % 8192)
        let y = Double(next() % 8192)
        return CGPoint(x: x, y: y)
    }
}
