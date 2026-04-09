const themes = {
  turquoise: {
    accent: '#00DECA',
    text: 'rgba(0, 222, 202, 1)',
    muted: 'rgba(0, 222, 202, 0.84)',
    faint: 'rgba(0, 222, 202, 0.48)',
    glow: 'rgba(0, 222, 202, 0.07)',
    accentLight: '#66EBDD',
  },
  mediumturquoise: {
    accent: '#48D1CC',
    text: 'rgba(72, 209, 204, 0.95)',
    muted: 'rgba(72, 209, 204, 0.72)',
    faint: 'rgba(72, 209, 204, 0.36)',
    glow: 'rgba(72, 209, 204, 0.07)',
    accentLight: '#8FE6E2',
  },
  pink: {
    accent: '#FF1478',
    text: 'rgba(255, 20, 120, 0.95)',
    muted: 'rgba(255, 20, 120, 0.72)',
    faint: 'rgba(255, 20, 120, 0.36)',
    glow: 'rgba(255, 20, 120, 0.07)',
    accentLight: '#FF76A8',
  },
};

const activeTheme = themes.turquoise;

const images = {
  pink: '/Users/jinchiwei/arcadia/customization/thinkpad/thinkpad deconstructed.deeppink-warmer-mid.cropped.png',
  turquoise: '/Users/jinchiwei/arcadia/customization/thinkpad/thinkpad deconstructed.turquoise.cropped.png',
};

const config = {
  ...activeTheme,
  graphUp: '#FF1493',
  graphDown: '#FF1493',
  graphGold: '#F6C945',
  imagePath: images.pink,
  scale: 0.88,
  useGoldGlow: false,
  imageGlowStrong: 'rgba(246, 201, 69, 0.34)',
  imageGlowSoft: 'rgba(246, 201, 69, 0.2)',
  shadowBaseColor: '#450045',
};

const collectorPath = '/Users/jinchiwei/arcadia/customization/thinkpad/collect_thinkpad_metrics.py';

export const refreshFrequency = 2000;
export const command = `THINKPAD_IMAGE_PATH="${config.imagePath}" python3 "${collectorPath}"`;
export const className = `
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parseOutput = (output) => {
  try {
    return JSON.parse(output);
  } catch (error) {
    return null;
  }
};

const hexToRgba = (hex, alpha) => {
  const raw = String(hex || '').replace('#', '');
  const normalized = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const fmtPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const sparkline = (points = [], stroke) => {
  const width = 220;
  const height = 34;
  const safePoints = points.length ? points : [0, 0];
  const maxValue = Math.max(...safePoints, 1);

  const graphPoints = safePoints
    .map((value, index) => {
      const x = safePoints.length === 1 ? 0 : (index / (safePoints.length - 1)) * width;
      const y = height - (value / maxValue) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return `
    <svg class="spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <polyline fill="none" stroke="${stroke}" stroke-width="2" points="${graphPoints}" />
    </svg>
  `;
};

const storageBar = (entry) => {
  let arrowClass = 'hidden';

  if (entry.label === '/' || entry.label === '/HOME') {
    arrowClass = 'visible';
  }

  return `
  <div class="storage-row">
    <div class="storage-label">
      <span class="storage-arrow ${arrowClass}">───────────────-</span>
      <span class="storage-mount">${escapeHtml(entry.label)}</span>
    </div>
    <div class="storage-bar">
      <div class="storage-bar-fill" style="width:${Math.max(4, entry.percent)}%"></div>
    </div>
    <div class="storage-meta">&lt; ${escapeHtml(entry.used_label)}/${escapeHtml(entry.total_label)} &gt;</div>
  </div>
