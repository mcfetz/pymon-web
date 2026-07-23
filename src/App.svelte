<script>
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import MetricsChart from './lib/MetricsChart.svelte';
  import ConfigView from './lib/ConfigView.svelte';
  import {
    fetchAlarms, acknowledgeAlarm, fetchVapidPublicKey,
    subscribePush, unsubscribePush,
    fetchGroups, fetchAgents, fetchAgentPlugins,
    fetchAgentPluginMetrics, queryMetrics,
    fetchSnoozed, toggleSnooze,
    login, setToken, isLoggedIn,
  } from './lib/api.js';
  import { initTheme } from './lib/theme.svelte.js';
  import Header from './lib/components/Header.svelte';
  import BottomNav from './lib/components/BottomNav.svelte';
  import LoginPage from './lib/components/LoginPage.svelte';
  import AlarmList from './lib/components/AlarmList.svelte';
  import MetricsView from './lib/components/MetricsView.svelte';
  import AccountPage from './lib/components/AccountPage.svelte';
  import PageHeader from './lib/components/PageHeader.svelte';
  import { Bell, Clock, ChartArea, Cog } from 'lucide-svelte';
  import { updateAccount } from './lib/api.js';

  initTheme();

  // ── Tab state ──
  let tab = $state('alarms');
  let loggedIn = $state(isLoggedIn());
  let loginUser = $state('');
  let loginPass = $state('');
  let loginError = $state('');
  let loginLoading = $state(false);

  async function handleLogin(user, pass) {
    loginError = '';
    loginLoading = true;
    try {
      const res = await login(user, pass);
      setToken(res.token);
      loggedIn = true;
      loginUser = ''; loginPass = '';
    } catch (e) { loginError = e.message; }
    finally { loginLoading = false; }
  }

  function handleLogout() {
    setToken(null);
    loggedIn = false;
  }

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
    for (const a of openAlarms) map[a.rule_id] = (map[a.rule_id] || 0) + 1;
    return map;
  });

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

  let severityFilter = $state(new Set(['warning', 'critical', 'info']));
  let severityCounts = $derived.by(() => {
    const counts = { warning: 0, critical: 0, info: 0 };
    for (const a of openAlarms) counts[a.severity] = (counts[a.severity] || 0) + 1;
    return counts;
  });
  let filteredStacks = $derived(alarmGroups.stacks.filter(g => severityFilter.has(g.alarms[0].severity)));
  let filteredSingles = $derived(alarmGroups.singles.filter(a => severityFilter.has(a.severity)));
  // History severity filter
  let histSeverityFilter = $state(new Set(['warning', 'critical', 'info']));
  let histFilteredStacks = $derived(historyGroups.stacks.filter(g => histSeverityFilter.has(g.alarms[0].severity)));
  let histFilteredSingles = $derived(historyGroups.singles.filter(a => histSeverityFilter.has(a.severity)));
  let snoozedSet = $state(new Set());
  let alarmsTruncated = $state(false);
  let historyTruncated = $state(false);

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
    } catch (e) {
      console.error('loadSnoozed failed:', e);
    }
  }

  async function loadAlarms() {
    loading = true; error = null;
    try {
      const [openRes, histRes] = await Promise.all([fetchAlarms(false), fetchAlarms(true)]);
      openAlarms = openRes.alarms;
      historyAlarms = histRes.alarms;
      alarmsTruncated = openRes.truncated;
      historyTruncated = histRes.truncated;
    } catch (e) { error = e.message; }
    finally { loading = false; }
  }

  async function ackAll() {
    if (!confirm(`Acknowledge all ${openAlarms.length} open alarms?`)) return;
    const ids = openAlarms.map(a => a.id);
    acking = new Set(ids);
    try {
      const results = await Promise.allSettled(ids.map(id => acknowledgeAlarm(id)));
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length) error = `${failed.length} alarm(s) could not be acknowledged`;
      await loadAlarms();
      await loadSnoozed();
    } finally { acking = new Set(); }
  }

  async function ack(id) {
    acking = new Set([...acking, id]);
    try { 
      await acknowledgeAlarm(id);
      openAlarms = openAlarms.filter(a => a.id !== id);
      await loadSnoozed(); 
    }
    catch (e) { error = e.message; }
    finally { acking = new Set(); }
  }

  async function ackRule(ruleId, agentid, pluginid, metric) {
    const ids = openAlarms.filter(a => a.rule_id === ruleId && a.agentid === agentid && a.pluginid === pluginid && a.metric === metric).map(a => a.id);
    acking = new Set([...acking, ...ids]);
    try { await Promise.all(ids.map(id => acknowledgeAlarm(id))); await loadAlarms(); await loadSnoozed(); }
    catch (e) { error = e.message; }
    finally { acking = new Set([...acking].filter(x => !ids.includes(x))); }
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
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(public_key) });
        await subscribePush({ endpoint: sub.endpoint, p256dh: arrBufToB64(sub.getKey('p256dh')), auth: arrBufToB64(sub.getKey('auth')) });
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
  let filters = $state({ group: '', agentid: [], pluginid: '', metric: '', timePreset: '1h' });
  let hasSearched = $state(false);
  let sortCol = $state('timestamp');
  let sortDir = $state('desc');
  let page = $state(0);
  let pageSize = $state(50);

  let filteredAgents = $derived.by(() => {
    if (!filters.group) return agents;
    const ids = groupAgents[filters.group];
    if (!ids) return [];
    return agents.filter(a => ids.includes(a.id));
  });
  let agentTitleMap = $derived.by(() => {
    const m = {};
    for (const a of agents) m[a.id] = a.title;
    return m;
  });
  let pluginTitleMap = $derived.by(() => {
    const m = {};
    for (const p of plugins) m[p.id] = p.title;
    return m;
  });

  let pendingRule = $state(null);

  function openRule(ruleId) {
    pendingRule = { id: ruleId, ts: Date.now() };
    tab = 'config';
  }
  async function jumpToHistory(agentid, pluginid, metric) {
    filters.timePreset = '1h';
    filters.agentid = [agentid];
    await onAgentChange();
    filters.pluginid = pluginid;
    await onPluginChange();
    filters.metric = metric;
    await doQuery();
    tab = 'metrics';
  }

  const TIME_PRESETS = [
    { label: '1h', value: '1h' }, { label: '6h', value: '6h' },
    { label: '12h', value: '12h' }, { label: '1d', value: '1d' }, { label: '1w', value: '1w' },
  ];
  function timeFromPreset(preset) {
    const map = { '1h': 1, '6h': 6, '12h': 12, '1d': 24, '1w': 168 };
    return new Date(Date.now() - (map[preset] || 1) * 3600000).toISOString();
  }

  async function loadFilterOptions() {
    try {
      const [g, a] = await Promise.all([fetchGroups(), fetchAgents()]);
      groupAgents = g; groups = Object.keys(g); agents = a;
    } catch (e) { metricsError = e.message; }
  }
  async function onGroupChange() {
    filters.agentid = []; filters.pluginid = ''; filters.metric = '';
    plugins = []; metricNames = [];
  }
  async function onAgentChange() {
    filters.pluginid = ''; filters.metric = ''; metricNames = [];
    if (filters.agentid.length > 0) {
      try {
        const results = await Promise.all(filters.agentid.map(a => fetchAgentPlugins(a)));
        const merged = new Map();
        for (const list of results) for (const p of list) {
          const pid = p.id || p;
          if (!merged.has(pid)) merged.set(pid, { id: pid, title: p.title || pid });
        }
        plugins = [...merged.values()].sort((a, b) => a.title.localeCompare(b.title));
      } catch { plugins = []; }
    } else { plugins = []; }
  }
  async function onPluginChange() {
    filters.metric = '';
    if (filters.agentid.length === 1 && filters.pluginid) {
      try { metricNames = await fetchAgentPluginMetrics(filters.agentid[0], filters.pluginid); }
      catch { metricNames = []; }
    } else { metricNames = []; }
  }
  async function doQuery() {
    metricsLoading = true; metricsError = null; hasSearched = true; page = 0;
    try {
      const params = {};
      if (filters.group) params.group = filters.group;
      if (filters.agentid.length > 0) params.agentid = filters.agentid.join(',');
      if (filters.pluginid) params.pluginid = filters.pluginid;
      if (filters.metric) params.metric = filters.metric;
      params.from = timeFromPreset(filters.timePreset);
      params.limit = 500;
      const raw = await queryMetrics(params);
      metricsData = raw.map(row => ({ ...row, agent_title: agentTitleMap[row.agentid] || row.agentid, plugin_title: pluginTitleMap[row.pluginid] || row.pluginid }));
    } catch (e) { metricsError = e.message; }
    finally { metricsLoading = false; }
  }

  function toggleSort(col) {
    if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortCol = col; sortDir = 'asc'; }
    page = 0;
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

  let metricsStats = $derived.by(() => {
    if (!metricsData.length) return [];
    const groups = {};
    for (const row of metricsData) {
      if (typeof row.value !== 'number') continue;
      const key = `${row.agent_title} > ${row.plugin_title} > ${row.metric}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row.value);
    }
    return Object.entries(groups).map(([label, vals]) => {
      let min = Infinity, max = -Infinity, sum = 0;
      for (const v of vals) { if (v < min) min = v; if (v > max) max = v; sum += v; }
      const avg = sum / vals.length;
      const delta = vals[vals.length - 1] - vals[0];
      return { label, min, max, avg, delta, count: vals.length };
    }).sort((a, b) => a.label.localeCompare(b.label));
  });

  async function handleAccountSave({ username, curPw, newPw }) {
    try {
      const body = { current_password: curPw };
      if (username) body.new_username = username;
      if (newPw) body.new_password = newPw;
      const res = await updateAccount(body);
      if (res.token) setToken(res.token);
    } catch (e) {
      error = e.message;
    }
  }

  function handleNavigate(v) { tab = v; }

  onMount(() => {
    if (!loggedIn) return;
    loadAlarms(); checkPush(); loadFilterOptions(); loadSnoozed();
    const t = setInterval(() => { loadAlarms(); loadSnoozed(); }, 5000);
    return () => clearInterval(t);
  });

  window.addEventListener('pymon:logout', () => { loggedIn = false; });
</script>

<main class="min-h-screen pb-24" style="background: var(--bg-app)">
  {#if !loggedIn}
    <LoginPage error={loginError} loading={loginLoading} onsubmit={handleLogin} />
  {:else}
    <Header onAccount={() => tab = 'account'} />

    {#if error}
      <div class="mx-auto max-w-xl px-4 mb-4">
        <div class="glass px-4 py-3 rounded-[var(--radius-card)] text-sm text-red-400 border-l-2 border-red-400">{error}</div>
      </div>
    {/if}

    <div class="mx-auto max-w-xl px-4">
      {#if tab === 'alarms'}
        <div class="animate-slide-up">
        <PageHeader icon={Bell} title="Alarms" />
        <AlarmList
          stacks={filteredStacks}
          singles={filteredSingles}
          onAck={ack}
          onAckRule={ackRule}
          onRule={openRule}
          onHistory={jumpToHistory}
          onSnooze={handleToggleSnooze}
          {snoozedSet}
          {acking}
          {expandedStacks}
          onexpand={(key) => { const s = new Set(expandedStacks); if (s.has(key)) s.delete(key); else s.add(key); expandedStacks = s; }}
          {severityFilter}
          {severityCounts}
          onseveritychange={(s) => severityFilter = s}
          truncated={alarmsTruncated}
        />
        </div>
      {:else if tab === 'history'}
        <div class="animate-slide-up">
        <PageHeader icon={Clock} title="History" />
        {#if historyAlarms.length > 0}
          <AlarmList
            stacks={histFilteredStacks}
            singles={histFilteredSingles}
            onAck={() => {}}
            onAckRule={() => {}}
            onRule={openRule}
            onHistory={jumpToHistory}
            onSnooze={() => {}}
            snoozedSet={new Set()}
            acking={new Set()}
            expandedStacks={expandedHistoryStacks}
            onexpand={(key) => { const s = new Set(expandedHistoryStacks); if (s.has(key)) s.delete(key); else s.add(key); expandedHistoryStacks = s; }}
            severityFilter={histSeverityFilter}
            severityCounts={{}}
            onseveritychange={(s) => histSeverityFilter = s}
            history={true}
            truncated={historyTruncated}
          />
        {:else}
          <div class="text-center py-16 text-sm opacity-50" style="color: var(--text-secondary)">no history</div>
        {/if}
        </div>
      {:else if tab === 'metrics'}
        <div class="animate-slide-up">
        <PageHeader icon={ChartArea} title="Metrics" />
        <MetricsView
          {filters}
          onfilterchange={() => {}}
          ongroupchange={onGroupChange}
          onagentchange={onAgentChange}
          onpluginchange={onPluginChange}
          {doQuery}
          {groups}
          {filteredAgents}
          {plugins}
          {metricNames}
          {metricsData}
          {metricsLoading}
          {metricsError}
          {hasSearched}
          {agentTitleMap}
          {pluginTitleMap}
          {sortedData}
          {pagedData}
          {sortCol}
          {sortDir}
          onSort={toggleSort}
          {page}
          {pageSize}
          {totalPages}
          onPageChange={(p) => page = p}
          {metricsStats}
          chartData={metricsData}
          timePresets={TIME_PRESETS}
        />
        </div>
      {:else if tab === 'config'}
        <div class="animate-slide-up">
        <PageHeader icon={Cog} title="Configuration" />
        <ConfigView {pendingRule} onLogout={handleLogout} onClearPendingRule={() => pendingRule = null} />
        </div>
      {:else if tab === 'account'}
        <div class="animate-slide-up">
        <AccountPage onlogout={handleLogout} onsave={handleAccountSave} />
        </div>
      {/if}
    </div>

    <BottomNav {tab} onNavigate={handleNavigate} alarmCount={openAlarms.length} />
  {/if}
</main>