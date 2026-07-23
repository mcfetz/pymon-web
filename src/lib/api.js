function getToken() {
  return localStorage.getItem('pymon_token');
}

export function setToken(t) {
  if (t) localStorage.setItem('pymon_token', t);
  else localStorage.removeItem('pymon_token');
}

export function isLoggedIn() {
  return !!getToken();
}

export function login(username, password) {
  return fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'login failed');
    }
    return res.json();
  });
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('pymon:logout'));
    throw new Error('session expired');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Alarms ──
export async function fetchAlarms(acknowledged = null) {
  const params = acknowledged !== null ? `?acknowledged=${acknowledged}` : '';
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api/alarms${params}`, { headers });
  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('pymon:logout'));
    throw new Error('session expired');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const alarms = await res.json();
  const truncated = res.headers.get('X-Truncated') === 'true';
  return { alarms, truncated };
}
export function acknowledgeAlarm(id) { return api(`/alarms/${id}/ack`); }
export function fetchAlarm(id) { return api(`/alarms/${id}`); }
export function fetchOpenAlarms() { return api('/alarms/open'); }
export function fetchSnoozed() { return api('/alarms/snoozed'); }
export function toggleSnooze(data) { return api('/alarms/snooze/toggle', { method: 'POST', body: data }); }

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
export function createAgent(id, groups = [], title = '') {
  return api('/admin/agents', { method: 'POST', body: { id, groups, title } });
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
export function setAgentEnabled(agentid, enabled) {
  return api(`/admin/agents/${agentid}/enabled`, { method: 'PUT', body: { enabled } });
}
export function updateAgent(agentid, data) {
  return api(`/admin/agents/${agentid}`, { method: 'PUT', body: data });
}
export function setGroupPlugins(groupid, data) {
  return api(`/admin/groups/${groupid}`, { method: 'PUT', body: data });
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

// ── Notifications ──
export function fetchNotifySchema() { return api('/admin/notifications/schema'); }
export function fetchNotifications() { return api('/admin/notifications'); }
export function saveNotification(id, data) {
  return api(`/admin/notifications/${id}`, { method: 'PUT', body: data });
}
export function deleteNotification(id) {
  return api(`/admin/notifications/${id}`, { method: 'DELETE' });
}
export function testNotification(data) {
  return api('/admin/notifications/test', { method: 'POST', body: data });
}

// ── Plugins ──
export function fetchAdminPlugins() { return api('/admin/plugins'); }
export function fetchPluginTemplate() {
  return fetch('/api/admin/plugins/template', {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  }).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.text(); });
}
export function fetchPluginSource(name) {
  return fetch(`/api/admin/plugins/${name}/source`, {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  }).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.text(); });
}
export function savePluginSource(name, source) {
  return fetch(`/api/admin/plugins/${name}/source`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'text/plain' },
    body: source,
  }).then((r) => { if (!r.ok) throw new Error(r.statusText); return r; });
}
export function checkPluginSource(source) {
  return fetch('/api/admin/plugins/check', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'text/plain' },
    body: source,
  }).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
}
export function deletePlugin(name) {
  return api(`/admin/plugins/${name}`, { method: 'DELETE' });
}
export function togglePluginEnabled(name, enabled) {
  return api(`/admin/plugins/${name}/enabled`, { method: 'PUT', body: { enabled } });
}
export function savePluginMeta(name, data) {
  return api(`/admin/plugins/${name}/meta`, { method: 'PUT', body: data });
}

export function updateAccount(data) {
  return api('/account', { method: 'PUT', body: data });
}

// ── Blackouts ──
export function fetchBlackouts() { return api('/admin/blackouts'); }
export function fetchBlackoutSchema() { return api('/admin/blackouts/schema'); }
export function saveBlackout(id, data) {
  return api(`/admin/blackouts/${id}`, { method: 'PUT', body: data });
}
export function deleteBlackout(id) {
  return api(`/admin/blackouts/${id}`, { method: 'DELETE' });
}