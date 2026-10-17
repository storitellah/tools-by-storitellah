import AVFoundation
import SwiftUI
import UIKit

/// The camera. Portrait only, one viewfinder, one dial, one shutter.
@MainActor
struct CameraScreen: View {

    @ObservedObject var camera: CameraController
    @ObservedObject var roll: FilmRollStore

    @AppStorage("selectedStockID") private var selectedStockID: String = FilmStockLibrary.default.id

    @State private var showRoll = false
    @State private var showImport = false
    @State private var shutterFlash = false

    private var stock: FilmStock { FilmStockLibrary.stock(id: selectedStockID) }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            viewfinder
            Spacer(minLength: 0)
            caption
            FilmCarousel(stocks: FilmStockLibrary.all, selectedID: $selectedStockID)
                .padding(.bottom, 10)
            controls
        }
        .background(Theme.background.ignoresSafeArea())
        .onAppear {
            Haptics.prepare()
            camera.selectedStock = stock
        }
        .onChange(of: selectedStockID) { _, _ in
            camera.selectedStock = stock
        }
        .sheet(isPresented: $showRoll) {
            FilmRollView(roll: roll)
        }
        .sheet(isPresented: $showImport) {
            ImportDevelopView(roll: roll, initialStockID: selectedStockID)
        }
    }

    // MARK: Pieces

    private var topBar: some View {
        HStack {
            Button(action: {
                camera.cycleFlashMode()
                Haptics.impact(.light, intensity: 0.7)
            }) {
                Label(flashTitle, systemImage: flashSymbol)
                    .labelStyle(.iconOnly)
                    .font(.system(size: 18, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .background(Theme.panel, in: Circle())
                    .foregroundStyle(camera.flashMode == .off ? Theme.dimText : Theme.accent)
            }
            .accessibilityLabel("Flash: \(flashTitle)")

            Spacer()

            Text("FILMCASE")
                .font(Theme.mono(13, weight: .bold))
                .tracking(4)
                .foregroundStyle(Theme.dimText)

            Spacer()

            Button(action: {
                camera.flipCamera()
                Haptics.impact(.medium, intensity: 0.8)
            }) {
                Image(systemName: "arrow.triangle.2.circlepath.camera")
                    .font(.system(size: 18, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .background(Theme.panel, in: Circle())
                    .foregroundStyle(Theme.text)
            }
            .accessibilityLabel("Flip camera")
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
    }

    private var viewfinder: some View {
        ZStack {
            CameraPreviewView(renderer: camera.previewRenderer)
                .aspectRatio(3.0 / 4.0, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
                )
                .overlay {
                    if shutterFlash {
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(Color.white)
                            .transition(.opacity)
                    }
                }
                .overlay(alignment: .topLeading) {
                    if !camera.isSessionRunning {
                        Text("Warming up…")
                            .font(Theme.mono(11))
                            .foregroundStyle(Theme.dimText)
                            .padding(12)
                    }
                }
        }
        .padding(.horizontal, 16)
        .accessibilityLabel("Viewfinder showing \(stock.name)")
    }

    private var caption: some View {
        VStack(spacing: 2) {
            Text(stock.name.uppercased())
                .font(Theme.label(15, weight: .bold))
                .foregroundStyle(Theme.text)
            Text(stock.caption)
                .font(Theme.label(12, weight: .regular))
                .foregroundStyle(Theme.dimText)
        }
        .padding(.vertical, 12)
        .animation(.easeInOut(duration: 0.2), value: selectedStockID)
    }

    private var controls: some View {
        HStack {
            rollButton
            Spacer()
            ShutterButton(isBusy: camera.isCapturing, action: capture)
            Spacer()
            importButton
        }
        .padding(.horizontal, 32)
        .padding(.bottom, 18)
    }

    private var rollButton: some View {
        Button {
            showRoll = true
            Haptics.impact(.light, intensity: 0.6)
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Theme.panelRaised)
                if let newest = roll.items.first, let image = roll.thumbnail(for: newest) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                    Image(systemName: "photo.stack")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Theme.dimText)
                }
            }
            .frame(width: 50, height: 50)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.15), lineWidth: 1)
            )
        }
        .accessibilityLabel("Film roll, \(roll.items.count) frames")
    }

    private var importButton: some View {
        Button {
            showImport = true
            Haptics.impact(.light, intensity: 0.6)
        } label: {
            Image(systemName: "square.and.arrow.down.on.square")
                .font(.system(size: 20, weight: .semibold))
                .frame(width: 50, height: 50)
                .background(Theme.panelRaised, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .foregroundStyle(Theme.text)
        }
        .accessibilityLabel("Import and develop a photo")
    }

    // MARK: Actions

    private func capture() {
        Haptics.shutter()
        withAnimation(.easeOut(duration: 0.06)) { shutterFlash = true }

        camera.capturePhoto { frame in
            withAnimation(.easeIn(duration: 0.22)) { shutterFlash = false }
            guard let frame else {
                Haptics.warning()
                return
            }
            roll.add(
                fullJPEG: frame.fullJPEG,
                thumbnailJPEG: frame.thumbnailJPEG,
                stock: frame.stock,
                seed: frame.seed,
                origin: .camera
            )
            Haptics.success()
        }
    }

    private var flashSymbol: String {
        switch camera.flashMode {
        case .off: return "bolt.slash"
        case .on: return "bolt.fill"
        case .auto: return "bolt.badge.a"
        @unknown default: return "bolt.slash"
        }
    }

    private var flashTitle: String {
        switch camera.flashMode {
        case .off: return "Off"
        case .on: return "On"
        case .auto: return "Auto"
        @unknown default: return "Off"
        }
    }
}
