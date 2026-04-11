// ResearchLog - Autoresearch activity feed for Übersicht
// Scans research-log repo, groups by project/experiment, shows result blurbs.
// Uses Jin's branding: Geist/Geist Mono, turquoise/deeppink/amber/blueviolet.

export const command = `bash ResearchLog.widget/fetch-log.sh`;

export const refreshFrequency = 30000;

export const initialState = { projects: [] };

export const updateState = (event, previousState) => {
  if (event.error || !event.output) return previousState;
  try {
    return JSON.parse(event.output.trim());
  } catch {
    return previousState;
  }
};

export const className = `
  left: 25px;
  top: 15px;
  width: 560px;
  max-height: 960px;
  pointer-events: none;
  font-family: "Geist", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  z-index: 100;
  * { box-sizing: border-box; margin: 0; padding: 0; }
`;

const projectColors = {
  brainlab: "#40E0D0",   // turquoise
  wolong: "#FF1493",     // deeppink
  curiedx: "#F0C840",    // amber
  papers: "#F0C840",     // amber
  musegen: "#F0C840",    // amber
  musidia: "#8A2BE2",    // blueviolet
};

const projectMaxItems = {
  brainlab: 3,
  wolong: 2,
  curiedx: 1,
};

const defaultMaxItems = 2;

const getColor = (project) => projectColors[project] || "rgba(255,255,255,0.5)";

export const render = ({ projects }) => {
  if (!projects || projects.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.content}>
          <div style={styles.header}>research log</div>
          <div style={styles.empty}>no experiments running</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>research log</div>
        <div style={styles.projects}>
          {projects.map((project) => (
            <div key={project.name} style={styles.project}>
              <div style={{ ...styles.projectName, color: getColor(project.name) }}>
                {project.name}
              </div>
              {project.experiments.slice(0, projectMaxItems[project.name] || defaultMaxItems).map((exp) => (
                <div key={exp.name} style={styles.experiment}>
                  <div style={styles.expHeader}>
                    <span style={styles.expName}>{exp.name}</span>
                    <span style={styles.time}>{exp.time}</span>
                  </div>
                  {exp.metric ? (
                    <div style={styles.blurbBlock}>
                      <div style={styles.resultLine}>
                        <span style={styles.metric}>{exp.metric}</span>
                        <span style={styles.result}>{exp.result}</span>
                      </div>
                      {exp.next && <div style={styles.next}>{exp.next}</div>}
                    </div>
                  ) : (
                    <div style={styles.result}>{exp.result}</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Blueviolet halo for bright text (white, turquoise, deeppink)
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
  container: {
    position: "relative",
    pointerEvents: "none",
  },
  content: {
    position: "relative",
    padding: "16px",
  },
  header: {
    fontFamily: '"Geist Mono", "SF Mono", "Menlo", monospace',
    fontSize: "13px",
    fontWeight: 700,
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    marginBottom: "12px",
    textShadow: glow,
  },
  empty: {
    fontSize: "12px",
    color: "rgba(255, 255, 255, 0.25)",
    fontStyle: "italic",
    padding: "4px 0",
    textShadow: glow,
  },
  projects: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  project: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  projectName: {
    fontFamily: '"Geist Mono", "SF Mono", "Menlo", monospace',
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.3px",
    textShadow: glow,
  },
  experiment: {
    paddingLeft: "12px",
    borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
  },
  expHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: "2px",
  },
  expName: {
    fontFamily: '"Geist Mono", "SF Mono", "Menlo", monospace',
    fontSize: "11px",
    fontWeight: 500,
    color: "rgba(255, 255, 255, 0.75)",
    textShadow: glow,
  },
  time: {
    fontFamily: '"Geist Mono", "SF Mono", "Menlo", monospace',
    fontSize: "10px",
    color: "rgba(255, 255, 255, 0.45)",
    flexShrink: 0,
    marginLeft: "8px",
    textShadow: glow,
  },
  blurbBlock: {
    marginTop: "2px",
  },
  resultLine: {
    display: "flex",
    gap: "5px",
    alignItems: "baseline",
  },
  metric: {
    fontFamily: '"Geist Mono", "SF Mono", "Menlo", monospace',
    fontSize: "9px",
    fontWeight: 600,
    color: "rgba(255, 255, 255, 0.55)",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
    flexShrink: 0,
    textShadow: glow,
  },
  result: {
    fontSize: "12px",
    fontWeight: 500,
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: "17px",
    textShadow: glow,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  next: {
    fontSize: "11px",
    fontWeight: 400,
    color: "rgba(255, 255, 255, 0.5)",
    fontStyle: "italic",
    marginTop: "1px",
    textShadow: glow,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
};
