/**
 * Pure heuristics that decide whether a dashboard panel deserves attention.
 *
 * Two deliberate constraints:
 *
 *  1. Conservative. Only high-confidence signals count. A "problems only"
 *     filter that cries wolf gets switched off within a day, and then it is
 *     worse than no filter at all.
 *  2. Explainable. Every issue carries the reason that produced it, so a
 *     verdict can be argued with instead of merely trusted.
 *
 * Deliberately NOT flagged: cpu percent (a busy node is not a broken node),
 * `containers_updates_unchecked` (an image without registry metadata is not
 * an outage), and read-only filesystems (a squashfs is at 100% by definition,
 * flagging it forever is noise).
 *
 * No Svelte or DOM imports on purpose, so this file stays unit-testable with
 * plain node.
 */

const AGENT_ERROR = /^agent:error$/;
const SERVICE_STATE = /^service:(.+):(tasks_running|up)$/;
const STATUS_METRIC = /:status$/;
const DISK_METRIC = /(^|:)(disk_pct|usage|usage_pct)$/;
const MEM_METRIC = /(^|:)(mem_pct|virtual_pct|swap_pct)$/;

const HEALTHY_STATUS = /^(running|online)$/i;
const READONLY_PATH = /(rofs|squashfs|readonly|iso9660)/i;

const DISK_WARN = 90;
const MEM_WARN = 95;

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Shortens a fully qualified metric to the part a human recognises.
 * `service:vaultwarden:tasks_running` -> `vaultwarden:tasks_running`
 * `/persistent:usage` -> unchanged, already readable
 */
export function shortLabel(metric) {
  const parts = String(metric || '').split(':');
  if (parts.length >= 3) return `${parts[1]}:${parts[2]}`;
  return String(metric || '');
}

/** Newest row per series (agentid + pluginid + metric). */
export function latestBySeries(rows) {
  const newest = new Map();
  for (const row of rows || []) {
    if (!row) continue;
    const key = `${row.agentid}|${row.pluginid}|${row.metric}`;
    const seen = newest.get(key);
    if (!seen || String(row.timestamp || '') > String(seen.timestamp || '')) {
      newest.set(key, row);
    }
  }
  return [...newest.values()];
}

/**
 * Returns the reasons this panel looks unhealthy. An empty array means the
 * panel is either fine or carries no signal we trust.
 */
export function panelIssues(panel, rows) {
  const issues = [];
  const fallback = String((panel && panel.metric) || '');

  for (const row of latestBySeries(rows)) {
    const name = String(row.metric || fallback);
    const label = shortLabel(name);
    const value = num(row.value);
    const text = typeof row.value === 'string' ? row.value.trim() : null;

    // The agent could not read its target at all; everything else in this
    // dashboard is stale for that agent.
    if (AGENT_ERROR.test(name)) {
      if (value !== null && value > 0) {
        issues.push(`${label}: agent reports an error`);
      }
      continue;
    }

    // A swarm service at zero running tasks is a real outage: every service
    // here is deployed as a single replica.
    const svc = name.match(SERVICE_STATE);
    if (svc) {
      if (value === 0) {
        issues.push(`${svc[1]} is down`);
      }
      continue;
    }

    // Guest status. A stopped container is worth seeing even when the
    // shutdown was planned, which is why this is an issue and not an alarm.
    if (STATUS_METRIC.test(name)) {
      if (text && !HEALTHY_STATUS.test(text)) {
        issues.push(`${label} is ${text}`);
      }
      continue;
    }

    // Disk pressure. Read-only mounts are skipped: a squashfs sits at 100%
    // for its whole life and would flag on every single refresh.
    if (DISK_METRIC.test(name)) {
      if (value !== null && value >= DISK_WARN && !READONLY_PATH.test(label)) {
        issues.push(`${label} at ${value}%`);
      }
      continue;
    }

    // Memory pressure, deliberately set high enough to stay quiet.
    if (MEM_METRIC.test(name)) {
      if (value !== null && value >= MEM_WARN) {
        issues.push(`${label} at ${value}%`);
      }
    }
  }

  return issues;
}

/** Case-insensitive match over title, metric, plugin and comment. */
export function matchesQuery(panel, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    panel?.title || '',
    panel?.metric || '',
    panel?.pluginid || '',
    panel?.comment || '',
  ].join(' ').toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}