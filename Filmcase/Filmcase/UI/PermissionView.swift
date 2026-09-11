import SwiftUI

/// Shown when camera access is off. The rest of the app still works — you can
/// develop photos you already have — so this screen offers that as well as the
/// shortcut into Settings.
@MainActor
struct PermissionView: View {

    let state: Permissions.State
    @ObservedObject var roll: FilmRollStore

    @State private var showImport = false
    @State private var showRoll = false

    var body: some View {
        VStack(spacing: 22) {
            Spacer()

            Image(systemName: "camera.metering.unknown")
                .font(.system(size: 52, weight: .light))
                .foregroundStyle(Theme.dimText)

            VStack(spacing: 10) {
                Text(title)
                    .font(Theme.label(21, weight: .bold))
                    .foregroundStyle(Theme.text)
                Text(message)
                    .font(Theme.label(14, weight: .regular))
                    .foregroundStyle(Theme.dimText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 34)
            }

            if state == .denied {
                Button {
                    Permissions.openSettings()
                } label: {
                    Text("Open Settings")
                        .font(Theme.label(16, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Theme.accent, in: Capsule())
                        .foregroundStyle(.black)
                }
                .padding(.horizontal, 44)
            }

            Spacer()

            VStack(spacing: 12) {
                Text("You can still develop photos you already have.")
                    .font(Theme.label(12, weight: .regular))
                    .foregroundStyle(Theme.dimText)

                HStack(spacing: 12) {
                    Button("Import a photo") { showImport = true }
                        .buttonStyle(SecondaryButtonStyle())
                    Button("Film roll") { showRoll = true }
                        .buttonStyle(SecondaryButtonStyle())
                }
            }
            .padding(.bottom, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background.ignoresSafeArea())
        .sheet(isPresented: $showImport) {
            ImportDevelopView(roll: roll, initialStockID: FilmStockLibrary.default.id)
        }
        .sheet(isPresented: $showRoll) {
            FilmRollView(roll: roll)
        }
    }

    private var title: String {
        state == .restricted ? "Camera unavailable" : "Camera access is off"
    }

    private var message: String {
        switch state {
        case .restricted:
            return "This device does not allow camera access, so the viewfinder is unavailable."
        default:
            return "Filmcase develops every frame on device — it needs the camera to show you a viewfinder. Turn it on in Settings › Filmcase › Camera."
        }
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.label(14, weight: .semibold))
            .padding(.horizontal, 18)
            .padding(.vertical, 11)
            .background(Theme.panelRaised, in: Capsule())
            .foregroundStyle(Theme.text)
            .opacity(configuration.isPressed ? 0.65 : 1)
    }
}
