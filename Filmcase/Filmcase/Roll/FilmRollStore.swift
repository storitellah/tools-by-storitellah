import CoreImage
import Foundation
import UIKit

/// The film roll: JPEGs in the app's own container plus a small JSON index.
///
/// Nothing leaves the device. There is no account, no sync and no network code
/// in this type or anywhere else in the app.
@MainActor
final class FilmRollStore: ObservableObject {

    static let shared = FilmRollStore()

    @Published private(set) var items: [RollItem] = []

    private let directory: URL
    private let indexURL: URL
    private let ioQueue = DispatchQueue(label: "com.storitellah.filmcase.roll-io")

    init(directory: URL? = nil) {
        let base = directory ?? FilmRollStore.defaultDirectory()
        self.directory = base
        self.indexURL = base.appendingPathComponent("roll.json")
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        load()
    }

    private static func defaultDirectory() -> URL {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return support.appendingPathComponent("FilmRoll", isDirectory: true)
    }

    // MARK: Paths

    func imageURL(for item: RollItem) -> URL {
        directory.appendingPathComponent(item.fileName)
    }

    func thumbnailURL(for item: RollItem) -> URL {
        directory.appendingPathComponent(item.thumbnailName)
    }

    func thumbnail(for item: RollItem) -> UIImage? {
        UIImage(contentsOfFile: thumbnailURL(for: item).path)
    }

    func fullImage(for item: RollItem) -> UIImage? {
        UIImage(contentsOfFile: imageURL(for: item).path)
    }

    // MARK: Mutation

    @discardableResult
    func add(fullJPEG: Data, thumbnailJPEG: Data, stock: FilmStock, seed: UInt64, origin: RollItem.Origin) -> RollItem? {
        let id = UUID()
        let item = RollItem(
            id: id,
            createdAt: Date(),
            stockID: stock.id,
            stockName: stock.name,
            fileName: "\(id.uuidString).jpg",
            thumbnailName: "\(id.uuidString)-thumb.jpg",
            seed: seed,
            origin: origin
        )
        do {
            try fullJPEG.write(to: imageURL(for: item), options: .atomic)
            try thumbnailJPEG.write(to: thumbnailURL(for: item), options: .atomic)
        } catch {
            return nil
        }
        items.insert(item, at: 0)
        persistIndex()
        return item
    }

    func delete(_ item: RollItem) {
        items.removeAll { $0.id == item.id }
        let full = imageURL(for: item)
        let thumb = thumbnailURL(for: item)
        ioQueue.async {
            try? FileManager.default.removeItem(at: full)
            try? FileManager.default.removeItem(at: thumb)
        }
        persistIndex()
    }

    // MARK: Index

    private func load() {
        guard let data = try? Data(contentsOf: indexURL) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let decoded = try? decoder.decode([RollItem].self, from: data) else { return }
        // Drop entries whose pixels went missing (app reinstall, manual cleanup).
        items = decoded.filter { FileManager.default.fileExists(atPath: imageURL(for: $0).path) }
    }

    private func persistIndex() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(items) else { return }
        let url = indexURL
        ioQueue.async {
            try? data.write(to: url, options: .atomic)
        }
    }
}
