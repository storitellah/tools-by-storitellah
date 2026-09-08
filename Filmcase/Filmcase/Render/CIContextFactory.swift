import CoreGraphics
import CoreImage
import Metal

/// Builds the Core Image contexts the app renders through.
///
/// The working colour space is pinned to sRGB rather than Core Image's default
/// linear space. Tone curves, lifts and channel bias are authored the way a
/// colourist reads them — as moves on display-referred values — and pinning the
/// space is also what makes two renders of the same frame bit-identical.
enum CIContextFactory {

    static let workingColorSpace: CGColorSpace =
        CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()

    static let outputColorSpace: CGColorSpace = workingColorSpace

    private static let options: [CIContextOption: Any] = [
        .workingColorSpace: workingColorSpace,
        .outputColorSpace: outputColorSpace,
        .highQualityDownsample: true
    ]

    /// Metal-backed context, used for the viewfinder and for capture.
    /// Falls back to the default context on the simulator or if no device
    /// is available.
    static func makeMetalBacked(device: MTLDevice? = MTLCreateSystemDefaultDevice()) -> CIContext {
        if let device {
            return CIContext(mtlDevice: device, options: options)
        }
        return CIContext(options: options)
    }

    /// CPU context. Slower, but identical on every machine — handy for tests.
    static func makeSoftware() -> CIContext {
        var softwareOptions = options
        softwareOptions[.useSoftwareRenderer] = true
        return CIContext(options: softwareOptions)
    }
}
