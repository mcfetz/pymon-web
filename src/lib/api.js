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

export function fetchVapidPublicKey() {
  return api('/vapid-public-key');
}

export function subscribePush(sub) {
  return api('/subscribe', {
    method: 'POST',
    body: { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
  });
}

export function unsubscribePush(endpoint) {
  return api('/unsubscribe', {
    method: 'POST',
    body: { endpoint },
  });
}