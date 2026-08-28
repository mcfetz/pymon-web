<script>
  import { onMount, onDestroy } from 'svelte';
  import DashboardPanel from './DashboardPanel.svelte';
  import EmptyState from './EmptyState.svelte';
  import LayoutDashboard from 'lucide-svelte/icons/layout-dashboard';
  import { fetchDashboards, queryMetrics } from '../api.js';

  const TIME_PRESETS = [
    { label: '1h', value: '1h' }, { label: '6h', value: '6h' },
    { label: '12h', value: '12h' }, { label: '1d', value: '1d' }, { label: '1w', value: '1w' },
  ];
  const PRESET_HOURS = { '1h': 1, '6h': 6, '12h': 12, '1d': 24, '1w': 168 };

  function timeFromPreset(preset) {
    return new Date(Date.now() - (PRESET_HOURS[preset] || 1) * 3600000).toISOString();
  }

  let dashboards = $state([]);
  let activeId = $state('');
  let timePreset = $state('1h');
  let loading = $state(false);
  let error = $state(null);
  let panelResults = $state({});
  let panelErrors = $state({});
  let timer = null;

  let active = $derived(dashboards.find(d => d.id === activeId) || null);

  async function reload() {
    error = null;
    try {
      const raw = await fetchDashboards();
      const sorted = Object.values(raw).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      dashboards = sorted;
      if (!sorted.length) {
        activeId = '';
        panelResults = {};
        panelErrors = {};
        return;
      }
      if (!sorted.some(d => d.id === activeId)) {
        activeId = sorted[0].id;
        timePreset = sorted[0].timerange || '1h';
      }
      await runQueries();
    } catch (e) {
      error = e.message;
    }
  }

  async function selectDashboard(id) {
    if (id === activeId) return;
    activeId = id;
    const db = dashboards.find(d => d.id === id);
    if (db) timePreset = db.timerange || '1h';
    await runQueries();
  }

  async function changePreset(preset) {
    timePreset = preset;
    await runQueries();
  }

  async function runQueries() {
    const db = active;
    if (!db) return;
    loading = true;
    const results = {};
    const errs = {};
    const queries = (db.panels || []).map(async (panel) => {
      const params = {};
      if (panel.group) params.group = panel.group;
      if (panel.agentid?.length) params.agentid = panel.agentid.join(',');
      if (panel.pluginid) params.pluginid = panel.pluginid;
      if (panel.metric) params.metric = panel.metric;
      params.from = timeFromPreset(timePreset);
      params.limit = 5000;
      try {
        results[panel.id] = await queryMetrics(params);
      } catch (e) {
        errs[panel.id] = e.message;
        results[panel.id] = [];
      }
    });
    await Promise.all(queries);
    panelResults = results;
    panelErrors = errs;
    loading = false;
  }

  onMount(() => {
    reload();
    timer = setInterval(() => {
      if (dashboards.length) runQueries();
    }, 30000);
  });
  onDestroy(() => { if (timer) clearInterval(timer); });
</script>

<div class="space-y-4">
  {#if error}
    <div class="glass px-4 py-3 rounded-[var(--radius-card)] text-sm text-red-400 border-l-2 border-red-400">{error}</div>
  {/if}

  {#if dashboards.length === 0}
    <EmptyState icon={LayoutDashboard} message="no dashboards yet" sub="create one in Config → Dashboards" />
  {:else}
    <!-- Dashboard selector -->
    <div>
      <div class="glass-pill px-2 py-1.5 overflow-x-auto whitespace-nowrap flex items-center gap-1" style="scrollbar-width:none">
        {#each dashboards as db}
          <button
            type="button"
            onclick={() => selectDashboard(db.id)}
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap"
            style={activeId === db.id
              ? 'background: rgba(var(--color-primary-rgb), 0.18); color: var(--color-primary); font-weight: 600;'
              : 'color: var(--text-secondary);'}
          >{db.name}</button>
        {/each}
      </div>
    </div>

    {#if active}
      <!-- Time range preset (segmented control, pre-set from dashboard default) -->
      <div class="flex justify-center">
        <div
          class="inline-flex items-center p-0.5 rounded-lg border h-[34px] box-border"
          style="border-color: var(--border-default); background: var(--bg-surface, rgba(0, 0, 0, 0.03));"
        >
          {#each TIME_PRESETS as p}
            <button
              type="button"
              onclick={() => changePreset(p.value)}
              class="h-full px-2.5 rounded-[6px] text-[10px] font-medium transition-all duration-150 cursor-pointer flex items-center justify-center"
              style={timePreset === p.value
                ? 'background: rgba(var(--color-primary-rgb), 0.18); color: var(--color-primary); font-weight: 600;'
                : 'color: var(--text-secondary);'}
            >{p.label}</button>
          {/each}
        </div>
      </div>

      <!-- Panels -->
      {#each active.panels || [] as panel}
        <DashboardPanel
          panel={panel}
          data={panelResults[panel.id] || []}
          loading={loading}
          error={panelErrors[panel.id]}
        />
      {/each}
    {/if}
  {/if}
</div>