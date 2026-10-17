import SwiftUI

/// The camera body: dark, matte, one warm accent.
enum Theme {
    static let background = Color(red: 0.055, green: 0.055, blue: 0.06)
    static let panel = Color(red: 0.11, green: 0.11, blue: 0.12)
    static let panelRaised = Color(red: 0.16, green: 0.16, blue: 0.17)
    static let accent = Color(red: 1.0, green: 0.48, blue: 0.19)
    static let text = Color(white: 0.96)
    static let dimText = Color(white: 0.58)

    static let tileWidth: CGFloat = 84
    static let tileHeight: CGFloat = 92
    static let tileSpacing: CGFloat = 12

    static func label(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }

    static func mono(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }
}
