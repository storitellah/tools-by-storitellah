import Photos
import UIKit

/// Writes a developed frame out to the system photo library.
/// Add-only authorisation, so the app never gains read access to the library
/// it does not need — imports come through the picker instead.
enum PhotoSaver {

    enum Outcome: Equatable {
        case saved
        case denied
        case failed(String)
    }

    static func save(fileURL: URL, completion: @escaping (Outcome) -> Void) {
        Permissions.requestPhotoLibraryAdd { state in
            guard state == .authorized else {
                completion(state == .undetermined ? .failed("Could not ask for permission") : .denied)
                return
            }
            PHPhotoLibrary.shared().performChanges {
                let request = PHAssetCreationRequest.forAsset()
                request.addResource(with: .photo, fileURL: fileURL, options: nil)
            } completionHandler: { success, error in
                DispatchQueue.main.async {
                    if success {
                        completion(.saved)
                    } else {
                        completion(.failed(error?.localizedDescription ?? "Save failed"))
                    }
                }
            }
        }
    }
}
