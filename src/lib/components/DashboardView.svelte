<script>
  import { onMount, onDestroy } from 'svelte';
  import DashboardPanel from './DashboardPanel.svelte';
  import SegmentedControl from './SegmentedControl.svelte';
  import EmptyState from './EmptyState.svelte';
  import LayoutDashboard from 'lucide-svelte/icons/layout-dashboard';
  import Columns2 from 'lucide-svelte/icons/columns-2';
  import Columns3 from 'lucide-svelte/icons/columns-3';
  import Pencil from 'lucide-svelte/icons/pencil';
  import Search from 'lucide-svelte/icons/search';
  import TriangleAlert from 'lucide-svelte/icons/triangle-alert';
  import CircleCheck from 'lucide-svelte/icons/circle-check';
  import X from 'lucide-svelte/icons/x';
  import { fetchDashboards, queryMetrics, fetchAgents, fetchPluginSchemas, saveDashboard } from '../api.js';
  import { TIME_PRESETS, timeFromPreset } from '../metricsUtils.js';
  import { panelIssues, matchesQuery } from '../panelHealth.js';

  const COLUMN_OPTIONS = [
    { value: '1', label: '', icon: Columns3, title: 'One column' },
    { value: '2', label: '', icon: Columns2, title: 'Two columns' },
  ];

  // Below this panel count the sticky bar is leaner without a filter row.
  const FILTER_MIN_PANELS = 7;

  let {
    onEdit = () => {},
  } = $props();

  let dashboards = $state([]);
  let activeId = $state('');
  let timePreset = $state('1h');
  let loading = $state(false);
  let error = $state(null);
  let panelResults = $state({});
  let panelErrors = $state({});
  let agentTitleMap = $state({});
  let pluginTitleMap = $state({});
  let headerH = $state(0);
  let filterText = $state('');
  let onlyProblems = $state(false);
  let timer = null;

  let active = $derived(dashboards.find(d => d.id === activeId) || null);
  let columns = $derived(active?.columns === 1 ? 1 : 2);
  let gridStyle = $derived(
    `grid-template-columns: repeat(${columns}, minmax(0, 1fr));`
  );

  let allPanels = $derived(active?.panels || []);
  let showFilters = $derived(allPanels.length >= FILTER_MIN_PANELS);

  // Recomputed only when results or dashboard change, not on every keystroke.
  let issuesByPanel = $derived.by(() => {
    const out = {};
    for (const panel of allPanels) {
      const rows = panelResults[panel.id];
      if (!rows || rows.length === 0) continue;
      const found = panelIssues(panel, rows);
      if (found.length) out[panel.id] = found;
    }
    return out;
  });
  let problemCount = $derived(Object.keys(issuesByPanel).length);

  let visiblePanels = $derived(
    allPanels.filter(p =>
      matchesQuery(p, filterText) &&
      (!onlyProblems || issuesByPanel[p.id] !== undefined)
    )
  );
  let filterActive = $derived(!!filterText.trim() || onlyProblems);

  function resetFilter() {
    filterText = '';
    onlyProblems = false;
  }

  $effect(() => {
    const el = document.getElementById('app-header');
    if (!el) return;
    const measure = () => { headerH = el.offsetHeight; };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  });

  async function loadTitleMaps() {
    try {
      const [agents, schemas] = await Promise.all([fetchAgents(), fetchPluginSchemas()]);
      const aMap = {};
      for (const a of agents) aMap[a.id] = a.title || a.id;
      agentTitleMap = aMap;
      const pMap = {};
      for (const [name, schema] of Object.entries(schemas)) {
        pMap[name] = schema?.label || name;
      }
      pluginTitleMap = pMap;
    } catch {
      // Title lookup is best-effort; fall back to ids.
    }
  }

  async function reload() {
    error = null;
    try {
      await loadTitleMaps();
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
    // A filter carried over from another dashboard usually matches nothing
    // here and would look like an empty dashboard.
    resetFilter();
    const db = dashboards.find(d => d.id === id);
    if (db) timePreset = db.timerange || '1h';
    await runQueries();
  }

  async function changePreset(preset) {
    timePreset = preset;
    await runQueries();
  }

  async function changeColumns(n) {
    const db = active;
    if (!db || db.columns === n) return;
    const updated = { ...db, columns: n };
    dashboards = dashboards.map(d => (d.id === db.id ? updated : d));
    try {
      await saveDashboard(db.id, updated);
    } catch (e) {
      dashboards = dashboards.map(d => (d.id === db.id ? db : d));
      error = e.message;
    }
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
        const raw = await queryMetrics(params);
        results[panel.id] = raw.map(row => ({
          ...row,
          agent_title: agentTitleMap[row.agentid] || row.agentid,
          plugin_title: pluginTitleMap[row.pluginid] || row.pluginid,
        }));
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
    <!-- Dashboard selector + time range + column toggle -->
    <div
      class="sticky z-20 -mx-4 px-4 pb-2 pt-3 space-y-2"
      style="top: {headerH}px; background: var(--bg-app);"
    >
      <div class="glass-pill px-2 py-1.5 overflow-x-auto whitespace-nowrap flex items-center gap-1" style="scrollbar-width:none">
        {#each dashboards as db}
          <button
            type="button"
            onclick={() => selectDashboard(db.id)}
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap flex-shrink-0"
            style={activeId === db.id
              ? 'background: rgba(var(--color-primary-rgb), 0.18); color: var(--color-primary); font-weight: 600;'
              : 'color: var(--text-secondary);'}
          >{db.name}</button>
        {/each}
      </div>

      <div class="flex justify-center">
        <SegmentedControl options={TIME_PRESETS} value={timePreset} onchange={changePreset} />
        <div class="ml-2">
          <SegmentedControl
            options={COLUMN_OPTIONS}
            value={String(columns)}
            onchange={(v) => changeColumns(Number(v))}
          />
        </div>
      </div>

      {#if showFilters}
        <!-- Panel filter: only rendered on dashboards where it pays off -->
        <div class="flex items-center gap-2">
          <div class="relative flex-1 min-w-0">
            <Search
              size={12}
              strokeWidth={2}
              style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); pointer-events: none;"
            />
            <input
              type="text"
              placeholder="filter panels..."
              bind:value={filterText}
              aria-label="filter panels"
              class="w-full pl-7 pr-7 py-1.5 rounded-lg border text-xs bg-transparent outline-none"
              style="border-color: var(--border-default); color: var(--text-primary);"
            />
            {#if filterText}
              <button
                type="button"
                onclick={() => (filterText = '')}
                title="clear filter"
                aria-label="clear filter"
                class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded cursor-pointer hover:brightness-125 transition-all"
                style="color: var(--text-secondary);"
              >
                <X size={11} strokeWidth={2} />
              </button>
            {/if}
          </div>

          <button
            type="button"
            onclick={() => (onlyProblems = !onlyProblems)}
            title={problemCount ? `${problemCount} panel(s) need attention` : 'no problems detected'}
            aria-pressed={onlyProblems}
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 cursor-pointer whitespace-nowrap flex-shrink-0"
            style={onlyProblems
              ? 'background: rgba(239, 68, 68, 0.16); color: #ef4444; font-weight: 600;'
              : 'background: rgba(var(--color-primary-rgb), 0.06); color: var(--text-secondary);'}
          >
            <TriangleAlert size={12} strokeWidth={2} />
            problems only
            {#if problemCount}
              <span
                class="tabular-nums px-1 rounded-full"
                style="background: rgba(239, 68, 68, 0.18); color: #ef4444;"
              >{problemCount}</span>
            {/if}
          </button>
        </div>
      {/if}
    </div>

    {#if active}
      <!-- Result summary: only while a filter narrows things down -->
      {#if filterActive}
        <div class="flex items-center gap-1.5 text-[10px] px-1" style="color: var(--text-secondary);">
          <span class="tabular-nums">{visiblePanels.length} of {allPanels.length}</span>
          <span>panels</span>
          {#if onlyProblems}
            <span class="opacity-60">· {problemCount} need attention</span>
          {/if}
          <button
            type="button"
            onclick={resetFilter}
            class="ml-auto underline cursor-pointer hover:opacity-100 opacity-70 transition-opacity"
          >reset</button>
        </div>
      {/if}

      <!-- Panels -->
      {#if visiblePanels.length > 0}
        <div class="grid gap-3" style={gridStyle}>
          {#each visiblePanels as panel}
            <DashboardPanel
              panel={panel}
              data={panelResults[panel.id] || []}
              loading={loading}
              error={panelErrors[panel.id]}
              compact={columns === 2}
              issues={issuesByPanel[panel.id] || []}
            />
          {/each}
        </div>
      {:else if onlyProblems && problemCount === 0 && !filterText.trim()}
        <EmptyState
          icon={CircleCheck}
          message="no problems detected"
          sub="{allPanels.length} panels checked"
        />
      {:else}
        <EmptyState
          icon={Search}
          message="no matching panels"
          sub={filterText.trim() ? `nothing matches "{filterText.trim()}"` : 'try clearing the filter'}
        />
      {/if}

      <!-- Edit in config -->
      <div class="flex justify-center pt-1">
        <button
          type="button"
          onclick={() => onEdit(active.id)}
          title="Edit dashboard in config"
          aria-label="edit dashboard in config"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 cursor-pointer hover:brightness-110 active:scale-95"
          style="background: rgba(var(--color-primary-rgb), 0.08); color: var(--color-primary);"
        >
          <Pencil size={12} strokeWidth={2} />
          edit in config
        </button>
      </div>
    {/if}
  {/if}
</div>