import AVFoundation
import CoreImage
import CoreMedia
import CoreVideo
import Foundation
import UIKit

/// Owns the capture session and feeds every frame through `FilmPipeline`.
///
/// Two outputs hang off one session: a video data output that drives the live
/// viewfinder, and a photo output that fires at the sensor's full still
/// resolution. Both land in the same pipeline, so what the shutter records is
/// what the viewfinder showed.
final class CameraController: NSObject, ObservableObject {

    // MARK: Published state

    @Published private(set) var accessState: Permissions.State = Permissions.camera
    @Published private(set) var isSessionRunning = false
    @Published private(set) var isCapturing = false
    @Published private(set) var lastError: String?
    @Published private(set) var flashAvailable = false
    @Published var cameraPosition: AVCaptureDevice.Position = .back
    @Published var flashMode: AVCaptureDevice.FlashMode = .off

    @Published var selectedStock: FilmStock = FilmStockLibrary.default {
        didSet { refreshActiveLook() }
    }

    let previewRenderer: PreviewRenderer?

    // MARK: Session

    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "com.storitellah.filmcase.session")
    private let videoQueue = DispatchQueue(label: "com.storitellah.filmcase.video", qos: .userInitiated)
    private let developQueue = DispatchQueue(label: "com.storitellah.filmcase.develop", qos: .userInitiated)
    private let videoOutput = AVCaptureVideoDataOutput()
    private let photoOutput = AVCapturePhotoOutput()
    private var videoDeviceInput: AVCaptureDeviceInput?
    private var isConfigured = false

    /// Read on the video queue every frame, written on the main thread.
    private let stateLock = NSLock()
    private var activeStock = FilmStockLibrary.default
    private var activeStampText: String?
    private var frameIndex: UInt64 = 0

    /// Longest edge the live pipeline will develop, in pixels.
    private static let previewMaxDimension: CGFloat = 1440

    /// Photo delegate callbacks are not guaranteed on the session queue, so the
    /// in-flight table gets its own lock.
    private let capturesLock = NSLock()
    private var pendingCaptures: [Int64: CaptureRequest] = [:]

    private struct CaptureRequest {
        let stock: FilmStock
        let seed: UInt64
        let stampText: String?
        let completion: (CapturedFrame?) -> Void
    }

    /// A developed still, ready for the film roll.
    struct CapturedFrame {
        let fullJPEG: Data
        let thumbnailJPEG: Data
        let stock: FilmStock
        let seed: UInt64
    }

    // MARK: Init

    override init() {
        self.previewRenderer = PreviewRenderer()
        super.init()
        refreshActiveLook()
    }

    // MARK: Lifecycle

    func start() {
        Permissions.requestCamera { [weak self] state in
            guard let self else { return }
            self.accessState = state
            guard state == .authorized else {
                self.previewRenderer?.clear()
                return
            }
            self.sessionQueue.async {
                if !self.isConfigured {
                    self.configureSession()
                }
                guard self.isConfigured, !self.session.isRunning else { return }
                self.session.startRunning()
                let running = self.session.isRunning
                DispatchQueue.main.async { self.isSessionRunning = running }
            }
        }
    }

    func stop() {
        sessionQueue.async {
            guard self.session.isRunning else { return }
            self.session.stopRunning()
            DispatchQueue.main.async { self.isSessionRunning = false }
        }
    }

    func refreshAccessState() {
        accessState = Permissions.camera
    }

    // MARK: Configuration

    private func configureSession() {
        session.beginConfiguration()
        session.sessionPreset = .photo

        guard let device = Self.device(for: cameraPosition),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else {
            session.commitConfiguration()
            DispatchQueue.main.async { self.lastError = "No usable camera on this device." }
            return
        }
        session.addInput(input)
        videoDeviceInput = input

        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.setSampleBufferDelegate(self, queue: videoQueue)
        if session.canAddOutput(videoOutput) {
            session.addOutput(videoOutput)
        }

        if session.canAddOutput(photoOutput) {
            session.addOutput(photoOutput)
        }
        photoOutput.maxPhotoQualityPrioritization = .quality
        applyMaxPhotoDimensions(for: device)

        session.commitConfiguration()
        configureConnections()
        isConfigured = true

        let hasFlash = device.isFlashAvailable
        DispatchQueue.main.async { self.flashAvailable = hasFlash }
    }

    /// Ask the photo output for everything the sensor can give in stills mode.
    private func applyMaxPhotoDimensions(for device: AVCaptureDevice) {
        let dimensions = device.activeFormat.supportedMaxPhotoDimensions
        guard let largest = dimensions.max(by: { lhs, rhs in
            Int(lhs.width) * Int(lhs.height) < Int(rhs.width) * Int(rhs.height)
        }) else { return }
        photoOutput.maxPhotoDimensions = largest
    }

    /// Portrait-only app: the connection is pinned upright so the pipeline
    /// always receives a portrait frame and never has to reason about rotation.
    private func configureConnections() {
        let mirrored = cameraPosition == .front
        for connection in [videoOutput.connection(with: .video), photoOutput.connection(with: .video)] {
            guard let connection else { continue }
            if connection.isVideoRotationAngleSupported(90) {
                connection.videoRotationAngle = 90
            }
            if connection.isVideoMirroringSupported {
                connection.automaticallyAdjustsVideoMirroring = false
                connection.isVideoMirrored = mirrored
            }
        }
    }

    private static func device(for position: AVCaptureDevice.Position) -> AVCaptureDevice? {
        let discovery = AVCaptureDeviceDiscoverySession(
            deviceTypes: [.builtInWideAngleCamera],
            mediaType: .video,
            position: position
        )
        return discovery.devices.first
            ?? AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position)
    }

    // MARK: Controls

    func flipCamera() {
        let next: AVCaptureDevice.Position = cameraPosition == .back ? .front : .back
        cameraPosition = next
        sessionQueue.async {
            guard self.isConfigured,
                  let current = self.videoDeviceInput,
                  let device = Self.device(for: next),
                  let input = try? AVCaptureDeviceInput(device: device) else { return }
            self.session.beginConfiguration()
            self.session.removeInput(current)
            if self.session.canAddInput(input) {
                self.session.addInput(input)
                self.videoDeviceInput = input
            } else {
                self.session.addInput(current)
            }
            let active = self.videoDeviceInput?.device ?? device
            self.applyMaxPhotoDimensions(for: active)
            self.session.commitConfiguration()
            self.configureConnections()
            let hasFlash = active.isFlashAvailable
            DispatchQueue.main.async { self.flashAvailable = hasFlash }
        }
    }

    func cycleFlashMode() {
        switch flashMode {
        case .off: flashMode = .auto
        case .auto: flashMode = .on
        case .on: flashMode = .off
        @unknown default: flashMode = .off
        }
    }

    // MARK: The look

    /// Copies the selected stock somewhere the video queue can read it without
    /// touching published state, and refreshes the date-stamp text.
    private func refreshActiveLook() {
        let stock = selectedStock
        let text = DateStampText.current(for: stock)
        stateLock.lock()
        activeStock = stock
        activeStampText = text
        stateLock.unlock()
    }

    // MARK: Capture

    func capturePhoto(completion: @escaping (CapturedFrame?) -> Void) {
        guard accessState == .authorized else {
            completion(nil)
            return
        }
        isCapturing = true

        stateLock.lock()
        let stock = activeStock
        let stampText = activeStampText
        stateLock.unlock()
        let seed = UInt64.random(in: 0...UInt64.max)
        let flash = flashMode

        sessionQueue.async {
            guard self.isConfigured else {
                DispatchQueue.main.async {
                    self.isCapturing = false
                    completion(nil)
                }
                return
            }

            let settings: AVCapturePhotoSettings
            if self.photoOutput.availablePhotoCodecTypes.contains(.jpeg) {
                settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
            } else {
                settings = AVCapturePhotoSettings()
            }
            settings.photoQualityPrioritization = .quality
            settings.maxPhotoDimensions = self.photoOutput.maxPhotoDimensions
            if self.photoOutput.supportedFlashModes.contains(flash) {
                settings.flashMode = flash
            }

            let request = CaptureRequest(
                stock: stock,
                seed: seed,
                stampText: stampText,
                completion: completion
            )
            self.capturesLock.lock()
            self.pendingCaptures[settings.uniqueID] = request
            self.capturesLock.unlock()
            self.photoOutput.capturePhoto(with: settings, delegate: self)
        }
    }
}

