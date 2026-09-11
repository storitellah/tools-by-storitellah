import CoreImage
import XCTest
@testable import Filmcase

/// The pipeline has to be reproducible: the same frame, stock and seed must
/// develop to the same pixels every time, or a capture would not match the
/// viewfinder it was framed in and the film roll could not be trusted.
///
/// Everything runs through the software renderer so the result depends on the
/// pipeline rather than on whichever GPU happens to be in the machine.
final class FilmPipelineDeterminismTests: XCTestCase {

    private var renderer: FilmRenderer!

    override func setUp() {
        super.setUp()
        renderer = FilmRenderer(context: CIContextFactory.makeSoftware())
    }

    override func tearDown() {
        renderer = nil
        super.tearDown()
    }

    // MARK: The fixed image

    /// A fixed, code-generated test chart: a horizontal luminance ramp crossed
    /// with vertical colour bars, plus a hard highlight block so bloom and the
    /// tone curve's shoulder have something to bite on. No asset files, so the
    /// input is identical on every machine.
    private static func fixtureImage(width: Int = 192, height: Int = 256) -> CIImage {
        var bytes = [UInt8](repeating: 0, count: width * height * 4)
        for y in 0..<height {
            for x in 0..<width {
                let ramp = Double(x) / Double(width - 1)
                let band = (y * 6) / height
                var r = ramp
                var g = ramp
                var b = ramp
                switch band {
                case 0: break
                case 1: g *= 0.35; b *= 0.35
                case 2: r *= 0.35; b *= 0.35
                case 3: r *= 0.35; g *= 0.35
                case 4: r = min(1, r * 1.4); g *= 0.8; b *= 0.5
                default: r = 1; g = 1; b = 1
                }
                let offset = (y * width + x) * 4
                bytes[offset] = UInt8((r * 255).rounded())
                bytes[offset + 1] = UInt8((g * 255).rounded())
                bytes[offset + 2] = UInt8((b * 255).rounded())
                bytes[offset + 3] = 255
            }
        }
        return CIImage(
            bitmapData: Data(bytes),
            bytesPerRow: width * 4,
            size: CGSize(width: width, height: height),
            format: .RGBA8,
            colorSpace: CIContextFactory.workingColorSpace
        )
    }

    private func develop(_ stock: FilmStock,
                         seed: UInt64 = 7,
                         stampText: String? = "'26 09 08",
                         size: (width: Int, height: Int) = (192, 256),
                         renderer: FilmRenderer? = nil) throws -> Data {
        let target = renderer ?? self.renderer!
        let data = target.bitmap(
            from: Self.fixtureImage(width: size.width, height: size.height),
            stock: stock,
            seed: seed,
            stampText: stampText
        )
        return try XCTUnwrap(data, "the pipeline produced no pixels for \(stock.id)")
    }

    // MARK: Tests

    /// The headline guarantee: one fixed image, one fixed stock, one fixed
    /// seed, rendered twice — byte for byte the same.
    func testFixedImageThroughFixedStockIsDeterministic() throws {
        let stock = FilmStockLibrary.vhs

        let first = try develop(stock)
        let second = try develop(stock)

        XCTAssertFalse(first.isEmpty)
        XCTAssertEqual(first, second, "two renders of the same frame through the same stock differed")
    }

    /// ...and still the same through a renderer that shares nothing with the
    /// first one, so the result cannot be coming from a cached intermediate.
    func testDeterministicAcrossFreshContexts() throws {
        let stock = FilmStockLibrary.expired

        let first = try develop(stock)
        let second = try develop(stock, renderer: FilmRenderer(context: CIContextFactory.makeSoftware()))

        XCTAssertEqual(first, second, "a second, independent context developed the frame differently")
    }

    /// Every shipped camera, not just the one that happens to be selected.
    func testEveryStockIsDeterministic() throws {
        for stock in FilmStockLibrary.all {
            let first = try develop(stock, seed: 99)
            let second = try develop(stock, seed: 99)
            XCTAssertEqual(first, second, "\(stock.id) was not reproducible")
        }
    }

    /// Determinism is only meaningful if the seed is actually doing something:
    /// a different seed has to move the grain.
    func testSeedChangesTheGrain() throws {
        let stock = FilmStockLibrary.noir
        XCTAssertGreaterThan(stock.grain.intensity, 0, "this test needs a stock with grain")

        let a = try develop(stock, seed: 1)
        let b = try develop(stock, seed: 2)

        XCTAssertNotEqual(a, b, "changing the seed left the grain in the same place")
    }

    /// The date stamp is burned in, so different text has to produce different
    /// pixels — and the stock that does not stamp must ignore the text entirely.
    func testDateStampIsBurnedInAndOnlyWhereItShould() throws {
        let stamped = FilmStockLibrary.vhs
        XCTAssertNotNil(stamped.dateStamp)

        // Big enough that a stamp sized as a fraction of the frame lands on a
        // comfortable number of pixels.
        let large = (width: 384, height: 512)
        let a = try develop(stamped, stampText: "'26 09 08", size: large)
        let b = try develop(stamped, stampText: "'99 12 31", size: large)
        XCTAssertNotEqual(a, b, "the date stamp did not reach the pixels")

        let plain = FilmStockLibrary.gold135
        XCTAssertNil(plain.dateStamp)
        let c = try develop(plain, stampText: "'26 09 08", size: large)
        let d = try develop(plain, stampText: nil, size: large)
        XCTAssertEqual(c, d, "a stock with no date stamp still changed with the text")
    }

    /// Each look has to actually be a different look.
    func testStocksProduceDistinctResults() throws {
        var seen: [Data: String] = [:]
        for stock in FilmStockLibrary.all {
            let data = try develop(stock, seed: 4)
            if let clash = seen[data] {
                XCTFail("\(stock.id) develops identically to \(clash)")
            }
            seen[data] = stock.id
        }
        XCTAssertEqual(seen.count, FilmStockLibrary.all.count)
    }

    /// And the pipeline has to be doing something at all — a look that came
    /// back byte-identical to its input would pass every test above.
    func testDevelopingChangesTheImage() throws {
        let source = Self.fixtureImage()
        let untouched = try XCTUnwrap(renderer.bitmap(
            from: source,
            stock: FilmStock(id: "identity", name: "Identity", caption: "", swatch: .one),
            seed: 0,
            stampText: nil
        ))
        let developed = try develop(FilmStockLibrary.instant)

        XCTAssertEqual(untouched.count, developed.count)
        XCTAssertNotEqual(untouched, developed)
    }

    /// The grain offset is plain integer arithmetic rather than `Hasher`, which
    /// is salted per process and would break reproducibility between launches.
    /// These values are pinned so a change to the mixer cannot slip through.
    func testGrainOffsetsArePinned() {
        XCTAssertEqual(FilmPipeline.noiseOffset(for: 0), CGPoint(x: 1524, y: 1359))
        XCTAssertEqual(FilmPipeline.noiseOffset(for: 1), CGPoint(x: 3175, y: 5470))
        XCTAssertEqual(FilmPipeline.noiseOffset(for: 12345), CGPoint(x: 6381, y: 4637))
        XCTAssertEqual(FilmPipeline.noiseOffset(for: .max), CGPoint(x: 713, y: 489))
    }
}
