import SwiftUI
import WidgetKit

private struct DiagnosticEntry: TimelineEntry {
  let date: Date
}

private struct DiagnosticProvider: TimelineProvider {
  func placeholder(in context: Context) -> DiagnosticEntry {
    DiagnosticEntry(date: Date())
  }

  func getSnapshot(in context: Context, completion: @escaping (DiagnosticEntry) -> Void) {
    completion(DiagnosticEntry(date: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<DiagnosticEntry>) -> Void) {
    completion(Timeline(entries: [DiagnosticEntry(date: Date())], policy: .never))
  }
}

struct OpenHomeWidgetV2: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "OpenHomeWidgetV2", provider: DiagnosticProvider()) { _ in
      DiagnosticContent()
    }
    .configurationDisplayName("Widget diagnostic")
    .description("Static rendering diagnostic")
    .supportedFamilies([.accessoryRectangular])
  }
}

private struct DiagnosticContent: View {
  private var content: some View {
    Text("STATIC TEST")
      .font(.system(size: 17, weight: .bold))
      .minimumScaleFactor(0.7)
      .lineLimit(1)
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
