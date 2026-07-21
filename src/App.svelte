<script>
  import { onMount } from 'svelte';
  import {
    fetchAlarms, acknowledgeAlarm, fetchVapidPublicKey,
    subscribePush, unsubscribePush,
    fetchGroups, fetchAgents, fetchAgentPlugins,
    fetchAgentPluginMetrics, queryMetrics,
  } from './lib/api.js';

  // ── Tab state ──
  let tab = $state('alarms');

  // ── Alarm state ──
  let openAlarms = $state([]);
  let historyAlarms = $state([]);
  let loading = $state(true);
  let error = $state(null);
  let acking = $state(new Set());

  // ── Push state ──
  let pushSupported = $state(false);
  let pushSubscribed = $state(false);
  let pushLoading = $state(false);
  let pushError = $state('');

  // ── Alarm functions ──
  async function loadAlarms() {
    loading = true;
    error = null;
    try {
      const [open, hist] = await Promise.all([
        fetchAlarms(false), fetchAlarms(true),
      ]);
      openAlarms = open;
      historyAlarms = hist;
    } catch (e) { error = e.message; }
    finally { loading = false; }
  }

  async function ack(id) {
    acking.add(id);
    try { await acknowledgeAlarm(id); await loadAlarms(); }
    catch (e) { error = e.message; }
    finally { acking.delete(id); }
  }

  // ── Push functions ──
  function urlBase64ToUint8Array(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = window.atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0)).buffer;
  }

  function arrBufToB64(buf) {
    const bytes = new Uint8Array(buf);
    return btoa(String.fromCharCode(...bytes));
  }

  async function checkPush() {
    pushSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    if (!pushSupported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      pushSubscribed = !!(await reg.pushManager.getSubscription());
    } catch { pushSupported = false; }
  }

  async function togglePush() {
    pushLoading = true; pushError = '';
    try {
      if (pushSubscribed) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) { await sub.unsubscribe(); await unsubscribePush(sub.endpoint); }
        pushSubscribed = false;
      } else {
        const { public_key } = await fetchVapidPublicKey();
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(public_key),
        });
        await subscribePush({
          endpoint: sub.endpoint,
          p256dh: arrBufToB64(sub.getKey('p256dh')),
          auth: arrBufToB64(sub.getKey('auth')),
        });
        pushSubscribed = true;
      }
    } catch (e) { pushError = e.message || 'Push-Fehler'; }
    finally { pushLoading = false; }
  }

  // ── Metrics state ──
  let groups = $state([]);
  let groupAgents = $state({});
  let agents = $state([]);
  let plugins = $state([]);
  let metricNames = $state([]);
  let metricsData = $state([]);
  let metricsLoading = $state(false);
  let metricsError = $state(null);
  let filters = $state({ group: '', agentid: '', pluginid: '', metric: '', timePreset: '1h' });
  let hasSearched = $state(false);

  const TIME_PRESETS = [
    { label: '1h',  value: '1h' },
    { label: '6h',  value: '6h' },
    { label: '12h', value: '12h' },
    { label: '1d',  value: '1d' },
    { label: '1w',  value: '1w' },
  ];

  function timeFromPreset(preset) {
    const map = { '1h': 1, '6h': 6, '12h': 12, '1d': 24, '1w': 168 };
    const h = map[preset] || 1;
    return new Date(Date.now() - h * 3600000).toISOString();
  }

  async function loadFilterOptions() {
    try {
      const [g, a] = await Promise.all([fetchGroups(), fetchAgents()]);
      groupAgents = g;
      groups = Object.keys(g);
      agents = a;
    } catch (e) { metricsError = e.message; }
  }

  async function onGroupChange() {
    filters.agentid = '';
    filters.pluginid = '';
    filters.metric = '';
    plugins = [];
    metricNames = [];
  }

  async function onAgentChange() {
    filters.pluginid = '';
    filters.metric = '';
    metricNames = [];
    if (filters.agentid) {
      try { plugins = await fetchAgentPlugins(filters.agentid); }
      catch { plugins = []; }
    } else { plugins = []; }
  }

  async function onPluginChange() {
    filters.metric = '';
    if (filters.agentid && filters.pluginid) {
      try { metricNames = await fetchAgentPluginMetrics(filters.agentid, filters.pluginid); }
      catch { metricNames = []; }
    } else { metricNames = []; }
  }

  async function doQuery() {
    metricsLoading = true; metricsError = null; hasSearched = true;
    try {
      const params = {};
      if (filters.group) params.group = filters.group;
      if (filters.agentid) params.agentid = filters.agentid;
      if (filters.pluginid) params.pluginid = filters.pluginid;
      if (filters.metric) params.metric = filters.metric;
      params.from = timeFromPreset(filters.timePreset);
      params.limit = 500;
      metricsData = await queryMetrics(params);
    } catch (e) { metricsError = e.message; }
    finally { metricsLoading = false; }
  }

  // ── Shared ──
  function severityClass(s) {
    if (s === 'critical') return 'sev-critical';
    if (s === 'warning') return 'sev-warning';
    return 'sev-info';
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString();
  }

  function fmtVal(v) {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') return Number.isInteger(v) ? v : v.toFixed(2);
    return String(v);
  }

  onMount(() => {
    loadAlarms();
    checkPush();
    loadFilterOptions();
    const t = setInterval(loadAlarms, 5000);
    return () => clearInterval(t);
  });
