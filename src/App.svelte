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
    fetchRules, fetchAdminPlugins, fetchAdminGroups,
    login, setToken, isLoggedIn,
  } from './lib/api.js';
  import { initTheme } from './lib/theme.svelte.js';
  import Header from './lib/components/Header.svelte';
  import BottomNav from './lib/components/BottomNav.svelte';
  import LoginPage from './lib/components/LoginPage.svelte';
  import AlarmList from './lib/components/AlarmList.svelte';
  import AlarmDetailModal from './lib/components/AlarmDetailModal.svelte';
  import MetricsView from './lib/components/MetricsView.svelte';
  import AccountPage from './lib/components/AccountPage.svelte';
  import PageHeader from './lib/components/PageHeader.svelte';
  import Bell from 'lucide-svelte/icons/bell';
  import Clock from 'lucide-svelte/icons/clock';
  import ChartArea from 'lucide-svelte/icons/chart-area';
  import Cog from 'lucide-svelte/icons/cog';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import { updateAccount } from './lib/api.js';

  initTheme();
  const AGENT_STATUS_PLUGIN = { id: 'agent', title: 'Agent status' };
  const appVersion = typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : 'dev';

  // ── Version & Update state ──
  let updateAvailable = $state(false);
  let availableVersion = $state('');
  let reloading = $state(false);

  async function checkVersion() {
    try {
      const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.version && data.version !== appVersion && appVersion !== 'dev') {
        updateAvailable = true;
        availableVersion = data.version;
      }
    } catch {
      // Ignore network errors
    }
  }

  async function applyUpdate() {
    reloading = true;
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      }
    } catch {}
    window.location.reload();
  }

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
    const merged = [];
    for (const g of Object.values(groups)) {
      g.alarms.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (g.alarms.length > 1) stacks.push(g);
      else singles.push(g.alarms[0]);
      merged.push(g);
    }
    stacks.sort((a, b) => new Date(b.alarms[0].created_at) - new Date(a.alarms[0].created_at));
    singles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    merged.sort((a, b) => {
      const aLatest = a.alarms ? a.alarms[0].created_at : a.created_at;
      const bLatest = b.alarms ? b.alarms[0].created_at : b.created_at;
      return new Date(bLatest) - new Date(aLatest);
    });
    return { stacks, singles, merged };
  }

  let alarmGroups = $derived(groupAlarms(openAlarms));
  let historyGroups = $derived(groupAlarms(historyAlarms));
  let snoozedSet = $state(new Set());

  function isAlarmVisible(a, sevFilter, snoozed) {
    const key = a.key || `${a.rule_id}|${a.agentid}|${a.pluginid}|${a.metric}`;
    const isSnoozed = snoozed.has(key);
    const severity = a.severity || (a.alarms && a.alarms[0] && a.alarms[0].severity);

    const hasAnySev = ['critical', 'warning', 'info'].some(s => sevFilter.has(s));

    if (!hasAnySev && sevFilter.has('snoozed')) {
      return isSnoozed;
    }

    if (!sevFilter.has(severity)) return false;
    if (isSnoozed && !sevFilter.has('snoozed')) return false;
    return true;
  }

  let severityFilter = $state(new Set(['warning', 'critical', 'info']));
  let severityCounts = $derived.by(() => {
    const counts = { warning: 0, critical: 0, info: 0, snoozed: 0 };
    for (const a of openAlarms) {
      const key = `${a.rule_id}|${a.agentid}|${a.pluginid}|${a.metric}`;
      if (snoozedSet.has(key)) {
        counts.snoozed = (counts.snoozed || 0) + 1;
      } else {
        counts[a.severity] = (counts[a.severity] || 0) + 1;
      }
    }
    return counts;
  });
  let filteredStacks = $derived(alarmGroups.stacks.filter(g => isAlarmVisible(g, severityFilter, snoozedSet)));
  let filteredSingles = $derived(alarmGroups.singles.filter(a => isAlarmVisible(a, severityFilter, snoozedSet)));
  let filteredMerged = $derived(alarmGroups.merged.filter(g => isAlarmVisible(g, severityFilter, snoozedSet)));
  // History severity filter
  let histSeverityFilter = $state(new Set(['warning', 'critical', 'info']));
  let histFilteredStacks = $derived(filteredHistoryGroups.stacks.filter(g => histSeverityFilter.has(g.alarms[0].severity)));
  let histFilteredSingles = $derived(filteredHistoryGroups.singles.filter(a => histSeverityFilter.has(a.severity)));
  let histFilteredMerged = $derived(filteredHistoryGroups.merged.filter(g => histSeverityFilter.has(g.alarms[0].severity)));
  let alarmsTruncated = $state(false);
  let historyTruncated = $state(false);
  let lastApiOk = $state(0);

  function handleSeverityClick(sev) {
    if (sev === 'snoozed') {
      const next = new Set(severityFilter);
      if (next.has('snoozed')) next.delete('snoozed'); else next.add('snoozed');
      severityFilter = next;
    } else {
      severityFilter = new Set([sev]);
    }
    tab = 'alarms';
  }

  // ── History date range ──
  let historyDateLabels = $state([]);
  let historyDateStart = $state('');
  let historyDateEnd = $state('');
  let historyRangeInitialized = false;

  function dateYMD(iso) {
    const s = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
    return new Date(s).toISOString().slice(0, 10);
  }

  function buildDateRange(alarms) {
    if (!alarms.length) { historyDateLabels = []; return; }
    const dates = [...new Set(alarms.map(a => dateYMD(a.created_at)))].sort();
    historyDateLabels = dates;
    if (!historyRangeInitialized) {
      historyRangeInitialized = true;
      const today = new Date().toISOString().slice(0, 10);
      const todayIdx = dates.indexOf(today);
      if (todayIdx >= 0) {
        historyDateStart = dates[Math.max(0, todayIdx - 1)];
        historyDateEnd = dates[todayIdx];
      } else {
        historyDateStart = dates[Math.max(0, dates.length - 2)];
        historyDateEnd = dates[dates.length - 1];
      }
    }
  }

  let filteredHistoryAlarms = $derived.by(() => {
    if (!historyDateLabels.length || !historyDateStart || !historyDateEnd) return historyAlarms;
    return historyAlarms.filter(a => {
      const d = dateYMD(a.created_at);
      return d >= historyDateStart && d <= historyDateEnd;
    });
  });

  let filteredHistoryGroups = $derived(groupAlarms(filteredHistoryAlarms));

  async function handleToggleSnooze(alarm, duration = null) {
    try {
      const payload = { rule_id: alarm.rule_id, agentid: alarm.agentid, pluginid: alarm.pluginid, metric: alarm.metric };
      if (duration) payload.duration = duration;
      await toggleSnooze(payload);
      const snoozed = await fetchSnoozed();
      snoozedSet = new Set(snoozed.map(s => `${s.rule_id}|${s.agentid}|${s.pluginid}|${s.metric}`));
    } catch (e) { error = e.message; }
  }

  async function loadSnoozed() {
    try {
      const snoozed = await fetchSnoozed();
      snoozedSet = new Set(snoozed.map(s => `${s.rule_id}|${s.agentid}|${s.pluginid}|${s.metric}`));
      lastApiOk = Date.now();
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
      buildDateRange(historyAlarms);
      lastApiOk = Date.now();
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
  let plugins = $state([AGENT_STATUS_PLUGIN]);
  let metricNames = $state([]);
  let metricsData = $state([]);
  let metricsLoading = $state(false);
  let metricsError = $state(null);
  let filters = $state({ group: '', agentid: [], pluginid: '', metric: '', timePreset: '1h', until: '' });
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
  let alarmDetailId = $state(null);

  // Rule title map for alarm cards
  let rules = $state({});
  let ruleTitleMap = $derived(
    Object.fromEntries(Object.entries(rules).map(([id, r]) => [id, r.title || id]))
  );

  // Plugin label map for alarm cards (label from admin plugins metadata)
  let pluginLabelMap = $state({});
  let groupTitleMap  = $state({});

  function openAlarmDetail(id) {
    if (id == null) return;
    alarmDetailId = id;
    window.location.hash = `#alarm/${id}`;
  }

  function closeAlarmDetail() {
    alarmDetailId = null;
    history.pushState('', document.title, window.location.pathname + window.location.search);
  }

  function openRule(ruleId) {
    pendingRule = { id: ruleId, ts: Date.now() };
    tab = 'config';
  }
  async function jumpToHistory(agentid, pluginid, metric) {
    filters.timePreset = '1h';
    filters.until = '';
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
  function timeFromPreset(preset, untilStr) {
    const map = { '1h': 1, '6h': 6, '12h': 12, '1d': 24, '1w': 168 };
    const hours = map[preset] || 1;
    const untilDate = untilStr ? new Date(untilStr) : null;
    const baseTime = (untilDate && !isNaN(untilDate.getTime())) ? untilDate.getTime() : Date.now();
    return new Date(baseTime - hours * 3600000).toISOString();
  }

  async function loadFilterOptions() {
    try {
      const [g, a, adminGroups] = await Promise.all([fetchGroups(), fetchAgents(), fetchAdminGroups()]);
      const nextGroups = Object.keys(adminGroups);
      const nextAgentIds = new Set(a.map(agent => agent.id));
      const groupWasRemoved = filters.group && !nextGroups.includes(filters.group);
      const nextAgentSelection = filters.agentid.filter(agentid => nextAgentIds.has(agentid));
      const agentsWereRemoved = nextAgentSelection.length !== filters.agentid.length;
      groupAgents = g;
      groups = nextGroups;
      agents = a;
      // Build title map: group_id → title (falls back to id)
      groupTitleMap = Object.fromEntries(
        Object.entries(adminGroups).map(([id, grp]) => [id, grp?.title || id])
      );
      if (groupWasRemoved) filters.group = '';
      if (agentsWereRemoved) filters.agentid = nextAgentSelection;
      if (groupWasRemoved || agentsWereRemoved) {
        filters.pluginid = '';
        filters.metric = '';
        plugins = [AGENT_STATUS_PLUGIN];
        metricNames = [];
      }
    } catch (e) { metricsError = e.message; }
  }
  async function onGroupChange() {
    filters.agentid = []; filters.pluginid = ''; filters.metric = '';
    plugins = [AGENT_STATUS_PLUGIN]; metricNames = [];
  }
  async function onAgentChange() {
    filters.pluginid = ''; filters.metric = ''; metricNames = [];
    if (filters.agentid.length > 0) {
      try {
        const results = await Promise.all(filters.agentid.map(a => fetchAgentPlugins(a)));
        const merged = new Map([[AGENT_STATUS_PLUGIN.id, AGENT_STATUS_PLUGIN]]);
        for (const list of results) for (const p of list) {
          const pid = p.id || p;
          if (!merged.has(pid)) merged.set(pid, { id: pid, title: p.title || pid });
        }
        plugins = [...merged.values()].sort((a, b) => a.title.localeCompare(b.title));
      } catch { plugins = [AGENT_STATUS_PLUGIN]; }
    } else { plugins = [AGENT_STATUS_PLUGIN]; }
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
      params.from = timeFromPreset(filters.timePreset, filters.until);
      const untilDate = filters.until ? new Date(filters.until) : null;
      if (untilDate && !isNaN(untilDate.getTime())) {
        params.to = untilDate.toISOString();
      }
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
      const key = `${row.agent_title} › ${row.plugin_title} › ${row.metric}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row.value);
    }
    return Object.entries(groups).map(([label, vals]) => {
      let min = Infinity, max = -Infinity, sum = 0;
      for (const v of vals) { if (v < min) min = v; if (v > max) max = v; sum += v; }
      return {
        label,
        min,
        max,
        avg: sum / vals.length,
        latest: vals[vals.length - 1],
        delta: vals[vals.length - 1] - vals[0],
        count: vals.length,
      };
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

  async function handleNavigate(v) {
    tab = v;
    if (v === 'metrics') await loadFilterOptions();
  }

  onMount(() => {
    checkVersion();
    const versionTimer = setInterval(checkVersion, 30000);
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') checkVersion();
    }
    window.addEventListener('focus', checkVersion);
    document.addEventListener('visibilitychange', onVisibilityChange);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                updateAvailable = true;
              }
            });
          }
        });
      }).catch(() => {});
    }

    if (loggedIn) {
      loadAlarms(); checkPush(); loadFilterOptions(); loadSnoozed();
      fetchRules().then(r => { rules = r; }).catch(() => {});
      fetchAdminPlugins().then(list => {
        pluginLabelMap = Object.fromEntries(list.map(p => [p.name, p.label || p.name]));
      }).catch(() => {});
    }

    // Hash routing — open alarm detail modal on #alarm/<id>
    function parseHash() {
      const m = window.location.hash.match(/^#alarm\/(\d+)$/);
      alarmDetailId = m ? parseInt(m[1]) : null;
    }
    parseHash();
    window.addEventListener('hashchange', parseHash);

    const t = setInterval(() => { if (loggedIn) { loadAlarms(); loadSnoozed(); } }, 5000);
    return () => {
      clearInterval(t);
      clearInterval(versionTimer);
      window.removeEventListener('focus', checkVersion);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('hashchange', parseHash);
    };
  });

  window.addEventListener('pymon:logout', () => { loggedIn = false; });
</script>

<main class="min-h-screen pb-24" style="background: var(--bg-app)">
  {#if !loggedIn}
    <LoginPage error={loginError} loading={loginLoading} onsubmit={handleLogin} version={appVersion} />
  {:else}
    <Header
      onAccount={() => tab = 'account'}
      {severityCounts}
      onSeverityClick={handleSeverityClick}
      lastActivityMs={lastApiOk}
    />

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
          merged={filteredMerged}
          onAck={ack}
          onAckRule={ackRule}
          onRule={openRule}
          onHistory={jumpToHistory}
          onSnooze={handleToggleSnooze}
          onDetail={openAlarmDetail}
          {ruleTitleMap}
          {agentTitleMap}
          {pluginLabelMap}
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
          {#if historyDateLabels.length > 1}
            <div class="glass rounded-[var(--radius-card)] p-3 mb-3 flex items-center gap-2">
              <input
                type="date"
                bind:value={historyDateStart}
                min={historyDateLabels[0]}
                max={historyDateEnd}
                class="flex-1 px-2 py-1.5 rounded-lg border text-xs bg-transparent outline-none"
                style="border-color:var(--border-default);color:var(--text-primary)"
              />
              <span class="text-xs" style="color:var(--text-secondary)">–</span>
              <input
                type="date"
                bind:value={historyDateEnd}
                min={historyDateStart}
                max={historyDateLabels[historyDateLabels.length - 1]}
                class="flex-1 px-2 py-1.5 rounded-lg border text-xs bg-transparent outline-none"
                style="border-color:var(--border-default);color:var(--text-primary)"
              />
              <span class="text-xs font-medium ml-1 whitespace-nowrap" style="color:var(--color-primary)">{filteredHistoryAlarms.length} alarms</span>
            </div>
          {/if}
          <AlarmList
            stacks={histFilteredStacks}
            singles={histFilteredSingles}
            merged={histFilteredMerged}
            onAck={() => {}}
            onAckRule={() => {}}
            onRule={openRule}
            onHistory={jumpToHistory}
            onSnooze={() => {}}
            onDetail={openAlarmDetail}
            {ruleTitleMap}
            {agentTitleMap}
            {pluginLabelMap}
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
          {groupTitleMap}
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

      <footer class="mt-8 mb-2 text-center select-none pointer-events-none">
        <span class="text-[10px] font-mono tracking-wider opacity-30 select-all pointer-events-auto cursor-default transition-opacity hover:opacity-75" style="color: var(--text-secondary)">
          pymon {appVersion}
        </span>
      </footer>
    </div>

    {#if updateAvailable}
      <aside
        class="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-sm animate-slide-up"
        aria-label="Update notification"
      >
        <div
          class="glass-pill px-4 py-2.5 flex items-center justify-between gap-3 shadow-2xl border"
          style="border-color: rgba(var(--color-primary-rgb), 0.4); background: var(--glass-bg); backdrop-filter: blur(24px);"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="relative flex h-2 w-2 flex-shrink-0">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <div class="text-xs truncate">
              <span class="font-semibold text-[var(--text-primary)]">Update available</span>
              {#if availableVersion}
                <span class="font-mono text-[10px] opacity-70 ml-1">({availableVersion})</span>
              {/if}
            </div>
          </div>
          <button
            type="button"
            onclick={applyUpdate}
            disabled={reloading}
            class="px-3 py-1 rounded-full text-xs font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-95 flex-shrink-0 flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
            style="background: var(--color-primary)"
          >
            <RefreshCw size={12} class={reloading ? 'animate-spin' : ''} />
            {reloading ? 'reloading...' : 'reload'}
          </button>
        </div>
      </aside>
    {/if}

    <BottomNav {tab} onNavigate={handleNavigate} alarmCount={openAlarms.length} />
  {/if}
</main>

{#if alarmDetailId != null}
  <AlarmDetailModal
    alarmId={alarmDetailId}
    onClose={closeAlarmDetail}
    onAcked={(id) => { openAlarms = openAlarms.filter(a => a.id !== id); loadSnoozed(); }}
  />
{/if}
