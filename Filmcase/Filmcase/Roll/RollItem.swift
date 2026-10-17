import Foundation

/// One developed frame on the in-app film roll.
/// Pixels live on disk; this is only the index entry.
struct RollItem: Identifiable, Codable, Hashable {
    var id: UUID
    var createdAt: Date
    var stockID: String
    var stockName: String
    var fileName: String
    var thumbnailName: String
    /// The grain seed the frame was developed with, kept so a frame could be
    /// reproduced exactly from its original later.
    var seed: UInt64
    var origin: Origin

    enum Origin: String, Codable {
        case camera
        case imported
    }
}
