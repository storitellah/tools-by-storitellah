import SwiftUI

/// The camera dial: a horizontal strip that snaps one camera at a time into the
/// centre, with a ratchet of haptic feedback as it passes each one.
@MainActor
struct FilmCarousel: View {

    let stocks: [FilmStock]
    @Binding var selectedID: String

    @State private var scrollID: String?

    var body: some View {
        GeometryReader { geometry in
            let inset = max(0, (geometry.size.width - Theme.tileWidth) / 2)

            ScrollView(.horizontal) {
                LazyHStack(spacing: Theme.tileSpacing) {
                    ForEach(stocks) { stock in
                        FilmTile(stock: stock, isSelected: stock.id == selectedID)
                            .id(stock.id)
                            .onTapGesture {
                                withAnimation(.snappy(duration: 0.28)) { scrollID = stock.id }
                            }
                    }
                }
                .scrollTargetLayout()
            }
            .safeAreaPadding(.horizontal, inset)
            .scrollTargetBehavior(.viewAligned)
            .scrollPosition(id: $scrollID, anchor: .center)
            .scrollIndicators(.hidden)
            .onAppear {
                if scrollID == nil { scrollID = selectedID }
            }
            .onChange(of: scrollID) { _, newValue in
                guard let newValue, newValue != selectedID else { return }
                selectedID = newValue
                Haptics.selection()
            }
            .onChange(of: selectedID) { _, newValue in
                guard scrollID != newValue else { return }
                withAnimation(.snappy(duration: 0.28)) { scrollID = newValue }
            }
        }
        .frame(height: Theme.tileHeight)
    }
}

/// One camera on the dial.
@MainActor
struct FilmTile: View {

    let stock: FilmStock
    let isSelected: Bool

    var body: some View {
        VStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [stock.swatch.color, stock.swatch.color.opacity(0.45)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(isSelected ? Theme.accent : Color.white.opacity(0.12), lineWidth: isSelected ? 2 : 1)
                )
                .overlay(alignment: .bottomLeading) {
                    Text(stock.id.prefix(2).uppercased())
                        .font(Theme.mono(10, weight: .bold))
                        .foregroundStyle(.black.opacity(0.55))
                        .padding(6)
                }
                .frame(width: Theme.tileWidth, height: Theme.tileWidth * 0.72)

            Text(stock.name)
                .font(Theme.label(11, weight: isSelected ? .bold : .medium))
                .foregroundStyle(isSelected ? Theme.text : Theme.dimText)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(width: Theme.tileWidth)
        }
        .scaleEffect(isSelected ? 1.0 : 0.9)
        .opacity(isSelected ? 1.0 : 0.72)
        .animation(.snappy(duration: 0.22), value: isSelected)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(stock.name)
        .accessibilityHint(stock.caption)
        .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
    }
}
