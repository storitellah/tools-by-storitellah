import CoreImage
import PhotosUI
import SwiftUI
import UIKit

/// Import and develop: pick any photo from the library, preview it through
/// every camera in the app, keep the one you like.
///
/// The picker is `PhotosPicker`, which runs out of process, so the app never
/// asks for read access to the whole library.
@MainActor
struct ImportDevelopView: View {

    @ObservedObject var roll: FilmRollStore
    @Environment(\.dismiss) private var dismiss

    @State private var pickerItem: PhotosPickerItem?
    @State private var sourceImage: CIImage?
    @State private var previewSource: CIImage?
    @State private var developed: UIImage?
    @State private var stockID: String
    @State private var isWorking = false
    @State private var status: String?

    /// Fixed for the lifetime of the screen, so flipping between cameras does
    /// not reshuffle the grain under you.
    private let seed: UInt64 = 0x51_4D_46_49_4C_4D_00_01

    private static let renderQueue = DispatchQueue(label: "com.storitellah.filmcase.develop", qos: .userInitiated)

    init(roll: FilmRollStore, initialStockID: String) {
        _roll = ObservedObject(wrappedValue: roll)
        _stockID = State(initialValue: initialStockID)
    }

    private var stock: FilmStock { FilmStockLibrary.stock(id: stockID) }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                preview

                if sourceImage != nil {
                    Text(stock.caption)
                        .font(Theme.label(12))
                        .foregroundStyle(Theme.dimText)
                        .padding(.top, 12)

                    FilmCarousel(stocks: FilmStockLibrary.all, selectedID: $stockID)
                        .padding(.top, 10)

                    Button(action: save) {
                        Text(isWorking ? "Developing…" : "Save to film roll")
                            .font(Theme.label(16, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Theme.accent, in: Capsule())
                            .foregroundStyle(.black)
                    }
                    .disabled(isWorking)
                    .padding(.horizontal, 30)
                    .padding(.top, 14)
                    .padding(.bottom, 18)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("Develop")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                        .tint(Theme.dimText)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    PhotosPicker(selection: $pickerItem, matching: .images, photoLibrary: .shared()) {
                        Text(sourceImage == nil ? "Choose" : "Change")
                            .tint(Theme.accent)
                    }
                }
            }
            .onChange(of: pickerItem) { _, item in
                load(item)
            }
            .onChange(of: stockID) { _, _ in
                renderPreview()
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: Pieces

    private var preview: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Theme.panel)

            if let developed {
                Image(uiImage: developed)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "photo.on.rectangle.angled")
                        .font(.system(size: 40, weight: .light))
                        .foregroundStyle(Theme.dimText)
                    Text(status ?? "Pick a photo to develop")
                        .font(Theme.label(13))
                        .foregroundStyle(Theme.dimText)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 30)

                    PhotosPicker(selection: $pickerItem, matching: .images, photoLibrary: .shared()) {
                        Text("Choose photo")
                            .font(Theme.label(14, weight: .semibold))
                            .padding(.horizontal, 18)
                            .padding(.vertical, 10)
                            .background(Theme.panelRaised, in: Capsule())
                            .foregroundStyle(Theme.text)
                    }
                }
            }

            if isWorking && developed == nil {
                ProgressView().tint(Theme.accent)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .frame(maxHeight: .infinity)
    }

    // MARK: Work

    private func load(_ item: PhotosPickerItem?) {
        guard let item else { return }
        isWorking = true
        status = nil
        Task {
            let data = try? await item.loadTransferable(type: Data.self)
            guard let data,
                  let image = CIImage(data: data, options: [.applyOrientationProperty: true]),
                  !image.extent.isEmpty else {
                isWorking = false
                status = "That photo could not be read."
                Haptics.warning()
                return
            }
            sourceImage = image
            previewSource = FilmRenderer.downscaled(image, maxDimension: 1400)
            developed = nil
            renderPreview()
        }
    }

    private func renderPreview() {
        guard let previewSource else { return }
        let stock = self.stock
        let stampText = DateStampText.current(for: stock)
        let seed = self.seed
        isWorking = true
        Self.renderQueue.async {
            let cgImage = FilmRenderer.shared.cgImage(
                from: previewSource,
                stock: stock,
                seed: seed,
                stampText: stampText
            )
            Task { @MainActor in
                if let cgImage {
                    developed = UIImage(cgImage: cgImage)
                } else {
                    status = "Could not develop that photo."
                }
                isWorking = false
            }
        }
    }

    private func save() {
        guard let sourceImage else { return }
        let stock = self.stock
        let stampText = DateStampText.current(for: stock)
        let seed = self.seed
        isWorking = true
        Self.renderQueue.async {
            let renderer = FilmRenderer.shared
            let full = renderer.jpegData(from: sourceImage, stock: stock, seed: seed, stampText: stampText)
            let thumbnailSource = FilmRenderer.downscaled(sourceImage, maxDimension: 512)
            let thumbnail = renderer.jpegData(
                from: thumbnailSource,
                stock: stock,
                seed: seed,
                stampText: stampText,
                quality: 0.8
            )
            Task { @MainActor in
                isWorking = false
                guard let full, let thumbnail else {
                    status = "Develop failed."
                    Haptics.warning()
                    return
                }
                roll.add(
                    fullJPEG: full,
                    thumbnailJPEG: thumbnail,
                    stock: stock,
                    seed: seed,
                    origin: .imported
                )
                Haptics.success()
                dismiss()
            }
        }
    }
}