</script>

<main>
  <!-- Header -->
  <header>
    <h1>pymon</h1>
    <nav class="tabs">
      <button class="tab" class:active={tab === 'alarms'} onclick={() => tab = 'alarms'}>Alarme</button>
      <button class="tab" class:active={tab === 'metrics'} onclick={() => tab = 'metrics'}>Metriken</button>
    </nav>
    {#if pushSupported}
      <button class="push-btn" onclick={togglePush} disabled={pushLoading}>
        {pushLoading ? '...' : pushSubscribed ? '🔔 An' : '🔕 Aus'}
      </button>
    {/if}
  </header>

  {#if error}
    <div class="error-banner">{error}</div>
  {/if}
  {#if pushError}
    <div class="error-banner push-error">{pushError}</div>
  {/if}

  <!-- ═══════════════ Alarm Tab ═══════════════ -->
  {#if tab === 'alarms'}
    {#if loading && openAlarms.length === 0}
      <section class="loading">Daten werden geladen...</section>
    {:else}
      <section class="alarms-section">
        <h2>Offene Alarme ({openAlarms.length})</h2>
        {#if openAlarms.length === 0}
          <div class="empty">Keine offenen Alarme</div>
        {:else}
          <div class="alarm-list">
            {#each openAlarms as alarm (alarm.id)}
              <div class="alarm-card {severityClass(alarm.severity)}">
                <div class="alarm-header">
                  <span class="severity-badge">{alarm.severity}</span>
                  <span class="rule-id">{alarm.rule_id}</span>
                  <span class="timestamp">{fmtTime(alarm.created_at)}</span>
                </div>
                <div class="alarm-body">
                  <span>Agent: {alarm.agentid}</span>
                  <span>Plugin: {alarm.pluginid}</span>
                  <span>Metrik: {alarm.metric}</span>
                  {#if alarm.value !== null}<span>Wert: {alarm.value}</span>{/if}
                </div>
                <div class="alarm-message">{alarm.message}</div>
                <button class="ack-btn" onclick={() => ack(alarm.id)} disabled={acking.has(alarm.id)}>
                  {acking.has(alarm.id) ? 'Bestätige...' : '✓ Bestätigen'}
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <section class="alarms-section">
        <h2>Verlauf ({historyAlarms.length})</h2>
        {#if historyAlarms.length === 0}
          <div class="empty">Keine historischen Alarme</div>
        {:else}
          <div class="alarm-list">
            {#each historyAlarms as alarm (alarm.id)}
              <div class="alarm-card {severityClass(alarm.severity)}">
                <div class="alarm-header">
                  <span class="severity-badge">{alarm.severity}</span>
                  <span class="rule-id">{alarm.rule_id}</span>
                  <span class="timestamp">{fmtTime(alarm.created_at)}</span>
                </div>
                <div class="alarm-body">
                  <span>Agent: {alarm.agentid}</span>
                  <span>Plugin: {alarm.pluginid}</span>
                  <span>Metrik: {alarm.metric}</span>
                  {#if alarm.value !== null}<span>Wert: {alarm.value}</span>{/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

  <!-- ═══════════════ Metrics Tab ═══════════════ -->
  {:else if tab === 'metrics'}
    <section class="metrics-section">
      <h2>Metriken</h2>

      <div class="filter-bar">
        <select bind:value={filters.group} onchange={onGroupChange}>
          <option value="">Alle Gruppen</option>
          {#each groups as g}
            <option value={g}>{g}</option>
          {/each}
        </select>

        <select bind:value={filters.agentid} onchange={onAgentChange}>
          <option value="">Alle Agenten</option>
          {#each agents as a}
            <option value={a}>{a}</option>
          {/each}
        </select>

        <select bind:value={filters.pluginid} onchange={onPluginChange}>
          <option value="">Alle Plugins</option>
          {#each plugins as p}
            <option value={p}>{p}</option>
          {/each}
        </select>

        <input type="text" placeholder="Metrik-Name..." bind:value={filters.metric} />

        <div class="time-presets">
          {#each TIME_PRESETS as p}
            <button
              class="preset-btn"
              class:active={filters.timePreset === p.value}
              onclick={() => filters.timePreset = p.value}
            >{p.label}</button>
          {/each}
        </div>

        <button class="query-btn" onclick={doQuery} disabled={metricsLoading}>
          {metricsLoading ? 'Suche...' : 'Suchen'}
        </button>
      </div>

      {#if metricsError}
        <div class="error-banner">{metricsError}</div>
      {/if}

      {#if hasSearched}
        {#if metricsData.length === 0}
          <div class="empty">Keine Metriken gefunden</div>
        {:else}
          <div class="metrics-table-wrap">
            <table class="metrics-table">
              <thead>
                <tr>
                  <th>Zeit</th>
                  <th>Agent</th>
                  <th>Plugin</th>
                  <th>Metrik</th>
                  <th>Wert</th>
                  <th>Alarm</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each metricsData as row (row.timestamp + row.agentid + row.pluginid + row.metric)}
                  <tr>
                    <td class="cell-time">{fmtTime(row.timestamp)}</td>
                    <td>{row.agentid}</td>
                    <td>{row.pluginid}</td>
                    <td>{row.metric}</td>
                    <td class="cell-value">{fmtVal(row.value)}</td>
                    <td>
                      {#if row.alarm_id}
                        <span class="alarm-link">#{row.alarm_id}</span>
                      {:else}
                        <span class="no-alarm">—</span>
                      {/if}
                    </td>
                    <td>
                      {#if row.alarm_id}
                        <span class="ack-badge" class:ackd={row.acknowledged}>
                          {row.acknowledged ? 'Bestätigt' : 'Offen'}
                        </span>
                      {:else}
                        <span class="no-alarm">—</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <div class="metric-count">{metricsData.length} Einträge</div>
        {/if}
      {/if}
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 960px; margin: 0 auto; padding: 1.5rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1a1a2e;
  }

  header {
    display: flex; align-items: center; gap: 0.75rem;
    margin-bottom: 1.5rem; flex-wrap: wrap;
  }

  header h1 { margin: 0; font-size: 1.8rem; font-weight: 700; }

  .tabs { display: flex; gap: 0; margin-left: 0.5rem; }
  .tab {
    background: transparent; border: 1px solid #cbd5e0; padding: 0.4rem 1rem;
    cursor: pointer; font-size: 0.85rem; color: #555;
  }
  .tab:first-child { border-radius: 6px 0 0 6px; }
  .tab:last-child  { border-radius: 0 6px 6px 0; }
  .tab.active { background: #4361ee; color: #fff; border-color: #4361ee; }

  .push-btn {
    margin-left: auto; background: transparent; border: 1px solid #cbd5e0;
    border-radius: 6px; padding: 0.4rem 0.7rem; cursor: pointer; font-size: 0.85rem;
  }
  .push-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .error-banner {
    background: #fde8e8; color: #c53030; border: 1px solid #f5c6c6;
    border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 1rem;
  }

  .loading { text-align: center; padding: 3rem; color: #888; }

  .alarms-section { margin-bottom: 2rem; }
  .alarms-section h2 {
    font-size: 1.2rem; font-weight: 600; margin: 0 0 0.75rem 0;
    padding-bottom: 0.4rem; border-bottom: 2px solid #e2e8f0;
  }

  .empty { text-align: center; padding: 2rem; color: #aaa; font-style: italic; }

  .alarm-list { display: flex; flex-direction: column; gap: 0.6rem; }

  .alarm-card {
    border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;
    background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .alarm-card.sev-critical { border-left: 4px solid #e53e3e; }
  .alarm-card.sev-warning  { border-left: 4px solid #dd6b20; }
  .alarm-card.sev-info     { border-left: 4px solid #3182ce; }

  .alarm-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; }
  .severity-badge {
    display: inline-block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
    padding: 0.15rem 0.45rem; border-radius: 4px; background: #edf2f7;
  }
  .sev-critical .severity-badge { background: #fed7d7; color: #c53030; }
  .sev-warning .severity-badge  { background: #feebc8; color: #c05621; }
  .sev-info .severity-badge     { background: #bee3f8; color: #2b6cb0; }

  .rule-id { font-weight: 600; font-size: 0.9rem; }
  .timestamp { margin-left: auto; font-size: 0.78rem; color: #888; }
  .alarm-body { display: flex; flex-wrap: wrap; gap: 0.8rem; font-size: 0.82rem; color: #555; margin-bottom: 0.3rem; }
  .alarm-message { font-size: 0.8rem; color: #777; margin-bottom: 0.5rem; word-break: break-word; }
  .ack-btn {
    background: #38a169; color: #fff; border: none; border-radius: 5px;
    padding: 0.3rem 0.8rem; cursor: pointer; font-size: 0.8rem;
  }
  .ack-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  /* ── Metrics Tab ── */
  .metrics-section { margin-bottom: 2rem; }
  .metrics-section h2 { font-size: 1.2rem; font-weight: 600; margin: 0 0 0.75rem 0; }

  .filter-bar {
    display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;
    padding: 0.75rem; background: #fff; border: 1px solid #e2e8f0;
    border-radius: 8px; margin-bottom: 1rem;
  }

  .filter-bar select, .filter-bar input {
    padding: 0.4rem 0.6rem; border: 1px solid #cbd5e0; border-radius: 5px;
    font-size: 0.82rem; background: #fff; min-width: 120px;
  }

  .filter-bar input { flex: 1; min-width: 140px; }

  .time-presets { display: flex; gap: 0; }
  .preset-btn {
    background: #fff; border: 1px solid #cbd5e0; padding: 0.35rem 0.65rem;
    cursor: pointer; font-size: 0.78rem; color: #555;
  }
  .preset-btn:first-child { border-radius: 5px 0 0 5px; }
  .preset-btn:last-child  { border-radius: 0 5px 5px 0; }
  .preset-btn.active { background: #4361ee; color: #fff; border-color: #4361ee; }

  .query-btn {
    background: #4361ee; color: #fff; border: none; border-radius: 5px;
    padding: 0.4rem 1rem; cursor: pointer; font-size: 0.85rem;
  }
  .query-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .metrics-table-wrap { overflow-x: auto; }
  .metrics-table {
    width: 100%; border-collapse: collapse; font-size: 0.8rem;
  }
  .metrics-table th {
    text-align: left; padding: 0.5rem 0.6rem;
    border-bottom: 2px solid #e2e8f0; font-weight: 600; color: #555;
    white-space: nowrap;
  }
  .metrics-table td {
    padding: 0.4rem 0.6rem; border-bottom: 1px solid #edf2f7;
    font-family: 'SFMono-Regular', Consolas, monospace;
  }
  .metrics-table tbody tr:hover { background: #f7fafc; }
  .cell-time { white-space: nowrap; font-size: 0.75rem; }
  .cell-value { text-align: right; font-weight: 600; }

  .alarm-link {
    display: inline-block; background: #fed7d7; color: #c53030;
    padding: 0.1rem 0.4rem; border-radius: 3px; font-size: 0.75rem; font-weight: 600;
  }
  .no-alarm { color: #ccc; }
  .ack-badge {
    display: inline-block; font-size: 0.7rem; padding: 0.1rem 0.4rem;
    border-radius: 3px; background: #feebc8; color: #c05621;
  }
  .ack-badge.ackd { background: #c6f6d5; color: #276749; }

  .metric-count {
    text-align: right; font-size: 0.78rem; color: #888; margin-top: 0.4rem;
  }
</style>
