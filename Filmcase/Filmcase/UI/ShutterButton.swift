import SwiftUI

/// Shutter release: the ring holds still, the disc drops and springs back.
@MainActor
struct ShutterButton: View {

    var isBusy: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .strokeBorder(Color.white.opacity(0.9), lineWidth: 4)
                    .frame(width: 76, height: 76)

                Circle()
                    .fill(isBusy ? Theme.accent.opacity(0.6) : Color.white)
                    .frame(width: 62, height: 62)

                if isBusy {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.black)
                }
            }
            .contentShape(Circle())
        }
        .buttonStyle(ShutterButtonStyle())
        .disabled(isBusy)
        .accessibilityLabel("Shutter")
    }
}

private struct ShutterButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.86 : 1.0)
            .animation(.spring(response: 0.22, dampingFraction: 0.55), value: configuration.isPressed)
    }
}
