const AGENTID = 'admin';
const API_KEY = '333';

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    method: options.method || 'GET',
    headers: {
      agentid: AGENTID,
      'X-API-Key': API_KEY,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Alarms ──
export function fetchAlarms(acknowledged = null) {
  const params = acknowledged !== null ? `?acknowledged=${acknowledged}` : '';
  return api(`/alarms${params}`);
}
export function acknowledgeAlarm(id) { return api(`/alarms/${id}/ack`); }
export function fetchOpenAlarms() { return api('/alarms/open'); }

// ── Agents / Groups ──
export function fetchAgents() { return api('/agents'); }
export function fetchGroups() { return api('/groups'); }
export function fetchAgentPlugins(agent) { return api(`/agents/${agent}/plugins`); }
export function fetchAgentPluginMetrics(agent, plugin) {
  return api(`/agents/${agent}/plugins/${plugin}/metrics`);
}

// ── Metrics Query ──
export function queryMetrics(params = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return api(`/metrics/query${qs ? '?' + qs : ''}`);
}

// ── Push ──
export function fetchVapidPublicKey() { return api('/vapid-public-key'); }
export function subscribePush(sub) {
  return api('/subscribe', {
    method: 'POST',
    body: { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
  });
}
export function unsubscribePush(endpoint) {
  return api('/unsubscribe', { method: 'POST', body: { endpoint } });
}

// ── Admin Config ──
export function fetchPluginSchemas() { return api('/admin/plugins/schemas'); }
export function fetchAdminAgents() { return api('/admin/agents'); }
export function fetchAdminGroups() { return api('/admin/groups'); }
export function createAgent(id, groups = []) {
  return api('/admin/agents', { method: 'POST', body: { id, groups } });
}
export function deleteAgent(id) {
  return api(`/admin/agents/${id}`, { method: 'DELETE' });
}
export function setAgentGroups(id, groups) {
  return api(`/admin/agents/${id}/groups`, { method: 'PUT', body: { groups } });
}
export function setAgentPluginConfig(agentid, pluginid, config) {
  return api(`/admin/agents/${agentid}/plugins/${pluginid}`, { method: 'PUT', body: config });
}
export function removeAgentPlugin(agentid, pluginid) {
  return api(`/admin/agents/${agentid}/plugins/${pluginid}`, { method: 'DELETE' });
}
export function setGroupPlugins(groupid, plugins) {
  return api(`/admin/groups/${groupid}`, { method: 'PUT', body: { plugins } });
}
export function deleteGroup(groupid) {
  return api(`/admin/groups/${groupid}`, { method: 'DELETE' });
}

// ── Rules ──
export function fetchRuleSchema() { return api('/admin/rules/schema'); }
export function fetchRules() { return api('/admin/rules'); }
export function saveRule(id, rule) {
  return api(`/admin/rules/${id}`, { method: 'PUT', body: rule });
}
export function deleteRule(id) {
  return api(`/admin/rules/${id}`, { method: 'DELETE' });
}

// ── Executors ──
export function fetchExecutors() { return api('/admin/executors'); }
export function saveExecutor(id, data) {
  return api(`/admin/executors/${id}`, { method: 'PUT', body: data });
}
export function deleteExecutor(id) {
  return api(`/admin/executors/${id}`, { method: 'DELETE' });
}