import UIKit

/// Thin wrapper so the camera UI can ask for feedback without keeping
/// generators alive all over the place.
@MainActor
enum Haptics {

    private static let selectionGenerator = UISelectionFeedbackGenerator()
    private static let notificationGenerator = UINotificationFeedbackGenerator()

    static func prepare() {
        selectionGenerator.prepare()
        notificationGenerator.prepare()
    }

    /// Ratchet between cameras on the carousel.
    static func selection() {
        selectionGenerator.selectionChanged()
        selectionGenerator.prepare()
    }

    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle, intensity: CGFloat = 1.0) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()
        generator.impactOccurred(intensity: intensity)
    }

    static func shutter() {
        impact(.rigid, intensity: 1.0)
    }

    static func success() {
        notificationGenerator.notificationOccurred(.success)
        notificationGenerator.prepare()
    }

    static func warning() {
        notificationGenerator.notificationOccurred(.warning)
        notificationGenerator.prepare()
    }
}