`;
};

const buildSystemBlock = (data) => {
  const { meta, updates } = data;
  return [
    `${meta.hostname}-──────────────────────────`,
    `┌──────- ${meta.user}-─────┘`,
    `├─ macos   < ${meta.os_name} ${meta.os_version} >`,
    `├─ kernel  < ${meta.kernel} >`,
    `├─ uptime  < ${data.uptime} >`,
    `└─ updates < ${updates.label} >`,
  ].join('\n');
};

const buildGpuBlock = (data, resolutionLabel) =>
  [
    `───────────────- < ${data.meta.gpu_name} >`,
    `< ${data.meta.gpu_cores || '?'} cores / ${resolutionLabel} >`,
  ].join('\n');

const buildLocaleBlock = (data) => `< ${data.meta.locale} > -───────`;

const buildThermalBlock = (data) =>
  [
    `< ${data.thermals.cooling} > -─────────────────────`,
    '',
    'thermals -────────────────',
    `SOC  < ${data.thermals.sensor_note} >`,
    `MEM  < ${data.memory.used_label}/${data.memory.total_label} > < ${fmtPercent(data.memory.percent)} > used`,
  ].join('\n');

const buildCpuBlock = (data) =>
  [
    `< ${data.cpu.chip} > -──────────────────────────`,
    'used/load',
    `TOTAL < ${fmtPercent(data.cpu.percent)} / ${data.cpu.total_cores} cores >`,
    `P     < ${data.cpu.perf_cores || '?'} perf cores >`,
    `E     < ${data.cpu.eff_cores || '?'} eff cores >`,
    `LOAD  < ${data.cpu.load_avg.join(' ')} >`,
  ].join('\n');

const buildNetworkTopLine = (data) => `────────────────────────────- ${data.network.status} ${data.network.iface}`;

const buildNetworkBottomLine = (data) => `< ${data.network.ip || 'no ip'} >`;

const buildVolumeBlock = (data) => `volume: ${data.audio.label} -────────────`;

const styles = `
  @font-face {
    font-family: 'ThinkpadGeistMonoBold';
    src: url('file:///Users/jinchiwei/Library/Fonts/GeistMono-Bold.otf') format('opentype');
    font-style: normal;
    font-weight: 400;
  }

  .thinkpad-root {
    position: relative;
    width: 1280px;
    height: 860px;
    margin: 0 auto;
    left: 338px;
    top: 20px;
    transform: scale(var(--scale));
    transform-origin: top center;
    color: var(--text);
    font-family: 'GeistMono-Bold', 'Geist Mono Bold', 'ThinkpadGeistMonoBold', 'Geist Mono Regular', 'Geist Mono', 'SF Mono', 'IBM Plex Mono', 'JetBrains Mono', Menlo, monospace;
    font-weight: 400;
    font-variant-ligatures: none;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    line-height: 1.32;
    -webkit-font-smoothing: antialiased;
    text-shadow:
      1px 0 0 var(--shadow-inner),
      -1px 0 0 var(--shadow-inner),
      0 1px 0 var(--shadow-inner),
      0 -1px 0 var(--shadow-inner),
      0 0 3px var(--shadow-inner),
      0 0 8px var(--shadow-outer),
      0 0 14px var(--shadow-outer-far),
      0 0 18px var(--text-gold-glow-near),
      0 0 34px var(--text-gold-glow-far);
  }

  .thinkpad-root,
  .thinkpad-root * {
    font-family: 'GeistMono-Bold', 'Geist Mono Bold', 'ThinkpadGeistMonoBold', 'Geist Mono Regular', 'Geist Mono', 'SF Mono', 'IBM Plex Mono', 'JetBrains Mono', Menlo, monospace;
    font-variant-ligatures: none;
    pointer-events: none !important;
    -webkit-user-select: none;
    user-select: none;
  }

  .thinkpad-image {
    position: absolute;
    top: 38px;
    left: 51.5%;
    width: 1164px;
    transform: translateX(-50%);
    opacity: 0.98;
    filter:
      drop-shadow(0 0 2px rgba(255, 255, 255, 0.14))
      drop-shadow(1px 0 0 var(--shadow-inner))
      drop-shadow(-1px 0 0 var(--shadow-inner))
      drop-shadow(0 1px 0 var(--shadow-inner))
      drop-shadow(0 -1px 0 var(--shadow-inner))
      drop-shadow(0 0 4px var(--shadow-inner))
      drop-shadow(0 0 10px var(--shadow-outer))
      drop-shadow(0 0 18px var(--shadow-outer-far))
      drop-shadow(0 0 10px var(--image-glow-soft))
      drop-shadow(0 0 24px var(--image-glow-strong));
  }

  .panel {
    position: absolute;
    white-space: pre;
    font-size: 11px;
    font-family: inherit;
  }

  .panel.muted {
    color: var(--muted);
  }

  .system-panel {
    top: 90px;
    left: 279px;
    width: 300px;
  }

  .gpu-panel {
    top: 203px;
    right: 375px;
    width: 280px;
    text-align: right;
  }

  .locale-panel {
    top: 218px;
    left: 294px;
    width: 180px;
  }

  .thermal-panel {
    top: 407px;
    left: 132px;
    width: 308px;
  }

  .memory-panel {
    top: 447px;
    right: 356px;
    width: 330px;
    text-align: right;
  }

  .cpu-panel {
    top: 519px;
    left: 208px;
    width: 300px;
  }

  .network-panel {
    top: 501px;
    right: 303px;
    width: 300px;
    text-align: right;
  }

  .network-top-line {
    position: absolute;
    top: 0;
    right: 0;
    width: 100%;
    white-space: pre;
  }

  .network-bottom-line {
    position: absolute;
    top: 18px;
    right: 0;
    width: 100%;
    white-space: pre;
  }

  .graph-stack {
    position: absolute;
    top: 540px;
    right: 306px;
    width: 220px;
  }

  .graph-title {
    font-size: 10px;
    color: var(--muted);
    margin-bottom: 6px;
    text-align: right;
  }

  .spark {
    display: block;
    width: 220px;
    height: 34px;
    margin-bottom: 10px;
    overflow: visible;
  }

  .storage-panel {
    position: absolute;
    right: 182px;
    top: 674px;
    width: 430px;
  }

  .volume-panel {
    left: 90px;
    top: 635px;
    width: 320px;
    text-align: right;
  }

  .storage-row {
    display: grid;
    grid-template-columns: 170px 1fr 180px;
    align-items: center;
    gap: 12px;
    margin-bottom: 9px;
    font-size: 11px;
  }

  .storage-label {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    text-align: right;
    color: var(--muted);
    white-space: nowrap;
  }

  .storage-arrow.hidden {
    visibility: hidden;
  }

  .storage-bar {
    height: 6px;
    border: 1px solid var(--faint);
    position: relative;
  }

  .storage-bar-fill {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    background: linear-gradient(90deg, var(--accent), var(--accent-light));
  }

  .storage-meta {
    color: var(--muted);
    white-space: nowrap;
  }

  .battery-panel {
    top: 736px;
    right: 299px;
    width: 330px;
  }

  .battery-row {
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    gap: 10px;
    white-space: nowrap;
  }

  .battery-arrow {
    width: 150px;
    text-align: right;
    color: var(--text);
    flex: 0 0 150px;
  }

  .battery-label {
    width: 170px;
    text-align: left;
    color: var(--text);
    flex: 0 0 170px;
  }

  .footer-note {
    position: absolute;
    left: 230px;
    bottom: 1px;
    font-size: 10px;
    color: var(--faint);
    white-space: pre;
    font-family: inherit;
  }

  .error {
    position: absolute;
    top: 80px;
    left: 80px;
    color: #ff8cae;
    font: 13px/1.5 Menlo, monospace;
    white-space: pre-wrap;
  }
