import SwiftUI

@MainActor
struct RootView: View {

    @StateObject private var camera = CameraController()
    @StateObject private var roll = FilmRollStore.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            switch camera.accessState {
            case .authorized:
                CameraScreen(camera: camera, roll: roll)
            case .undetermined:
                ProgressView()
                    .tint(Theme.accent)
            case .denied, .restricted:
                PermissionView(state: camera.accessState, roll: roll)
            }
        }
        .preferredColorScheme(.dark)
        .statusBarHidden(true)
        .onAppear { camera.start() }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                camera.refreshAccessState()
                camera.start()
            case .background, .inactive:
                camera.stop()
            @unknown default:
                break
            }
        }
    }
}
