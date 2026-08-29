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

export function fmtTime(iso) {
  if (!iso) return '';
  const s = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
  return new Date(s).toLocaleString();
}

export function fmtVal(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}