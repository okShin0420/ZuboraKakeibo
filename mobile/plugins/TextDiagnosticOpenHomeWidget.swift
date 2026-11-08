import SwiftUI
import WidgetKit

private struct TextDiagnosticEntry: TimelineEntry {
  let date: Date
  let amount: String
  let days: String
}

private struct TextDiagnosticProvider: TimelineProvider {
  private func currentEntry() -> TextDiagnosticEntry {
    let now = Date()
    guard let group = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String,
          let defaults = UserDefaults(suiteName: group) else {
      return TextDiagnosticEntry(date: now, amount: "NO GROUP", days: "STATIC DATA")
    }
    let key = "__expo_widgets_OpenHomeWidgetV2_timeline"
    guard let timeline = defaults.array(forKey: key) as? [[String: Any]] else {
      return TextDiagnosticEntry(date: now, amount: "NO TIMELINE", days: "STATIC DATA")
    }
    let latest = timeline
      .compactMap { item -> (Int, [String: Any])? in
        guard let timestamp = item["timestamp"] as? Int,
              let props = item["props"] as? [String: Any] else { return nil }
        return (timestamp, props)
      }
      .filter { Double($0.0) <= now.timeIntervalSince1970 * 1000 }
      .max { $0.0 < $1.0 }
    guard let props = latest?.1 else {
      return TextDiagnosticEntry(date: now, amount: "NO ENTRY", days: "STATIC DATA")
    }
    return TextDiagnosticEntry(
      date: now,
      amount: props["amountText"] as? String ?? "NO AMOUNT",
      days: props["daysText"] as? String ?? "NO DAYS"
    )
  }

  func placeholder(in context: Context) -> TextDiagnosticEntry {
    TextDiagnosticEntry(date: Date(), amount: "PLACEHOLDER", days: "STATIC DATA")
  }

  func getSnapshot(in context: Context, completion: @escaping (TextDiagnosticEntry) -> Void) {
    completion(currentEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TextDiagnosticEntry>) -> Void) {
    completion(Timeline(entries: [currentEntry()], policy: .never))
  }
}

struct OpenHomeWidgetV2: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "OpenHomeWidgetV2", provider: TextDiagnosticProvider()) { entry in
      TextDiagnosticContent(entry: entry)
    }
    .configurationDisplayName("Widget data diagnostic")
    .description("Checks shared amount and remaining days")
    .supportedFamilies([.accessoryRectangular])
  }
}

private struct TextDiagnosticContent: View {
  let entry: TextDiagnosticEntry

  private var content: some View {
    VStack(spacing: 1) {
      Text(entry.amount)
        .font(.system(size: 17, weight: .bold))
      Text(entry.days)
        .font(.system(size: 11, weight: .semibold))
    }
    .lineLimit(1)
    .minimumScaleFactor(0.65)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  var body: some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(Color.clear, for: .widget)
    } else {
      content
    }
  }
}