// MARK: - Live frames

extension CameraController: AVCaptureVideoDataOutputSampleBufferDelegate {

    func captureOutput(_ output: AVCaptureOutput,
                       didOutput sampleBuffer: CMSampleBuffer,
                       from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        stateLock.lock()
        let stock = activeStock
        let stampText = activeStampText
        frameIndex &+= 1
        let seed = frameIndex
        stateLock.unlock()

        // The viewfinder is at most a screen wide, so there is nothing to gain
        // from developing a frame larger than that — and quite a lot to lose,
        // since the whole chain runs per frame. Every stock parameter is a
        // fraction of the image (grain is quoted at a reference width), so the
        // capped preview and a full-resolution capture look the same.
        var source = CIImage(cvPixelBuffer: pixelBuffer)
        let longestEdge = max(source.extent.width, source.extent.height)
        if longestEdge > Self.previewMaxDimension {
            let scale = Self.previewMaxDimension / longestEdge
            source = source.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        }

        let developed = FilmPipeline.apply(to: source, stock: stock, seed: seed, stampText: stampText)
        previewRenderer?.present(developed)
    }
}

// MARK: - Stills

extension CameraController: AVCapturePhotoCaptureDelegate {

    func photoOutput(_ output: AVCapturePhotoOutput,
                     didFinishProcessingPhoto photo: AVCapturePhoto,
                     error: Error?) {
        capturesLock.lock()
        let pending = pendingCaptures.removeValue(forKey: photo.resolvedSettings.uniqueID)
        capturesLock.unlock()
        guard let request = pending else { return }

        let data = error == nil ? photo.fileDataRepresentation() : nil
        let failure = error?.localizedDescription

        // Developing a full-resolution still is not something to do on
        // AVFoundation's callback queue.
        developQueue.async {
            func finish(_ frame: CapturedFrame?, message: String? = nil) {
                DispatchQueue.main.async {
                    self.isCapturing = false
                    if let message { self.lastError = message }
                    request.completion(frame)
                }
            }

            guard let data,
                  let source = CIImage(data: data, options: [.applyOrientationProperty: true]) else {
                finish(nil, message: failure ?? "Capture failed")
                return
            }

            let renderer = FilmRenderer.shared
            guard let full = renderer.jpegData(
                from: source,
                stock: request.stock,
                seed: request.seed,
                stampText: request.stampText
            ) else {
                finish(nil, message: "Could not develop the frame")
                return
            }

            let preview = FilmRenderer.downscaled(source, maxDimension: 512)
            let thumbnail = renderer.jpegData(
                from: preview,
                stock: request.stock,
                seed: request.seed,
                stampText: request.stampText,
                quality: 0.8
            ) ?? full

            finish(CapturedFrame(
                fullJPEG: full,
                thumbnailJPEG: thumbnail,
                stock: request.stock,
                seed: request.seed
            ))
        }
    }
}
