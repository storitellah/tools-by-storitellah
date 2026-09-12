import SwiftUI
import UIKit

/// The in-app film roll. Everything here is a file in the app's own container.
@MainActor
struct FilmRollView: View {

    @ObservedObject var roll: FilmRollStore
    @Environment(\.dismiss) private var dismiss
    @State private var selected: RollItem?

    private static let columns = [GridItem(.adaptive(minimum: 108), spacing: 3)]

    var body: some View {
        NavigationStack {
            Group {
                if roll.items.isEmpty {
                    empty
                } else {
                    grid
                }
            }
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("Film Roll")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .tint(Theme.accent)
                }
            }
            .sheet(item: $selected) { item in
                FrameDetailView(item: item, roll: roll)
            }
        }
        .preferredColorScheme(.dark)
    }

    private var empty: some View {
        VStack(spacing: 10) {
            Image(systemName: "film")
                .font(.system(size: 42, weight: .light))
                .foregroundStyle(Theme.dimText)
            Text("No frames yet")
                .font(Theme.label(17, weight: .semibold))
                .foregroundStyle(Theme.text)
            Text("Shoot something, or import a photo and develop it.")
                .font(Theme.label(13, weight: .regular))
                .foregroundStyle(Theme.dimText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var grid: some View {
        ScrollView {
            LazyVGrid(columns: Self.columns, spacing: 3) {
                ForEach(roll.items) { item in
                    Button {
                        selected = item
                    } label: {
                        ZStack(alignment: .bottomLeading) {
                            if let image = roll.thumbnail(for: item) {
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFill()
                            } else {
                                Theme.panel
                            }
                            Text(item.stockName)
                                .font(Theme.mono(9, weight: .bold))
                                .foregroundStyle(.white)
                                .padding(4)
                                .background(.black.opacity(0.45), in: Capsule())
                                .padding(5)
                        }
                        .frame(height: 140)
                        .clipped()
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button(role: .destructive) {
                            roll.delete(item)
                            Haptics.warning()
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            }
            .padding(3)
        }
    }
}

/// One frame, with the three things you can do with it.
@MainActor
struct FrameDetailView: View {

    let item: RollItem
    @ObservedObject var roll: FilmRollStore
    @Environment(\.dismiss) private var dismiss

    @State private var saveMessage: String?
    @State private var showDeleteConfirmation = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Spacer(minLength: 0)

                if let image = roll.fullImage(for: item) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .padding(.horizontal, 12)
                } else {
                    Text("This frame is missing from disk.")
                        .font(Theme.label(14))
                        .foregroundStyle(Theme.dimText)
                }

                Spacer(minLength: 0)

                VStack(spacing: 8) {
                    Text("\(item.stockName) · \(item.createdAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(Theme.mono(11))
                        .foregroundStyle(Theme.dimText)

                    if let saveMessage {
                        Text(saveMessage)
                            .font(Theme.label(12, weight: .semibold))
                            .foregroundStyle(Theme.accent)
                    }

                    HStack(spacing: 12) {
                        ShareLink(item: roll.imageURL(for: item)) {
                            actionLabel("Share", systemImage: "square.and.arrow.up")
                        }

                        Button {
                            saveToPhotos()
                        } label: {
                            actionLabel("Save", systemImage: "arrow.down.to.line")
                        }

                        Button(role: .destructive) {
                            showDeleteConfirmation = true
                        } label: {
                            actionLabel("Delete", systemImage: "trash")
                        }
                    }
                }
                .padding(.vertical, 18)
            }
            .frame(maxWidth: .infinity)
            .background(Theme.background.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .tint(Theme.accent)
                }
            }
            .confirmationDialog("Delete this frame?", isPresented: $showDeleteConfirmation, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    roll.delete(item)
                    Haptics.warning()
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            }
        }
        .preferredColorScheme(.dark)
    }

    private func actionLabel(_ title: String, systemImage: String) -> some View {
        VStack(spacing: 5) {
            Image(systemName: systemImage)
                .font(.system(size: 17, weight: .semibold))
            Text(title)
                .font(Theme.label(11, weight: .medium))
        }
        .frame(width: 78, height: 58)
        .background(Theme.panelRaised, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .foregroundStyle(Theme.text)
    }

    private func saveToPhotos() {
        PhotoSaver.save(fileURL: roll.imageURL(for: item)) { result in
            switch result {
            case .saved:
                saveMessage = "Saved to Photos"
                Haptics.success()
            case .denied:
                saveMessage = "Photos access is off — enable it in Settings"
                Haptics.warning()
            case .failed(let reason):
                saveMessage = reason
                Haptics.warning()
            }
        }
    }
}
