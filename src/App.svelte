<script>
  import { onMount } from 'svelte';
  import MetricsChart from './lib/MetricsChart.svelte';
  import ConfigView from './lib/ConfigView.svelte';
  import {
    fetchAlarms, acknowledgeAlarm, fetchVapidPublicKey,
    subscribePush, unsubscribePush,
    fetchGroups, fetchAgents, fetchAgentPlugins,
    fetchAgentPluginMetrics, queryMetrics,
    fetchSnoozed, toggleSnooze,
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

  // ── Alarm derived ──
  let openByRule = $derived.by(() => {
    const map = {};
    for (const a of openAlarms) {
      map[a.rule_id] = (map[a.rule_id] || 0) + 1;
    }
    return map;
  });

  // ── Stacked alarms ──
  let expandedStacks = $state(new Set());
  let expandedHistoryStacks = $state(new Set());

  function groupAlarms(alarms) {
    const groups = {};
    for (const a of alarms) {
      const key = `${a.rule_id}|${a.agentid}|${a.pluginid}|${a.metric}`;
      if (!groups[key]) groups[key] = { key, rule_id: a.rule_id, agentid: a.agentid, pluginid: a.pluginid, metric: a.metric, alarms: [] };
      groups[key].alarms.push(a);
    }
    const stacks = [];
    const singles = [];
    for (const g of Object.values(groups)) {
      g.alarms.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (g.alarms.length > 1) stacks.push(g);
      else singles.push(g.alarms[0]);
    }
    stacks.sort((a, b) => new Date(b.alarms[0].created_at) - new Date(a.alarms[0].created_at));
    singles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { stacks, singles };
  }

  let alarmGroups = $derived(groupAlarms(openAlarms));
  let historyGroups = $derived(groupAlarms(historyAlarms));

  // ── Snooze state ──
  let snoozedSet = $state(new Set());

  async function handleToggleSnooze(alarm) {
    try {
      await toggleSnooze({ rule_id: alarm.rule_id, agentid: alarm.agentid, pluginid: alarm.pluginid, metric: alarm.metric });
      const snoozed = await fetchSnoozed();
      snoozedSet = new Set(snoozed.map(s => `${s.rule_id}|${s.agentid}|${s.pluginid}|${s.metric}`));
    } catch (e) { error = e.message; }
  }

  async function loadSnoozed() {
    try {
      const snoozed = await fetchSnoozed();
      snoozedSet = new Set(snoozed.map(s => `${s.rule_id}|${s.agentid}|${s.pluginid}|${s.metric}`));
    } catch {}
  }

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

  async function ackAll() {
    if (!confirm(`Acknowledge all ${openAlarms.length} open alarms?`)) return;
    const ids = openAlarms.map(a => a.id);
    acking = new Set(ids);
    try { await Promise.all(ids.map(id => acknowledgeAlarm(id))); await loadAlarms(); await loadSnoozed(); }
    catch (e) { error = e.message; }
    finally { acking = new Set(); }
  }

  async function ack(id) {
    acking.add(id);
    try { await acknowledgeAlarm(id); await loadAlarms(); await loadSnoozed(); }
    catch (e) { error = e.message; }
    finally { acking.delete(id); }
  }

  async function ackRule(ruleId) {
    const ids = openAlarms.filter(a => a.rule_id === ruleId).map(a => a.id);
    for (const id of ids) acking.add(id);
    try { await Promise.all(ids.map(id => acknowledgeAlarm(id))); await loadAlarms(); await loadSnoozed(); }
    catch (e) { error = e.message; }
    finally { for (const id of ids) acking.delete(id); }
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
    } catch (e) { pushError = e.message || 'Push error'; }
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
  let sortCol = $state('timestamp');
  let sortDir = $state('desc');
  let page = $state(0);
  let pageSize = $state(50);

  // ── Alarm → Rule/History navigation ──
  let pendingRule = $state(null);

  function openRule(ruleId) {
    pendingRule = { id: ruleId, ts: Date.now() };
    tab = 'config';
  }

  async function jumpToHistory(agentid, pluginid, metric) {
    filters.timePreset = '1h';
    filters.agentid = agentid;
    await onAgentChange();
    filters.pluginid = pluginid;
    await onPluginChange();
    filters.metric = metric;
    await doQuery();
    tab = 'metrics';
  }

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
    metricsLoading = true; metricsError = null; hasSearched = true; page = 0;
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

  // ── Sort & Pagination ──
  function toggleSort(col) {
    if (sortCol === col) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; }
    else { sortCol = col; sortDir = 'asc'; }
    page = 0;
  }

  function sortIcon(col) {
    if (sortCol !== col) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  }

  let sortedData = $derived.by(() => {
    const d = [...metricsData];
    if (!d.length) return d;
    const dir = sortDir === 'asc' ? 1 : -1;
    d.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (va === null || va === undefined) va = '';
      if (vb === null || vb === undefined) vb = '';
      if (typeof va === 'string') return va.localeCompare(vb) * dir;
      return ((va < vb) ? -1 : (va > vb) ? 1 : 0) * dir;
    });
    return d;
  });

  let totalPages = $derived(Math.max(1, Math.ceil(sortedData.length / pageSize)));
  let pagedData = $derived(sortedData.slice(page * pageSize, (page + 1) * pageSize));

  // ── Metrics Stats ──
  let metricsStats = $derived.by(() => {
    if (!metricsData.length) return [];
    const groups = {};
    for (const row of metricsData) {
      if (typeof row.value !== 'number') continue;
      const key = `${row.agentid} › ${row.pluginid} › ${row.metric}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row.value);
    }
    const series = Object.entries(groups).map(([label, vals]) => {
      let min = Infinity, max = -Infinity, sum = 0;
      for (const v of vals) {
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
      }
      const avg = sum / vals.length;
      const delta = vals[vals.length - 1] - vals[0];
      return { label, min, max, avg, delta, count: vals.length };
    });
    return series.sort((a, b) => a.label.localeCompare(b.label));
  });

  // ── Shared ──
  function severityClass(s) {
    if (s === 'critical') return 'sev-critical';
    if (s === 'warning') return 'sev-warning';
    return 'sev-info';
  }

  function fmtTime(iso) {
    if (!iso) return '';
    const s = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
    const d = new Date(s);
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
    loadSnoozed();
    const t = setInterval(() => { loadAlarms(); loadSnoozed(); }, 5000);
    return () => clearInterval(t);
  });
</script>

<main>
  <!-- Header -->
  <header>
    <h1>pymon</h1>
    {#if openAlarms.length > 0}
      {#key openAlarms.length}
        <span class="alarm-badge">{openAlarms.length}</span>
      {/key}
    {/if}
    <nav class="tabs">
      <button class="tab" class:active={tab === 'alarms'} onclick={() => tab = 'alarms'}>Alarms</button>
      <button class="tab" class:active={tab === 'metrics'} onclick={() => tab = 'metrics'}>Metrics</button>
      <button class="tab" class:active={tab === 'config'} onclick={() => tab = 'config'}>Configuration</button>
    </nav>
    {#if pushSupported}
      <button class="push-btn" onclick={togglePush} disabled={pushLoading}>
        {pushLoading ? '...' : pushSubscribed ? '🔔 On' : '🔕 Off'}
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
      <section class="loading">Loading data...</section>
    {:else}
      <section class="alarms-section">
        <div class="section-header">
          <h2>Open Alarms ({openAlarms.length})</h2>
          {#if openAlarms.length > 0}
            <button class="ack-all-btn" onclick={ackAll} disabled={acking.size > 0}>
              {acking.size > 0 ? `Acknowledging ${acking.size}/${openAlarms.length}...` : '✓ Acknowledge All'}
            </button>
          {/if}
        </div>
        {#if openAlarms.length === 0}
          <div class="empty">No open alarms</div>
        {:else}
          <div class="alarm-list">
            {#each alarmGroups.stacks as g (g.key)}
              <div class="alarm-card {severityClass(g.alarms[0].severity)} stack-card" class:expanded={expandedStacks.has(g.key)}>
                <div class="alarm-header">
                  <span class="severity-badge">{g.alarms[0].severity}</span>
                  <span class="rule-id">{g.rule_id}</span>
                  <span class="stack-count">{g.alarms.length}×</span>
                  <span class="timestamp">{fmtTime(g.alarms[0].created_at)}</span>
                </div>
                <div class="alarm-body">
                  <span>Agent: {g.agentid}</span>
                  <span>Plugin: {g.pluginid}</span>
                  <span>Metric: {g.metric}</span>
                </div>
                <div class="alarm-actions">
                  <button class="rule-btn" onclick={() => openRule(g.rule_id)}>Rule</button>
                  <button class="hist-btn" onclick={() => jumpToHistory(g.agentid, g.pluginid, g.metric)}>History</button>
                  <div class="ack-split">
                    <button class="ack-btn ack-this" onclick={() => ack(g.alarms[0].id)} disabled={acking.size > 0} title="Acknowledge latest alarm only">
                      ✓ This
                    </button>
                    <button class="ack-btn ack-rule" onclick={() => ackRule(g.rule_id)} disabled={acking.size > 0} title="Acknowledge all {g.alarms.length} alarms in this stack">
                      ✓ All {g.alarms.length}
                    </button>
                  </div>
                  <button class="snooze-btn" class:active={snoozedSet.has(g.key)} onclick={() => handleToggleSnooze(g.alarms[0])} title={snoozedSet.has(g.key) ? 'Click to unsnooze' : 'Snooze'}>
                    {snoozedSet.has(g.key) ? 'Snoozed' : 'Snooze'}
                  </button>
                  <button class="expand-btn" onclick={() => { const s = new Set(expandedStacks); if (s.has(g.key)) s.delete(g.key); else s.add(g.key); expandedStacks = s; }}>
                    {expandedStacks.has(g.key) ? '▲' : '▼'}
                  </button>
                </div>
                {#if expandedStacks.has(g.key)}
                  <div class="stack-items">
                    {#each g.alarms as alarm}
                      <div class="stack-item">
                        <span class="stack-item-time">{fmtTime(alarm.created_at)}</span>
                        <span class="stack-item-val">Value: {alarm.value ?? '—'}</span>
                        <button class="ack-btn" onclick={() => ack(alarm.id)} disabled={acking.has(alarm.id)} style="margin-left:auto;padding:0.15rem 0.5rem;font-size:0.75rem;">
                          {acking.has(alarm.id) ? '...' : '✓ This'}
                        </button>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
            {#each alarmGroups.singles as alarm (alarm.id)}
              <div class="alarm-card {severityClass(alarm.severity)}">
                <div class="alarm-header">
                  <span class="severity-badge">{alarm.severity}</span>
                  <span class="rule-id">{alarm.rule_id}</span>
                  <span class="timestamp">{fmtTime(alarm.created_at)}</span>
                </div>
                <div class="alarm-body">
                  <span>Agent: {alarm.agentid}</span>
                  <span>Plugin: {alarm.pluginid}</span>
                  <span>Metric: {alarm.metric}</span>
                  {#if alarm.value !== null}<span>Value: {alarm.value}</span>{/if}
                </div>
                <div class="alarm-actions">
                  <button class="rule-btn" onclick={() => openRule(alarm.rule_id)}>Rule</button>
                  <button class="hist-btn" onclick={() => jumpToHistory(alarm.agentid, alarm.pluginid, alarm.metric)}>History</button>
                  <button class="ack-btn" onclick={() => ack(alarm.id)} disabled={acking.has(alarm.id)}>
                    {acking.has(alarm.id) ? 'Acknowledging...' : '✓ Acknowledge'}
                  </button>
                  <button class="snooze-btn" class:active={snoozedSet.has(`${alarm.rule_id}|${alarm.agentid}|${alarm.pluginid}|${alarm.metric}`)} onclick={() => handleToggleSnooze(alarm)} title={snoozedSet.has(`${alarm.rule_id}|${alarm.agentid}|${alarm.pluginid}|${alarm.metric}`) ? 'Click to unsnooze' : 'Snooze'}>
                    {snoozedSet.has(`${alarm.rule_id}|${alarm.agentid}|${alarm.pluginid}|${alarm.metric}`) ? 'Snoozed' : 'Snooze'}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <section class="alarms-section">
        <h2>History ({historyAlarms.length})</h2>
        {#if historyAlarms.length === 0}
          <div class="empty">No historical alarms</div>
        {:else}
          <div class="alarm-list">
            {#each historyGroups.stacks as g (g.key)}
              <div class="alarm-card {severityClass(g.alarms[0].severity)} stack-card" class:expanded={expandedHistoryStacks.has(g.key)}>
                <div class="alarm-header">
                  <span class="severity-badge">{g.alarms[0].severity}</span>
                  <span class="rule-id">{g.rule_id}</span>
                  <span class="stack-count">{g.alarms.length}×</span>
                  <span class="timestamp">{fmtTime(g.alarms[0].created_at)}</span>
                </div>
                <div class="alarm-body">
                  <span>Agent: {g.agentid}</span>
                  <span>Plugin: {g.pluginid}</span>
                  <span>Metric: {g.metric}</span>
                </div>
                <div class="alarm-actions">
                  <button class="rule-btn" onclick={() => openRule(g.rule_id)}>Rule</button>
                  <button class="hist-btn" onclick={() => jumpToHistory(g.agentid, g.pluginid, g.metric)}>History</button>
                  <button class="expand-btn" onclick={() => { const s = new Set(expandedHistoryStacks); if (s.has(g.key)) s.delete(g.key); else s.add(g.key); expandedHistoryStacks = s; }}>
                    {expandedHistoryStacks.has(g.key) ? '▲' : '▼'}
                  </button>
                </div>
                {#if expandedHistoryStacks.has(g.key)}
                  <div class="stack-items">
                    {#each g.alarms as alarm}
                      <div class="stack-item">
                        <span class="stack-item-time">{fmtTime(alarm.created_at)}</span>
                        <span class="stack-item-val">Value: {alarm.value ?? '—'}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
            {#each historyGroups.singles as alarm (alarm.id)}
              <div class="alarm-card {severityClass(alarm.severity)}">
                <div class="alarm-header">
                  <span class="severity-badge">{alarm.severity}</span>
                  <span class="rule-id">{alarm.rule_id}</span>
                  <span class="timestamp">{fmtTime(alarm.created_at)}</span>
                </div>
                <div class="alarm-body">
                  <span>Agent: {alarm.agentid}</span>
                  <span>Plugin: {alarm.pluginid}</span>
                  <span>Metric: {alarm.metric}</span>
                  {#if alarm.value !== null}<span>Value: {alarm.value}</span>{/if}
                </div>
                <div class="alarm-actions">
                  <button class="rule-btn" onclick={() => openRule(alarm.rule_id)}>Rule</button>
                  <button class="hist-btn" onclick={() => jumpToHistory(alarm.agentid, alarm.pluginid, alarm.metric)}>History</button>
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
      <h2>Metrics</h2>

      <div class="filter-bar">
        <select bind:value={filters.group} onchange={onGroupChange}>
          <option value="">All Groups</option>
          {#each groups as g}
            <option value={g}>{g}</option>
          {/each}
        </select>

        <select bind:value={filters.agentid} onchange={onAgentChange}>
          <option value="">All Agents</option>
          {#each agents as a}
            <option value={a}>{a}</option>
          {/each}
        </select>

        <select bind:value={filters.pluginid} onchange={onPluginChange}>
          <option value="">All Plugins</option>
          {#each plugins as p}
            <option value={p}>{p}</option>
          {/each}
        </select>

        <input type="text" placeholder="Metric name..." bind:value={filters.metric} />

        <div class="time-presets">
          {#each TIME_PRESETS as p}
            <button
              class="preset-btn"
              class:active={filters.timePreset === p.value}
              onclick={() => { filters.timePreset = p.value; doQuery(); }}
            >{p.label}</button>
          {/each}
        </div>

        <button class="query-btn" onclick={doQuery} disabled={metricsLoading}>
          {metricsLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {#if metricsError}
        <div class="error-banner">{metricsError}</div>
      {/if}

      {#if hasSearched}
        {#if metricsData.length === 0}
          <div class="empty">No metrics found</div>
        {:else}
          {#key metricsData}
            <MetricsChart data={metricsData} />
          {/key}
          {#if metricsStats.length > 0}
            <div class="metrics-stats">
              {#each metricsStats as s}
                <div class="stat-card">
                  <div class="stat-label">{s.label}</div>
                  <div class="stat-row"><span class="stat-key">Min</span><span class="stat-val">{fmtVal(s.min)}</span></div>
                  <div class="stat-row"><span class="stat-key">Max</span><span class="stat-val">{fmtVal(s.max)}</span></div>
                  <div class="stat-row"><span class="stat-key">Avg</span><span class="stat-val">{fmtVal(s.avg)}</span></div>
                  <div class="stat-row"><span class="stat-key">Δ (last-first)</span><span class="stat-val">{fmtVal(s.delta)}</span></div>
                  <div class="stat-row" style="font-size:0.68rem;color:#aaa;"><span class="stat-key">Samples</span><span class="stat-val">{s.count}</span></div>
                </div>
              {/each}
            </div>
          {/if}
          <div class="metrics-table-wrap">
            <table class="metrics-table">
              <thead>
                <tr>
                  <th class="sortable" onclick={() => toggleSort('timestamp')}>
                    Time <span class="sort-icon">{sortIcon('timestamp')}</span>
                  </th>
                  <th class="sortable" onclick={() => toggleSort('agentid')}>
                    Agent <span class="sort-icon">{sortIcon('agentid')}</span>
                  </th>
                  <th class="sortable" onclick={() => toggleSort('pluginid')}>
                    Plugin <span class="sort-icon">{sortIcon('pluginid')}</span>
                  </th>
                  <th class="sortable" onclick={() => toggleSort('metric')}>
                    Metric <span class="sort-icon">{sortIcon('metric')}</span>
                  </th>
                  <th class="sortable" onclick={() => toggleSort('value')}>
                    Value <span class="sort-icon">{sortIcon('value')}</span>
                  </th>
                  <th>Alarm</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each pagedData as row (row.id)}
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
                          {row.acknowledged ? 'Acknowledged' : 'Open'}
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
          <div class="table-footer">
            <span class="metric-count">{metricsData.length} entries, Page {page + 1}/{totalPages}</span>
            <div class="pagination">
              <button class="page-btn" disabled={page === 0} onclick={() => page = page - 1}>‹</button>
              {#each { length: Math.min(totalPages, 10) } as _, i}
                {@const p = i < 5 ? i : totalPages - (10 - i)}
                {#if p >= 0 && p < totalPages}
                  <button class="page-btn" class:active={p === page} onclick={() => page = p}>{p + 1}</button>
                {/if}
              {/each}
              <button class="page-btn" disabled={page >= totalPages - 1} onclick={() => page = page + 1}>›</button>
            </div>
          </div>
        {/if}
      {/if}
    </section>
  {:else if tab === 'config'}
    <ConfigView pendingRule={pendingRule} />
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
  .alarm-badge {
    display: inline-flex; align-items: center; justify-content: center;
    background: #e53e3e; color: #fff; font-size: 0.7rem; font-weight: 700;
    min-width: 1.2rem; height: 1.2rem; border-radius: 999px; padding: 0 0.25rem;
    position: relative; top: -0.6rem; left: -0.55rem;
    animation: badge-pop 0.3s ease-out;
  }
  @keyframes badge-pop {
    0% { transform: scale(1); }
    50% { transform: scale(1.35); }
    100% { transform: scale(1); }
  }

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
  .section-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; padding-bottom: 0.4rem; border-bottom: 2px solid #e2e8f0; }
  .section-header h2 { font-size: 1.2rem; font-weight: 600; margin: 0; }
  .ack-all-btn {
    margin-left: auto; background: #38a169; color: #fff; border: none; border-radius: 5px;
    padding: 0.3rem 0.8rem; cursor: pointer; font-size: 0.8rem; white-space: nowrap;
  }
  .ack-all-btn:disabled { opacity: 0.6; cursor: not-allowed; }
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
  .stack-card { position: relative; }
  .stack-card.expanded { background: #f7fafc; }
  .stack-count {
    background: #4361ee; color: #fff; font-size: 0.7rem; font-weight: 700;
    padding: 0.1rem 0.4rem; border-radius: 4px; margin-left: 0.3rem;
  }
  .expand-btn {
    background: none; border: 1px solid #cbd5e0; border-radius: 5px;
    padding: 0.2rem 0.5rem; cursor: pointer; font-size: 0.75rem; color: #666;
  }
  .stack-items {
    margin-top: 0.5rem; border-top: 1px solid #e2e8f0; padding-top: 0.4rem;
    display: flex; flex-direction: column; gap: 0.25rem;
  }
  .stack-item {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.25rem 0.4rem; border-radius: 4px; font-size: 0.78rem;
  }
  .stack-item:hover { background: #edf2f7; }
  .stack-item-time { color: #888; font-size: 0.72rem; white-space: nowrap; }
  .stack-item-val { font-family: monospace; color: #555; }

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
  .alarm-actions { display: flex; gap: 0.4rem; align-items: center; }
  .rule-btn {
    background: #4361ee; color: #fff; border: none; border-radius: 5px;
    padding: 0.3rem 0.7rem; cursor: pointer; font-size: 0.8rem;
  }
  .rule-btn:hover { background: #3651d4; }
  .hist-btn {
    background: #805ad5; color: #fff; border: none; border-radius: 5px;
    padding: 0.3rem 0.7rem; cursor: pointer; font-size: 0.8rem;
  }
  .hist-btn:hover { background: #6b46c1; }
  .ack-btn {
    background: #38a169; color: #fff; border: none; border-radius: 5px;
    padding: 0.3rem 0.8rem; cursor: pointer; font-size: 0.8rem;
  }
  .ack-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .ack-split { display: flex; border-radius: 5px; overflow: hidden; }
  .ack-split .ack-btn { border-radius: 0; }
  .ack-split .ack-this { border-right: 1px solid #fff3; }
  .ack-split .ack-rule { background: #2f855a; }
  .ack-split .ack-rule:hover { background: #276749; }
  .snooze-btn {
    background: #edf2f7; border: 1px solid #cbd5e0; border-radius: 5px;
    padding: 0.3rem 0.6rem; cursor: pointer; font-size: 0.78rem; color: #555;
  }
  .snooze-btn.active { background: #fefcbf; border-color: #d69e2e; color: #975a16; }

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
  .metrics-table th.sortable { cursor: pointer; user-select: none; }
  .metrics-table th.sortable:hover { background: #f7fafc; }
  .sort-icon { font-size: 0.7rem; color: #aaa; margin-left: 0.2rem; }
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

  /* ── Metrics Stats ── */
  .metrics-stats { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
  .stat-card {
    border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.6rem 0.8rem;
    background: #fafafa; min-width: 200px; flex: 1;
  }
  .stat-label { font-size: 0.78rem; font-weight: 600; color: #555; margin-bottom: 0.3rem; word-break: break-all; }
  .stat-row { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.78rem; padding: 0.1rem 0; }
  .stat-key { color: #888; }
  .stat-val { font-weight: 600; font-family: 'SFMono-Regular', Consolas, monospace; }

  .metric-count {
    text-align: right; font-size: 0.78rem; color: #888; margin-top: 0.4rem;
  }
  .table-footer {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 0.5rem; flex-wrap: wrap; gap: 0.5rem;
  }
  .pagination { display: flex; gap: 0; }
  .page-btn {
    background: #fff; border: 1px solid #cbd5e0; padding: 0.3rem 0.6rem;
    cursor: pointer; font-size: 0.78rem; color: #555; min-width: 2rem;
  }
  .page-btn:first-child { border-radius: 5px 0 0 5px; }
  .page-btn:last-child  { border-radius: 0 5px 5px 0; }
  .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .page-btn.active { background: #4361ee; color: #fff; border-color: #4361ee; }
  .page-btn:not(:disabled):hover { background: #edf2f7; }
</style>
