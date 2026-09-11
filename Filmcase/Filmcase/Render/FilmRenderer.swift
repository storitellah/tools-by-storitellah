import CoreGraphics
import CoreImage
import Foundation
import ImageIO

/// Rasterises what `FilmPipeline` describes.
///
/// One renderer is shared by the viewfinder, the shutter and the develop
/// screen, so a capture goes through exactly the same code the preview did.
final class FilmRenderer {

    static let shared = FilmRenderer(context: CIContextFactory.makeMetalBacked())

    let context: CIContext

    init(context: CIContext) {
        self.context = context
    }

    /// The look, unrasterised — used by the live preview, which hands the
    /// result straight to Metal.
    func image(from input: CIImage, stock: FilmStock, seed: UInt64, stampText: String?) -> CIImage {
        FilmPipeline.apply(to: input, stock: stock, seed: seed, stampText: stampText)
    }

    func cgImage(from input: CIImage, stock: FilmStock, seed: UInt64, stampText: String?) -> CGImage? {
        let output = image(from: input, stock: stock, seed: seed, stampText: stampText)
        guard !output.extent.isInfinite, !output.extent.isEmpty else { return nil }
        return context.createCGImage(
            output,
            from: output.extent,
            format: .RGBA8,
            colorSpace: CIContextFactory.outputColorSpace
        )
    }

    func jpegData(from input: CIImage, stock: FilmStock, seed: UInt64, stampText: String?, quality: Double = 0.94) -> Data? {
        let output = image(from: input, stock: stock, seed: seed, stampText: stampText)
        guard !output.extent.isInfinite, !output.extent.isEmpty else { return nil }
        return context.jpegRepresentation(
            of: output.cropped(to: output.extent),
            colorSpace: CIContextFactory.outputColorSpace,
            options: [CIImageRepresentationOption(rawValue: kCGImageDestinationLossyCompressionQuality as String): quality]
        )
    }

    /// Raw pixels, for tests and for comparing two renders.
    func bitmap(from input: CIImage, stock: FilmStock, seed: UInt64, stampText: String?) -> Data? {
        let output = image(from: input, stock: stock, seed: seed, stampText: stampText)
        let extent = output.extent
        guard !extent.isInfinite, !extent.isEmpty else { return nil }
        let width = Int(extent.width.rounded())
        let height = Int(extent.height.rounded())
        let bytesPerRow = width * 4
        var bytes = [UInt8](repeating: 0, count: bytesPerRow * height)
        bytes.withUnsafeMutableBytes { buffer in
            guard let base = buffer.baseAddress else { return }
            context.render(
                output,
                toBitmap: base,
                rowBytes: bytesPerRow,
                bounds: CGRect(x: extent.origin.x, y: extent.origin.y, width: CGFloat(width), height: CGFloat(height)),
                format: .RGBA8,
                colorSpace: CIContextFactory.outputColorSpace
            )
        }
        return Data(bytes)
    }

    /// Fits an image inside `maxDimension` without changing its aspect.
    /// Used to keep develop-screen previews cheap.
    static func downscaled(_ image: CIImage, maxDimension: CGFloat) -> CIImage {
        let extent = image.extent
        guard !extent.isInfinite, extent.width > 0, extent.height > 0 else { return image }
        let longest = max(extent.width, extent.height)
        guard longest > maxDimension else { return image }
        let scale = maxDimension / longest
        return image
            .applyingFilter("CILanczosScaleTransform", parameters: [
                kCIInputScaleKey: scale,
                kCIInputAspectRatioKey: 1.0
            ])
            .transformed(by: CGAffineTransform(translationX: -extent.origin.x * scale, y: -extent.origin.y * scale))
    }
}
