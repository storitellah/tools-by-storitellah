import XCTest
@testable import Filmcase

/// A camera is data, so the library is checked like data.
final class FilmStockLibraryTests: XCTestCase {

    func testShipsNineCameras() {
        XCTAssertEqual(FilmStockLibrary.all.count, 9)
    }

    func testIdentifiersAreUniqueAndResolvable() {
        let ids = FilmStockLibrary.all.map(\.id)
        XCTAssertEqual(Set(ids).count, ids.count, "two cameras share an id")

        for stock in FilmStockLibrary.all {
            XCTAssertEqual(FilmStockLibrary.stock(id: stock.id), stock)
        }
        XCTAssertEqual(FilmStockLibrary.stock(id: "no-such-camera"), FilmStockLibrary.default)
    }

    func testEveryCameraIsPresentable() {
        for stock in FilmStockLibrary.all {
            XCTAssertFalse(stock.name.isEmpty, "\(stock.id) has no name")
            XCTAssertFalse(stock.caption.isEmpty, "\(stock.id) has no caption")
            XCTAssertGreaterThan(stock.resolutionScale, 0, "\(stock.id) would render nothing")
            XCTAssertGreaterThanOrEqual(stock.saturation, 0)
        }
    }

    func testOnlyTheTapeStockBurnsInADate() {
        let stamping = FilmStockLibrary.all.filter { $0.dateStamp != nil }
        XCTAssertEqual(stamping.map(\.id), ["vhs"])
    }

    func testStocksRoundTripThroughCoding() throws {
        let encoded = try JSONEncoder().encode(FilmStockLibrary.all)
        let decoded = try JSONDecoder().decode([FilmStock].self, from: encoded)
        XCTAssertEqual(decoded, FilmStockLibrary.all)
    }

    func testDateStampTextIsStableForAFixedDate() {
        let style = DateStampStyle()
        let date = Date(timeIntervalSince1970: 1_757_376_000) // 2025-09-09 00:00:00 UTC
        let utc = TimeZone(secondsFromGMT: 0)!

        XCTAssertEqual(DateStampText.text(for: style, date: date, timeZone: utc), "'25 09 09")

        var monthStyle = style
        monthStyle.format = .monthDayYear
        XCTAssertEqual(DateStampText.text(for: monthStyle, date: date, timeZone: utc), "SEP 09 2025")
    }
}
