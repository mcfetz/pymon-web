const API_PORT = 5000;
const AGENTID = 'admin';
const API_KEY = '333';

function baseUrl() {
  const host = window.location.hostname;
  return `http://${host}:${API_PORT}`;
}

async function api(path) {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: {
      agentid: AGENTID,
      'X-API-Key': API_KEY,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function fetchAlarms(acknowledged = null) {
  const params = acknowledged !== null ? `?acknowledged=${acknowledged}` : '';
  return api(`/alarms${params}`);
}

export function acknowledgeAlarm(id) {
  return api(`/alarms/${id}/ack`);
}

export function fetchOpenAlarms() {
  return api('/alarms/open');
}

export function fetchAgents() {
  return api('/agents');
}