`;

export const render = ({ output, error }) => {
  let markup = '';

  if (error) {
    markup = `
      <style>${styles}</style>
      <div class="error">thinkpad widget failed\n${escapeHtml(error)}</div>
    `;
    return <div dangerouslySetInnerHTML={{ __html: markup }} />;
  }

  const data = parseOutput(output);
  if (!data) {
    markup = `
      <style>${styles}</style>
      <div class="error">thinkpad widget could not parse collector output</div>
    `;
    return <div dangerouslySetInnerHTML={{ __html: markup }} />;
  }

  const screenWidth = typeof window !== 'undefined' ? Math.round(window.screen.width * window.devicePixelRatio) : 0;
  const screenHeight = typeof window !== 'undefined' ? Math.round(window.screen.height * window.devicePixelRatio) : 0;
  const resolutionLabel = screenWidth && screenHeight ? `${screenWidth}x${screenHeight}` : 'display';
  const textGoldGlowNear = config.useGoldGlow ? 'rgba(246, 201, 69, 0.5)' : 'rgba(246, 201, 69, 0)';
  const textGoldGlowFar = config.useGoldGlow ? 'rgba(246, 201, 69, 0.36)' : 'rgba(246, 201, 69, 0)';
  const imageGlowSoft = config.useGoldGlow ? config.imageGlowSoft : 'rgba(246, 201, 69, 0)';
  const imageGlowStrong = config.useGoldGlow ? config.imageGlowStrong : 'rgba(246, 201, 69, 0)';
  const shadowInner = hexToRgba(config.shadowBaseColor, 0.9);
  const shadowOuter = hexToRgba(config.shadowBaseColor, 0.52);
  const shadowOuterFar = hexToRgba(config.shadowBaseColor, 0.28);

  markup = `
    <style>${styles}</style>
    <div
      class="thinkpad-root"
      style="
        --accent:${config.accent};
        --text:${config.text};
        --muted:${config.muted};
        --faint:${config.faint};
        --glow:${config.glow};
        --accent-light:${config.accentLight};
        --text-gold-glow-near:${textGoldGlowNear};
        --text-gold-glow-far:${textGoldGlowFar};
        --image-glow-strong:${imageGlowStrong};
        --image-glow-soft:${imageGlowSoft};
        --shadow-inner:${shadowInner};
        --shadow-outer:${shadowOuter};
        --shadow-outer-far:${shadowOuterFar};
        --scale:${config.scale};
      "
    >
      <img class="thinkpad-image" src="${escapeHtml(data.meta.image_data_url || '')}" />

      <pre class="panel system-panel">${escapeHtml(buildSystemBlock(data))}</pre>
      <pre class="panel gpu-panel">${escapeHtml(buildGpuBlock(data, resolutionLabel))}</pre>
      <pre class="panel locale-panel muted">${escapeHtml(buildLocaleBlock(data))}</pre>
      <pre class="panel thermal-panel">${escapeHtml(buildThermalBlock(data))}</pre>
      <pre class="panel memory-panel">${escapeHtml(`───────────- < ${data.memory.used_label}/${data.memory.total_label} > < ${fmtPercent(data.memory.percent)} > used`)}</pre>
      <pre class="panel cpu-panel">${escapeHtml(buildCpuBlock(data))}</pre>
      <div class="panel network-panel">
        <div class="network-top-line">${escapeHtml(buildNetworkTopLine(data))}</div>
        <div class="network-bottom-line">${escapeHtml(buildNetworkBottomLine(data))}</div>
      </div>

      <div class="graph-stack">
        <div class="graph-title">down ${escapeHtml(data.network.rx_label)}</div>
        ${sparkline(data.network.rx_history, config.graphDown)}
        <div class="graph-title">up ${escapeHtml(data.network.tx_label)}</div>
        ${sparkline(data.network.tx_history, config.graphUp)}
      </div>

      <pre class="panel volume-panel">${escapeHtml(buildVolumeBlock(data))}</pre>

      <div class="storage-panel">
        ${data.storage.map(storageBar).join('')}
      </div>

      <div class="panel battery-panel">
        <div class="battery-row">
          <span class="battery-arrow">───────────────-</span>
          <span class="battery-label">${escapeHtml(data.battery.label)}</span>
        </div>
      </div>
      <pre class="footer-note">model < ${escapeHtml(data.meta.model_name)} >\nbuild < ${escapeHtml(data.meta.build || 'unknown')} ></pre>
    </div>
  `;

  return <div dangerouslySetInnerHTML={{ __html: markup }} />;
};
