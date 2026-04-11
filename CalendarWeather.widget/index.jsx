// CalendarWeather - Calendar grid, events, and weather for Übersicht
// Uses Jin's branding: Geist/Geist Mono, turquoise/deeppink/amber.

export const command = `bash CalendarWeather.widget/fetch.sh`;

export const refreshFrequency = 60000; // 1 minute

export const initialState = {
  calendar: { month: "", year: 0, today: 0, weeks: [] },
  events: [],
  weather: { temp: 0, code: 0, high: 0, low: 0 },
};

export const updateState = (event, previousState) => {
  if (event.error || !event.output) return previousState;
  try {
    const data = JSON.parse(event.output.trim());
    // Keep previous weather if new data is all zeros (failed fetch)
    if (data.weather && data.weather.temp === 0 && data.weather.high === 0 && data.weather.low === 0 && previousState.weather && previousState.weather.temp !== 0) {
      data.weather = previousState.weather;
    }
    return data;
  } catch {
    return previousState;
  }
};

export const className = `
  left: 310px;
  bottom: 65px;
  width: 275px;
  height: 385px;
  pointer-events: none;
  font-family: "Geist", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  z-index: 100;
  * { box-sizing: border-box; margin: 0; padding: 0; }
`;

const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

const eventColors = ["#F0C840", "#FF8C00", "#FF6B50"];  // amber, orange, coral

const weatherEmoji = (code) => {
  if (code === 0) return "\u2600\uFE0F";       // clear
  if (code <= 3) return "\u26C5";               // partly cloudy
  if (code <= 48) return "\u2601\uFE0F";        // cloudy/fog
  if (code <= 57) return "\uD83C\uDF27\uFE0F";  // drizzle
  if (code <= 67) return "\uD83C\uDF27\uFE0F";  // rain
  if (code <= 77) return "\u2744\uFE0F";        // snow
  if (code <= 82) return "\uD83C\uDF27\uFE0F";  // showers
  if (code >= 95) return "\u26A1";              // thunderstorm
  return "\u2601\uFE0F";
};

