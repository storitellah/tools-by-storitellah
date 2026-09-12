import AVFoundation
import Photos
import UIKit

/// Everything the app is allowed to ask for, in one place.
/// Nothing here talks to the network — the only permissions Filmcase uses are
/// the camera and add-only access to the photo library.
enum Permissions {

    enum State: Equatable {
        case undetermined
        case authorized
        case denied
        case restricted
    }

    // MARK: Camera

    static var camera: State {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: return .authorized
        case .notDetermined: return .undetermined
        case .restricted: return .restricted
        case .denied: return .denied
        @unknown default: return .denied
        }
    }

    static func requestCamera(_ completion: @escaping (State) -> Void) {
        guard camera == .undetermined else {
            completion(camera)
            return
        }
        AVCaptureDevice.requestAccess(for: .video) { _ in
            DispatchQueue.main.async { completion(camera) }
        }
    }

    // MARK: Photo library (add only)

    static var photoLibraryAdd: State {
        switch PHPhotoLibrary.authorizationStatus(for: .addOnly) {
        case .authorized, .limited: return .authorized
        case .notDetermined: return .undetermined
        case .restricted: return .restricted
        case .denied: return .denied
        @unknown default: return .denied
        }
    }

    static func requestPhotoLibraryAdd(_ completion: @escaping (State) -> Void) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { _ in
            DispatchQueue.main.async { completion(photoLibraryAdd) }
        }
    }

    // MARK: Settings shortcut

    @MainActor
    static func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString),
              UIApplication.shared.canOpenURL(url) else { return }
        UIApplication.shared.open(url)
    }
}
