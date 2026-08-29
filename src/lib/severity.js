import AlertCircle from 'lucide-svelte/icons/alert-circle';
import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
import Info from 'lucide-svelte/icons/info';

export const SEVERITY_ICONS = { critical: AlertCircle, warning: AlertTriangle, info: Info };
export const SEVERITY_COLORS = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
export const SEVERITY_ORDER = ['critical', 'warning', 'info'];

export function severityIcon(severity) {
  return SEVERITY_ICONS[severity] || Info;
}

export function severityColor(severity) {
  return SEVERITY_COLORS[severity] || '#3b82f6';
}