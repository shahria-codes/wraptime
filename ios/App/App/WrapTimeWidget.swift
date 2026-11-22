import WidgetKit
import SwiftUI

// Data models representing the JSON stored by Capacitor
struct ShiftInfo: Codable {
    let hasShift: Bool
    let branch: String?
    let startTime: String?
    let endTime: String?
    let timeString: String?
    let status: String?
    let coworkers: String?
    let dateFormatted: String?
    let dayName: String?
}

struct WrapTimeWidgetData: Codable {
    let employeeName: String?
    let todayShift: ShiftInfo?
    let nextShift: ShiftInfo?
    let updatedAt: String?
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let data: WrapTimeWidgetData?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(
            date: Date(),
            data: WrapTimeWidgetData(
                employeeName: "Staff",
                todayShift: ShiftInfo(hasShift: true, branch: "Vilnius Outlet", startTime: "10:00", endTime: "22:00", timeString: "10:00 - 22:00", status: "Scheduled", coworkers: "Jakaria", dateFormatted: nil, dayName: nil),
                nextShift: ShiftInfo(hasShift: true, branch: "Antakalnis", startTime: "09:00", endTime: "22:00", timeString: "09:00 - 22:00", status: nil, coworkers: nil, dateFormatted: "Nov 23", dayName: "Tomorrow"),
                updatedAt: nil
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> ()) {
        let entry = loadEntry()
        // Refresh every 30 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadEntry() -> SimpleEntry {
        // Read from shared UserDefaults or standard UserDefaults
        let defaults = UserDefaults(suiteName: "group.com.wraptime.app") ?? UserDefaults.standard
        if let jsonString = defaults.string(forKey: "wraptime_widget_data"),
           let jsonData = jsonString.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(WrapTimeWidgetData.self, from: jsonData) {
            return SimpleEntry(date: Date(), data: decoded)
        }
        return SimpleEntry(date: Date(), data: nil)
    }
}

// SwiftUI Widget View for iOS & macOS
struct WrapTimeWidgetEntryView: View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            // Dark glass background
            Color(red: 15/255, green: 23/255, blue: 42/255)

            if let data = entry.data {
                switch family {
                case .systemSmall:
                    smallView(data: data)
                default:
                    mediumView(data: data)
                }
            } else {
                emptyView()
            }
        }
    }

    // Medium Widget View (Two columns: Today + Upcoming)
    @ViewBuilder
    func mediumView(data: WrapTimeWidgetData) -> some View {
        HStack(spacing: 12) {
            // Left Column: Today
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("🌯 TODAY")
                        .font(.system(size: 11, weight: .black))
                        .foregroundColor(Color(red: 245/255, green: 158/255, blue: 11/255))
                    Spacer()
                    if let today = data.todayShift, today.hasShift {
                        Text(today.status ?? "Scheduled")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(Color.green)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 2)
                            .background(Color.green.opacity(0.15))
                            .cornerRadius(4)
                    }
                }

                if let today = data.todayShift, today.hasShift {
                    Text(today.branch ?? "Branch")
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundColor(.white)
                        .lineLimit(1)

                    Text(today.timeString ?? "")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(Color(red: 56/255, green: 189/255, blue: 248/255))

                    Text("Team: \(today.coworkers ?? "Solo")")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(.gray)
                        .lineLimit(1)
                } else {
                    Spacer()
                    Text("Off Duty Today")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.gray)
                    Spacer()
                }
            }
            .padding(8)
            .background(Color.white.opacity(0.04))
            .cornerRadius(10)

            // Right Column: Upcoming
            VStack(alignment: .leading, spacing: 4) {
                Text("📅 NEXT SHIFT")
                    .font(.system(size: 11, weight: .black))
                    .foregroundColor(Color(red: 56/255, green: 189/255, blue: 248/255))

                if let next = data.nextShift, next.hasShift {
                    Text("\(next.dayName ?? "Soon"), \(next.dateFormatted ?? "")")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color(red: 245/255, green: 158/255, blue: 11/255))

                    Text(next.branch ?? "Branch")
                        .font(.system(size: 13, weight: .heavy))
                        .foregroundColor(.white)
                        .lineLimit(1)

                    Text(next.timeString ?? "")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.gray)
                } else {
                    Spacer()
                    Text("No upcoming shifts")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.gray)
                    Spacer()
                }
            }
            .padding(8)
            .background(Color.white.opacity(0.04))
            .cornerRadius(10)
        }
        .padding(10)
    }

    // Small Widget View (Today focus)
    @ViewBuilder
    func smallView(data: WrapTimeWidgetData) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("🌯 WrapTime")
                .font(.system(size: 11, weight: .black))
                .foregroundColor(Color(red: 245/255, green: 158/255, blue: 11/255))

            if let today = data.todayShift, today.hasShift {
                Text(today.branch ?? "Branch")
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundColor(.white)
                    .lineLimit(1)

                Text(today.timeString ?? "")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(Color(red: 56/255, green: 189/255, blue: 248/255))

                Spacer()

                if let next = data.nextShift, next.hasShift {
                    Text("Next: \(next.dayName ?? "") \(next.branch ?? "")")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(.gray)
                        .lineLimit(1)
                }
            } else {
                Spacer()
                Text("Off Duty Today")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.gray)
                Spacer()
            }
        }
        .padding(12)
    }

    @ViewBuilder
    func emptyView() -> some View {
        VStack(spacing: 6) {
            Text("🌯 WrapTime")
                .font(.system(size: 14, weight: .black))
                .foregroundColor(Color(red: 245/255, green: 158/255, blue: 11/255))
            Text("Open WrapTime to sync schedule")
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

@main
struct WrapTimeWidgetBundle: WidgetBundle {
    var body: some Widget {
        WrapTimeWidget()
    }
}

struct WrapTimeWidget: Widget {
    let kind: String = "WrapTimeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            WrapTimeWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("WrapTime Schedule")
        .description("View your work schedule for today and upcoming shifts at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
