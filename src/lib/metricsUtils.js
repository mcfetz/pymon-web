export const TIME_PRESETS = [
  { label: '1h', value: '1h' }, { label: '6h', value: '6h' },
  { label: '12h', value: '12h' }, { label: '1d', value: '1d' }, { label: '1w', value: '1w' },
];

export const PRESET_HOURS = { '1h': 1, '6h': 6, '12h': 12, '1d': 24, '1w': 168 };

export function timeFromPreset(preset, untilStr) {
  const hours = PRESET_HOURS[preset] || 1;
  const untilDate = untilStr ? new Date(untilStr) : null;
  const baseTime = (untilDate && !isNaN(untilDate.getTime())) ? untilDate.getTime() : Date.now();
  return new Date(baseTime - hours * 3600000).toISOString();
}

function toDate(iso) {
  if (!iso) return null;
  const s = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Plain locale date-time string ('' for empty, '—' for invalid). */
export function fmtTime(iso, empty = '') {
  const d = toDate(iso);
  if (!d) return iso ? '—' : empty;
  return d.toLocaleString();
}

/**
 * Human-friendly timestamp: "18:32" today, "yesterday 18:32" yesterday,
 * otherwise the full locale string.
 */
export function fmtSmartTime(iso) {
  const d = toDate(iso);
  if (!d) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const alarmDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (alarmDate.getTime() === today.getTime()) return time;
  if (alarmDate.getTime() === yesterday.getTime()) return `yesterday ${time}`;
  return d.toLocaleString();
}

/** Relative duration like "5m ago" / "3h ago" / "2d ago". */
export function fmtRelTime(iso) {
  const d = toDate(iso);
  if (!d) return '';
  const sec = (Date.now() - d.getTime()) / 1000;
  if (sec < 60) return `${Math.round(sec)}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

export function fmtVal(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

/**
 * Per-series statistics (min/avg/max/latest/delta/count). latest and oldest
 * are resolved by timestamp so the result is stable regardless of the order
 * in which the query rows arrive.
 */
export function computeStats(data) {
  const map = {};
  for (const row of data) {
    if (typeof row.value !== 'number') continue;
    const key = `${row.agent_title || row.agentid} › ${row.plugin_title || row.pluginid} › ${row.metric}`;
    const ts = row.timestamp ? new Date(row.timestamp).getTime() : row.value;
    if (!map[key]) map[key] = { vals: [], latest: null, oldest: null, latestTs: -Infinity, oldestTs: Infinity };
    const s = map[key];
    s.vals.push(row.value);
    if (ts >= s.latestTs) { s.latestTs = ts; s.latest = row.value; }
    if (ts <= s.oldestTs) { s.oldestTs = ts; s.oldest = row.value; }
  }
  return Object.entries(map).map(([label, s]) => {
    let min = Infinity, max = -Infinity, sum = 0;
    for (const v of s.vals) { if (v < min) min = v; if (v > max) max = v; sum += v; }
    return { label, count: s.vals.length, min, avg: sum / s.vals.length, max, latest: s.latest, delta: s.latest - s.oldest };
  });
}

/** Copy text to the clipboard with a legacy fallback. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}