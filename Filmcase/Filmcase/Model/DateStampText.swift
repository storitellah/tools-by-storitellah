import Foundation

/// Turns a `Date` into the string a camera back would burn into the corner.
///
/// The renderer never sees a `Date` — it is handed finished text — so a render
/// is a pure function of (image, stock, seed, text) and stays reproducible.
enum DateStampText {

    static func text(for style: DateStampStyle, date: Date, timeZone: TimeZone = .current) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        switch style.format {
        case .yyMMdd:
            formatter.dateFormat = "''yy MM dd"
        case .monthDayYear:
            formatter.dateFormat = "MMM dd yyyy"
        }
        return formatter.string(from: date).uppercased()
    }

    /// The text a stock wants right now, or `nil` if it does not stamp.
    static func current(for stock: FilmStock, date: Date = Date()) -> String? {
        guard let style = stock.dateStamp else { return nil }
        return text(for: style, date: date)
    }
}
