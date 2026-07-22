const KEY_MODE = 'pymon_theme_mode';
const KEY_BG_LIGHT = 'pymon_color_bg_light';
const KEY_BG_DARK = 'pymon_color_bg_dark';
const KEY_PRI_LIGHT = 'pymon_color_primary_light';
const KEY_PRI_DARK = 'pymon_color_primary_dark';

const DEFAULTS = {
  bgLight: '#f8fafc',
  bgDark: '#020617',
  priLight: '#6366f1',
  priDark: '#818cf8',
  mode: 'auto',
};

let _mode = $state(load(KEY_MODE, DEFAULTS.mode));
let _bgLight = $state(load(KEY_BG_LIGHT, DEFAULTS.bgLight));
let _bgDark = $state(load(KEY_BG_DARK, DEFAULTS.bgDark));
let _priLight = $state(load(KEY_PRI_LIGHT, DEFAULTS.priLight));
let _priDark = $state(load(KEY_PRI_DARK, DEFAULTS.priDark));

function load(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function deriveColors(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const rgb = `${r}, ${g}, ${b}`;

  const lighten = (v, a) => Math.min(255, Math.round(v + (255 - v) * a));
  const darken = (v, a) => Math.round(v * (1 - a));

  return {
    rgb,
    light: `#${lighten(r, 0.3).toString(16).padStart(2, '0')}${lighten(g, 0.3).toString(16).padStart(2, '0')}${lighten(b, 0.3).toString(16).padStart(2, '0')}`,
    dark: `#${darken(r, 0.2).toString(16).padStart(2, '0')}${darken(g, 0.2).toString(16).padStart(2, '0')}${darken(b, 0.2).toString(16).padStart(2, '0')}`,
  };
}

function surfaceColor(hex, mode) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (mode === 'dark') {
    const s = (v) => Math.min(255, v + 16).toString(16).padStart(2, '0');
    return `#${s(r)}${s(g)}${s(b)}`;
  }
  return '#ffffff';
}

function borderColor(hex, mode) {
  if (mode === 'dark') return 'rgba(255,255,255,0.08)';
  return 'rgba(0,0,0,0.06)';
}

function glassColor(mode) {
  if (mode === 'dark') return 'rgba(15,23,42,0.75)';
  return 'rgba(255,255,255,0.75)';
}

function glassBorder(mode) {
  if (mode === 'dark') return 'rgba(255,255,255,0.08)';
  return 'rgba(255,255,255,0.3)';
}

function textMuted(mode) {
  return mode === 'dark' ? '#94a3b8' : '#64748b';
}

let _effectiveMode = $derived.by(() => {
  if (_mode === 'dark') return 'dark';
  if (_mode === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
});

function apply() {
  if (typeof document === 'undefined') return;
  const m = _effectiveMode;
  const bg = m === 'dark' ? _bgDark : _bgLight;
  const pri = m === 'dark' ? _priDark : _priLight;
  const c = deriveColors(pri);
  const root = document.documentElement;

  root.setAttribute('data-theme', m);
  if (m === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');

  const style = root.style;
  style.setProperty('--bg-app', bg);
  style.setProperty('--bg-surface', surfaceColor(bg, m));
  style.setProperty('--text-primary', m === 'dark' ? '#f8fafc' : '#0f172a');
  style.setProperty('--text-secondary', textMuted(m));
  style.setProperty('--border-default', borderColor(bg, m));
  style.setProperty('--glass-bg', glassColor(m));
  style.setProperty('--glass-border', glassBorder(m));
  style.setProperty('--color-primary', pri);
  style.setProperty('--color-primary-rgb', c.rgb);
  style.setProperty('--color-primary-light', c.light);
  style.setProperty('--color-primary-dark', c.dark);
  style.setProperty('--radius-card', '0.75rem');
  style.setProperty('--radius-pill', '9999px');
}

export function getTheme() {
  return { mode: _mode, bgLight: _bgLight, bgDark: _bgDark, priLight: _priLight, priDark: _priDark };
}

export function setMode(mode) {
  _mode = mode;
  try { localStorage.setItem(KEY_MODE, mode); } catch {}
  apply();
}

export function setBg(light, dark) {
  _bgLight = light;
  _bgDark = dark;
  try { localStorage.setItem(KEY_BG_LIGHT, light); localStorage.setItem(KEY_BG_DARK, dark); } catch {}
  apply();
}

export function setPrimary(light, dark) {
  _priLight = light;
  _priDark = dark;
  try { localStorage.setItem(KEY_PRI_LIGHT, light); localStorage.setItem(KEY_PRI_DARK, dark); } catch {}
  apply();
}

export function initTheme() {
  apply();
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (_mode === 'auto') apply();
    });
  }
}

export const effectiveMode = () => _effectiveMode;