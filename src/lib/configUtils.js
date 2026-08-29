export function fmtCount(value) {
  return Number(value || 0).toLocaleString('de-DE');
}

export function fmtBytes(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return String(value ?? '');
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let u = -1;
  let v = n;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return `${v.toFixed(1)} ${units[u]}`;
}

export function genId(prefix) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 7; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return prefix + s;
}

export function alphaCompare(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { sensitivity: 'base' });
}

export function namedValue(value, fallback = '') {
  if (!value || typeof value !== 'object') return value || fallback;
  return value.title || value.label || value.name || value.id || fallback;
}

export function compareNamed(a, b) {
  return alphaCompare(namedValue(a), namedValue(b)) || alphaCompare(a?.id || a?.name || '', b?.id || b?.name || '');
}

export function compareEntries([idA, valueA], [idB, valueB]) {
  return alphaCompare(namedValue(valueA, idA), namedValue(valueB, idB)) || alphaCompare(idA, idB);
}