export const render = ({ calendar: cal, events, weather }) => {
  // Build map of day number -> array of colors from events
  const dayColorsMap = {};
  events.forEach((evt, i) => {
    const match = (evt.date || "").match(/(\d+)$/);
    if (match) {
      const dayNum = parseInt(match[1], 10);
      if (!dayColorsMap[dayNum]) dayColorsMap[dayNum] = [];
      dayColorsMap[dayNum].push(eventColors[i % eventColors.length]);
    }
  });

  return (
    <div style={styles.wrapper}>
      {/* Calendar grid - keeps card background */}
      <div style={styles.container}>
        <div style={styles.bg} />
        <div style={styles.content}>
          <div style={styles.calSection}>
            <div style={styles.monthHeader}>
              <span style={styles.monthName}>{cal.month}</span>
              <span style={styles.year}>{cal.year}</span>
            </div>
            <div style={styles.grid}>
              {dayNames.map((d, i) => (
                <div key={`h${i}`} style={styles.dayHeader}>{d}</div>
              ))}
              {(cal.weeks || []).map((week, wi) =>
                week.map((day, di) => {
                  const colors = dayColorsMap[day] || [];
                  const firstColor = colors[0];
                  const secondColor = colors.length > 1 ? colors[1] : null;
                  return (
                    <div
                      key={`${wi}-${di}`}
                      style={{
                        ...styles.day,
                        ...(day === cal.today ? { ...styles.today, ...(firstColor ? { color: firstColor, textShadow: "0 0 4px rgba(69, 0, 69, 0.9), 0 0 8px rgba(69, 0, 69, 0.5)" } : {}) } : {}),
                        ...(day === 0 ? styles.emptyDay : {}),
                        ...(day !== cal.today && firstColor ? { color: firstColor, fontWeight: 600 } : {}),
                      }}
                    >
                      <span style={{ position: "relative" }}>
                        {day > 0 ? day : ""}
                        {secondColor && <span style={{ position: "absolute", right: "-6px", top: "-2px", color: secondColor, fontSize: "8px" }}>*</span>}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Events - floating with glow */}
      <div style={styles.floatingSection}>
        {events.length === 0 ? (
          <div style={styles.noEvents}>no upcoming events</div>
        ) : (
          events.map((evt, i) => {
            const color = eventColors[i % eventColors.length];
            const dateParts = (evt.date || "").match(/^(.+\/)(\d+)$/);
            return (
              <div key={i} style={styles.event}>
                <div style={styles.eventName}>{evt.name}</div>
                <div style={styles.eventMeta}>
                  <span>
                    {dateParts ? (
                      <span>{dateParts[1]}<span style={{ color }}>{dateParts[2]}</span></span>
                    ) : evt.date}
                  </span>
                  <span style={styles.eventTime}>{evt.time}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Weather - floating with glow */}
      <div style={styles.weatherSection}>
        <span style={styles.weatherLeft}>
          <span style={styles.weatherEmoji}>{weatherEmoji(weather.code)}</span>
          <span style={styles.weatherTemp}>{weather.temp}°</span>
        </span>
        <span style={styles.weatherHiLo}>H:{weather.high}° L:{weather.low}°</span>
      </div>
    </div>
  );
};

// Blueviolet halo (matches Conky/ResearchLog glow)
const glow = [
  "1px 0 0 rgba(69, 0, 69, 0.9)",
  "-1px 0 0 rgba(69, 0, 69, 0.9)",
  "0 1px 0 rgba(69, 0, 69, 0.9)",
  "0 -1px 0 rgba(69, 0, 69, 0.9)",
  "0 0 3px rgba(69, 0, 69, 0.9)",
  "0 0 8px rgba(64, 224, 208, 0.35)",
  "0 0 14px rgba(64, 224, 208, 0.2)",
].join(", ");

const styles = {
  wrapper: {
    pointerEvents: "none",
    position: "relative",
    height: "385px",
  },
  container: {
    position: "relative",
    borderRadius: "14px",
    overflow: "hidden",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 0.5px rgba(255, 255, 255, 0.08) inset",
    pointerEvents: "none",
  },
  bg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15, 15, 20, 0.65)",
    zIndex: 0,
  },
  content: {
    position: "relative",
    zIndex: 1,
    padding: "14px",
  },

  // Calendar grid
  calSection: {
  },
  monthHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: "8px",
  },
  monthName: {
    fontFamily: '"Geist Mono", "SF Mono", "Menlo", monospace',
    fontSize: "13px",
    fontWeight: 700,
    color: "#40E0D0",
  },
  year: {
    fontFamily: '"Geist Mono", "SF Mono", "Menlo", monospace',
    fontSize: "11px",
    color: "rgba(255, 255, 255, 0.25)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "1px",
    textAlign: "center",
  },
  dayHeader: {
    fontFamily: '"Geist Mono", "SF Mono", "Menlo", monospace',
    fontSize: "9px",
    fontWeight: 600,
    color: "rgba(255, 255, 255, 0.3)",
    padding: "2px 0",
  },
  day: {
    fontFamily: '"Geist Mono", "SF Mono", "Menlo", monospace',
    fontSize: "11px",
    color: "rgba(255, 255, 255, 0.55)",
    padding: "3px 0",
    borderRadius: "4px",
  },
  today: {
    background: "#40E0D0",
    color: "#000",
    fontWeight: 700,
  },
  emptyDay: {
    color: "transparent",
  },

  // Floating sections (events + weather)
  floatingSection: {
    padding: "10px 14px 0",
    minHeight: "160px",
  },
  noEvents: {
    fontSize: "11px",
    color: "rgba(255, 255, 255, 0.4)",
    fontStyle: "italic",
    textShadow: glow,
  },
  event: {
    marginBottom: "6px",
  },
  eventName: {
    fontSize: "12px",
    fontWeight: 500,
    color: "rgba(255, 255, 255, 0.85)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    textShadow: glow,
  },
  eventMeta: {
    fontFamily: '"Geist Mono", "SF Mono", "Menlo", monospace',
    fontSize: "10px",
    color: "rgba(255, 255, 255, 0.55)",
    display: "flex",
    justifyContent: "space-between",
    textShadow: glow,
  },
  eventTime: {
    color: "#FF1493",
    textShadow: glow,
  },

  // Weather - floating with glow
  weatherSection: {
    position: "absolute",
    bottom: "2px",
    left: "0",
    right: "0",
    padding: "2px 14px 0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  weatherLeft: {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
  },
  weatherEmoji: {
    fontSize: "14px",
    filter: "drop-shadow(0 0 4px rgba(69, 0, 69, 0.7)) drop-shadow(0 0 8px rgba(64, 224, 208, 0.25))",
  },
  weatherTemp: {
    fontFamily: '"Geist Mono", "SF Mono", "Menlo", monospace',
    fontSize: "16px",
    fontWeight: 700,
    color: "rgba(255, 255, 255, 0.9)",
    textShadow: glow,
  },
  weatherHiLo: {
    fontFamily: '"Geist Mono", "SF Mono", "Menlo", monospace',
    fontSize: "10px",
    color: "rgba(255, 255, 255, 0.55)",
    textShadow: glow,
  },
};
