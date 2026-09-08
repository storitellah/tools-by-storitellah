import MetalKit
import SwiftUI

/// The viewfinder. Its contents are the developed frame and nothing else —
/// there is no preview layer underneath and no overlay on top.
@MainActor
struct CameraPreviewView: UIViewRepresentable {

    let renderer: PreviewRenderer?

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView(frame: .zero, device: renderer?.device)
        view.delegate = renderer
        view.framebufferOnly = false
        view.colorPixelFormat = .bgra8Unorm
        view.autoResizeDrawable = true
        view.enableSetNeedsDisplay = false
        view.isPaused = false
        view.preferredFramesPerSecond = 60
        view.backgroundColor = .black
        view.isOpaque = true
        view.clearColor = MTLClearColorMake(0, 0, 0, 1)
        view.isUserInteractionEnabled = false
        return view
    }

    func updateUIView(_ uiView: MTKView, context: Context) {}
}
