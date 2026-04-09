// Playbox - Now Playing widget for Übersicht
// Shows album art, track info, and progress bar with glassmorphism styling.
// Supports Spotify and YouTube (via Chrome). Uses Jin's branding colors.

export const command = `osascript Playbox.widget/now-playing.applescript`;

export const refreshFrequency = 1000;

export const initialState = {
  name: "",
  artist: "",
  album: "",
  artwork: "",
  duration: 0,
  position: 0,
  state: "closed",
  source: "",
};

export const updateState = (event, previousState) => {
  if (event.error || !event.output) return { ...previousState, state: "closed", pausedSince: 0 };
  try {
    const data = JSON.parse(event.output.trim());
    const now = Date.now();
    // Track when pause started
    if (data.state === "paused") {
      const pausedSince = previousState.pausedSince || now;
      return { ...previousState, ...data, pausedSince };
    }
    return { ...previousState, ...data, pausedSince: 0 };
  } catch {
    return { ...previousState, state: "closed", pausedSince: 0 };
  }
};

export const className = `
  left: 25px;
  bottom: 65px;
  width: 275px;
  pointer-events: none;
  font-family: "Geist", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  z-index: 100;
  * { box-sizing: border-box; margin: 0; padding: 0; }
`;

const formatTime = (seconds) => {
  if (!seconds || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const render = ({ name, artist, album, artwork, duration, position, state, source, pausedSince }) => {
  const pausedTooLong = state === "paused" && pausedSince > 0 && (Date.now() - pausedSince) > 60000;
  const idle = state === "closed" || state === "stopped" || pausedTooLong;

  const displayName = idle ? "playbox" : name;
  const displayArtist = idle ? "dreaming machine" : artist;
  const displayAlbum = idle ? "glory to the Greatest" : album;
  const progress = idle ? 0 : (duration > 0 ? (position / (duration / 1000)) * 100 : 0);
  const isPaused = !idle && state === "paused";
  const durationSec = idle ? 0 : duration / 1000;

  return (
    <div style={styles.container}>
      {/* Background artwork blur */}
      <div style={{ ...styles.bgArt, backgroundImage: !idle && artwork ? `url(${artwork})` : "none" }} />
      <div style={styles.bgOverlay} />

      {/* Content */}
      <div style={styles.content}>
        {/* Album art */}
        <div style={styles.artWrapper}>
          {!idle && artwork ? (
            <img src={artwork} style={styles.art} />
          ) : idle ? (
            <img src="Playbox.widget/idle-art.png" style={styles.art} />
          ) : (
            <div style={styles.artPlaceholder}>
              <span style={styles.note}>&#9835;</span>
            </div>
          )}
          {isPaused && (
            <div style={styles.pauseBadge}>
              <span style={styles.pauseIcon}>&#10074;&#10074;</span>
            </div>
          )}
          {!idle && source && (
            <div style={styles.sourceBadge}>
              {source === "youtube" ? (
                <svg width="14" height="10" viewBox="0 0 28 20" fill="white">
                  <path d="M27.4 3.1c-.3-1.2-1.2-2.1-2.4-2.4C22.8 0 14 0 14 0S5.2 0 3 .7C1.8 1 .9 1.9.6 3.1 0 5.3 0 10 0 10s0 4.7.6 6.9c.3 1.2 1.2 2.1 2.4 2.4C5.2 20 14 20 14 20s8.8 0 11-.7c1.2-.3 2.1-1.2 2.4-2.4C28 14.7 28 10 28 10s0-4.7-.6-6.9zM11.2 14.3V5.7l7.3 4.3-7.3 4.3z"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.5 17.3c-.2.3-.6.4-1 .2-2.7-1.6-6-2-10-1.1-.4.1-.8-.2-.8-.6-.1-.4.2-.8.6-.8 4.3-1 8-0.6 11 1.2.3.2.4.7.2 1.1zm1.5-3.3c-.3.4-.8.5-1.2.3-3-1.9-7.7-2.4-11.3-1.3-.5.1-1-.1-1.1-.6-.1-.5.1-1 .6-1.1 4.1-1.3 9.2-.7 12.7 1.5.4.2.5.8.3 1.2zm.1-3.4c-3.7-2.2-9.7-2.4-13.2-1.3-.5.2-1.1-.1-1.3-.6-.2-.5.1-1.1.6-1.3 4-1.2 10.7-1 14.8 1.5.5.3.6.9.4 1.4-.3.5-.9.6-1.3.3z"/>
                </svg>
              )}
            </div>
          )}
          {idle && (
            <div style={styles.sourceBadge}>
              <svg width="12" height="16" viewBox="0 0 12 16" fill="#F0C840" opacity="0.85">
                <rect x="4" y="0" width="4" height="16" rx="1" />
                <rect x="0" y="5" width="12" height="4" rx="1" />
              </svg>
            </div>
          )}
        </div>

        {/* Track info */}
        <div style={styles.info}>
          <div style={styles.trackName}>{displayName}</div>
          <div style={styles.artist}>{displayArtist}</div>
          <div style={styles.album}>{displayAlbum}</div>
        </div>

        {/* Progress bar */}
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${Math.min(progress, 100)}%` }} />
            {!idle && <div style={{ ...styles.progressDot, left: `${Math.min(progress, 100)}%` }} />}
          </div>
          <div style={styles.times}>
            <span>{idle ? "-:--" : formatTime(position)}</span>
            <span>{idle ? "-:--" : formatTime(durationSec)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    position: "relative",
    borderRadius: "14px",
    overflow: "hidden",
    WebkitMaskImage: "-webkit-radial-gradient(white, black)",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 0.5px rgba(255, 255, 255, 0.08) inset",
    pointerEvents: "none",
  },
  bgArt: {
    position: "absolute",
    top: "-20px",
    left: "-20px",
    right: "-20px",
    bottom: "-20px",
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: "blur(40px) brightness(0.35) saturate(1.6)",
    zIndex: 0,
  },
  bgOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)",
    zIndex: 1,
  },
  content: {
    position: "relative",
    zIndex: 2,
    padding: "16px",
  },
  artWrapper: {
    position: "relative",
    width: "100%",
    aspectRatio: "1",
    borderRadius: "8px",
    overflow: "hidden",
    marginBottom: "14px",
    boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
  },
  art: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  artPlaceholder: {
    width: "100%",
    height: "100%",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    fontSize: "64px",
    color: "rgba(255, 255, 255, 0.15)",
  },
  pauseBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pauseIcon: {
    fontSize: "32px",
    color: "rgba(255, 255, 255, 0.85)",
    letterSpacing: "-4px",
  },
  sourceBadge: {
    position: "absolute",
    top: "8px",
    right: "8px",
    background: "rgba(0, 0, 0, 0.55)",
    borderRadius: "6px",
    padding: "4px 6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    marginBottom: "12px",
  },
  trackName: {
    fontFamily: '"Geist Mono", "SF Mono", "Menlo", monospace',
    fontSize: "19px",
    fontWeight: 700,
    color: "#40E0D0",  // turquoise
    lineHeight: "24px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    textShadow: "0 0 12px rgba(64, 224, 208, 0.4)",
  },
  artist: {
    fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
    fontSize: "14px",
    fontWeight: 500,
    color: "#FF1493",  // deeppink
    lineHeight: "19px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginTop: "3px",
    textShadow: "0 0 10px rgba(255, 20, 147, 0.3)",
  },
  album: {
    fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
    fontSize: "11px",
    fontWeight: 400,
    color: "rgba(240, 200, 64, 0.82)",  // amber, muted
    lineHeight: "15px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginTop: "3px",
    letterSpacing: "0.3px",
  },
  progressContainer: {
    width: "100%",
  },
  progressBar: {
    position: "relative",
    width: "100%",
    height: "3px",
    background: "rgba(255, 255, 255, 0.12)",
    borderRadius: "2px",
    overflow: "visible",
  },
  progressFill: {
    height: "100%",
    background: "#40E0D0",  // turquoise
    borderRadius: "2px",
    transition: "width 0.8s linear",
  },
  progressDot: {
    position: "absolute",
    top: "50%",
    width: "7px",
    height: "7px",
    background: "#40E0D0",  // turquoise
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
    transition: "left 0.8s linear",
    boxShadow: "0 0 6px rgba(64, 224, 208, 0.4)",
  },
  times: {
    display: "flex",
    justifyContent: "space-between",
    fontFamily: '"Geist Mono", "SF Mono", "Menlo", monospace',
    fontSize: "10px",
    color: "rgba(255, 255, 255, 0.35)",
    marginTop: "4px",
    fontVariantNumeric: "tabular-nums",
  },
};
