import CoreImage
import Metal
import MetalKit
import UIKit

/// Draws the developed frame straight into an `MTKView`.
///
/// The viewfinder is not a preview layer with a look painted over it: the
/// camera's pixel buffer goes through `FilmPipeline` and the result of that is
/// the only thing ever drawn. There is no `AVCaptureVideoPreviewLayer` anywhere
/// in this app.
final class PreviewRenderer: NSObject, MTKViewDelegate {

    let device: MTLDevice
    private let context: CIContext
    private let commandQueue: MTLCommandQueue
    private let lock = NSLock()
    private var pendingImage: CIImage?
    private var pendingID: UInt64 = 0
    private var drawnID: UInt64 = 0

    /// Frames actually handed to the GPU, useful when profiling the viewfinder.
    private(set) var drawnFrames: Int = 0

    init?(device: MTLDevice? = MTLCreateSystemDefaultDevice()) {
        guard let device, let queue = device.makeCommandQueue() else { return nil }
        self.device = device
        self.commandQueue = queue
        self.context = CIContextFactory.makeMetalBacked(device: device)
        super.init()
    }

    /// Hand over the next developed frame. Safe to call from the capture queue.
    func present(_ image: CIImage) {
        lock.lock()
        pendingImage = image
        pendingID &+= 1
        lock.unlock()
    }

    func clear() {
        lock.lock()
        pendingImage = nil
        pendingID &+= 1
        lock.unlock()
    }

    // MARK: MTKViewDelegate

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

    func draw(in view: MTKView) {
        lock.lock()
        let image = pendingImage
        let id = pendingID
        lock.unlock()

        // The view drives itself off the display link; if the camera has not
        // delivered a new frame since the last pass there is nothing to redraw.
        guard id != drawnID else { return }

        guard let image,
              let drawable = view.currentDrawable,
              let commandBuffer = commandQueue.makeCommandBuffer() else { return }

        let drawableSize = view.drawableSize
        guard drawableSize.width > 0, drawableSize.height > 0 else { return }

        let fitted = Self.aspectFill(image, in: drawableSize)

        let destination = CIRenderDestination(
            width: Int(drawableSize.width),
            height: Int(drawableSize.height),
            pixelFormat: view.colorPixelFormat,
            commandBuffer: commandBuffer,
            mtlTextureProvider: { drawable.texture }
        )
        destination.colorSpace = CIContextFactory.outputColorSpace

        do {
            _ = try context.startTask(
                toRender: fitted,
                from: CGRect(origin: .zero, size: drawableSize),
                to: destination,
                at: .zero
            )
        } catch {
            return
        }

        commandBuffer.present(drawable)
        commandBuffer.commit()
        drawnID = id
        drawnFrames += 1
    }

    /// Scales and centres so the frame fills the viewfinder without letterboxing.
    static func aspectFill(_ image: CIImage, in size: CGSize) -> CIImage {
        let extent = image.extent
        guard !extent.isInfinite, extent.width > 0, extent.height > 0 else { return image }
        let scale = max(size.width / extent.width, size.height / extent.height)
        let scaled = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let dx = (size.width - scaled.extent.width) / 2 - scaled.extent.origin.x
        let dy = (size.height - scaled.extent.height) / 2 - scaled.extent.origin.y
        return scaled.transformed(by: CGAffineTransform(translationX: dx, y: dy))
    }
}
