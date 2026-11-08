import SwiftUI
import WidgetKit

// Keep the WidgetKit entry strongly typed. The app writes its snapshot/timeline
// to the App Group through expo-widgets; this extension only reads the current
// values and lets WidgetKit request a fresh entry at the next Tokyo midnight.
private struct OpenHomeEntry: TimelineEntry {
  let date: Date
  let amountText: String
  let daysText: String
  let dogUri: String
}

private struct OpenHomeProvider: TimelineProvider {
  private func entry(at now: Date) -> OpenHomeEntry {
    let fallback = OpenHomeEntry(date: now, amountText: "¥—", daysText: "残り—日", dogUri: "")
    guard let group = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String,
          let defaults = UserDefaults(suiteName: group) else { return fallback }

    let key = "__expo_widgets_OpenHomeWidgetV2_timeline"
    let timeline = defaults.array(forKey: key) as? [[String: Any]] ?? []
    let current = timeline
      .compactMap { item -> (Int, [String: Any])? in
        guard let timestamp = item["timestamp"] as? Int,
              let props = item["props"] as? [String: Any] else { return nil }
        return (timestamp, props)
      }
      .filter { Double($0.0) <= now.timeIntervalSince1970 * 1000 }
      .max { $0.0 < $1.0 }
    let props = current?.1 ?? defaults.dictionary(forKey: "__expo_widgets_OpenHomeWidgetV2_initial_props")
    guard let props else { return fallback }
    return OpenHomeEntry(
      date: now,
      amountText: props["amountText"] as? String ?? fallback.amountText,
      daysText: props["daysText"] as? String ?? fallback.daysText,
      dogUri: props["dogUri"] as? String ?? ""
    )
  }

  func placeholder(in context: Context) -> OpenHomeEntry {
    OpenHomeEntry(date: Date(), amountText: "¥—", daysText: "残り—日", dogUri: "")
  }

  func getSnapshot(in context: Context, completion: @escaping (OpenHomeEntry) -> Void) {
    completion(entry(at: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<OpenHomeEntry>) -> Void) {
    let now = Date()
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Asia/Tokyo") ?? .current
    let tomorrow = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))
      ?? now.addingTimeInterval(24 * 60 * 60)
    completion(Timeline(entries: [entry(at: now)], policy: .after(tomorrow)))
  }
}

struct OpenHomeWidgetV2: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "OpenHomeWidgetV2", provider: OpenHomeProvider()) { entry in
      OpenHomeContent(entry: entry)
    }
    .configurationDisplayName("今月あと使えるお金")
    .description("残額と残り日数を見て、ホームを開きます。")
    .supportedFamilies([.accessoryRectangular])
  }
}

private struct OpenHomeContent: View {
  let entry: OpenHomeEntry

  private var amount: String {
    entry.amountText.hasPrefix("¥") ? String(entry.amountText.dropFirst()) : entry.amountText
  }

  private var amountSize: CGFloat {
    switch amount.count {
    case 10...: return 11
    case 8...: return 14
    case 7...: return 17
    default: return 21
    }
  }

  private var content: some View {
    GeometryReader { geometry in
      ZStack(alignment: .leading) {
        Text("¥")
          .font(.system(size: 100, weight: .light, design: .rounded))
          .foregroundColor(Color.primary.opacity(0.32))
          .position(x: geometry.size.width * 0.92, y: geometry.size.height * 0.68)
          .accessibilityHidden(true)

        VStack(alignment: .leading, spacing: 2) {
          HStack(alignment: .firstTextBaseline, spacing: 1) {
            Text("¥")
              .font(.system(size: 11, weight: .semibold, design: .rounded))
            Text(amount)
              .font(.system(size: amountSize, weight: .semibold, design: .rounded))
              .monospacedDigit()
              .lineLimit(1)
              .minimumScaleFactor(0.6)
          }
          Text(entry.daysText)
            .font(.system(size: 11, weight: .semibold, design: .rounded))
            .lineLimit(1)
        }
        .frame(width: geometry.size.width * 0.74, alignment: .leading)
        .padding(.leading, 7)
      }
      .frame(width: geometry.size.width, height: geometry.size.height)
      .clipped()
    }
    .widgetURL(URL(string: "zuborakakeibo://home"))
  }

  var body: some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(Color.clear, for: .widget)
    } else {
      content
    }
  }
}
