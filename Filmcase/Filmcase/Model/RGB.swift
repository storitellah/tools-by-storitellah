import CoreImage
import SwiftUI

/// A plain linear triple used everywhere a film stock needs to describe a colour
/// (a tint, a lift, a gain). Kept deliberately dumb so a stock stays pure data.
struct RGB: Hashable, Codable {
    var r: Double
    var g: Double
    var b: Double

    init(_ r: Double, _ g: Double, _ b: Double) {
        self.r = r
        self.g = g
        self.b = b
    }

    static let zero = RGB(0, 0, 0)
    static let one = RGB(1, 1, 1)

    var ciVector: CIVector { CIVector(x: r, y: g, z: b, w: 0) }
    var ciColor: CIColor { CIColor(red: r, green: g, blue: b, alpha: 1, colorSpace: CIContextFactory.workingColorSpace) ?? .white }
    var color: Color { Color(red: r, green: g, blue: b) }

    func scaled(by f: Double) -> RGB { RGB(r * f, g * f, b * f) }
}
