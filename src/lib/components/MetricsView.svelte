<script>
  import GlassCard from './GlassCard.svelte';
  import EmptyState from './EmptyState.svelte';
  import MetricsChart from '../MetricsChart.svelte';
  import { ChartArea } from 'lucide-svelte';

  let {
    filters,
    onfilterchange = () => {},
    ongroupchange = () => {},
    onagentchange = () => {},
    onpluginchange = () => {},
    doQuery = () => {},
    groups = [],
    filteredAgents = [],
    plugins = [],
    metricNames = [],
    metricsData = [],
    metricsLoading = false,
    metricsError = null,
    hasSearched = false,
    agentTitleMap = {},
    pluginTitleMap = {},
    sortedData = [],
    pagedData = [],
    sortCol = 'timestamp',
    sortDir = 'desc',
    onSort = () => {},
    page = 0,
    pageSize = 50,
    totalPages = 0,
    onPageChange = () => {},
    metricsStats = [],
    chartData = [],
    timePresets = [],
  } = $props();

  function fmt(iso) {
    if (!iso) return '';
    const s = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
    return new Date(s).toLocaleString();
  }
  function fmtVal(v) {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
    return String(v);
  }
</script>

<div class="space-y-4">
  <GlassCard>
    <div class="flex flex-wrap items-end gap-2 p-4">
      <select
        value={filters.group}
        onchange={(e) => { filters.group = e.target.value; onfilterchange(); ongroupchange(); }}
        class="px-3 py-2 rounded-lg border text-xs bg-transparent outline-none"
        style="border-color: var(--border-default); color: var(--text-primary); min-width: 100px"
      >
        <option value="">All Groups</option>
        {#each groups as g}
          <option value={g}>{g}</option>
        {/each}
      </select>

      <select
        multiple
        value={filters.agentid}
        onchange={(e) => { filters.agentid = Array.from(e.target.selectedOptions, o => o.value); onagentchange(); }}
        class="px-3 py-2 rounded-lg border text-xs bg-transparent outline-none"
        style="border-color: var(--border-default); color: var(--text-primary); min-width: 120px; height: 100px"
      >
        {#each filteredAgents as a}
          <option value={a.id}>{a.title}</option>
        {/each}
      </select>

      <select
        value={filters.pluginid}
        onchange={(e) => { filters.pluginid = e.target.value; onpluginchange(); }}
        class="px-3 py-2 rounded-lg border text-xs bg-transparent outline-none"
        style="border-color: var(--border-default); color: var(--text-primary)"
      >
        <option value="">All Plugins</option>
        {#each plugins as p}
          <option value={p.id}>{p.title}</option>
        {/each}
      </select>

      <input
        type="text"
        placeholder="metric name..."
        bind:value={filters.metric}
        class="px-3 py-2 rounded-lg border text-xs bg-transparent outline-none flex-1 min-w-[120px]"
        style="border-color: var(--border-default); color: var(--text-primary)"
      />

      <div class="flex gap-1">
        {#each timePresets as p}
          <button
            onclick={() => { filters.timePreset = p.value; doQuery(); }}
            class="px-2.5 py-2 rounded-lg text-[10px] font-medium transition-all duration-150 hover:brightness-110 active:scale-95"
            style={filters.timePreset === p.value ? 'background: rgba(var(--color-primary-rgb), 0.15); color: var(--color-primary)' : 'color: var(--text-secondary)'}
          >{p.label}</button>
        {/each}
      </div>

      <button
        onclick={doQuery}
        disabled={metricsLoading}
        class="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all duration-200 hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
        style="background: var(--color-primary)"
      >{metricsLoading ? 'searching...' : 'search'}</button>
    </div>
  </GlassCard>

  {#if metricsError}
    <div class="glass px-4 py-3 rounded-[var(--radius-card)] text-sm text-red-400 border-l-2 border-red-400">{metricsError}</div>
  {/if}

  {#if chartData.length > 0}
    <GlassCard className="p-4">
      <MetricsChart data={chartData} />
    </GlassCard>
  {/if}

  {#if metricsStats.length > 0}
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {#each metricsStats as s}
        <GlassCard hover={false} className="p-3">
          <p class="text-[10px] uppercase tracking-wide font-semibold m-0 mb-1" style="color: var(--text-secondary)">{s.label}</p>
          <p class="text-sm font-mono font-bold m-0" style="color: var(--text-primary)">{fmtVal(s.value)}</p>
        </GlassCard>
      {/each}
    </div>
  {/if}

  {#if hasSearched && pagedData.length === 0 && !metricsLoading}
    <EmptyState icon={ChartArea} message="no metrics found" sub="try adjusting your filters" />
  {:else if pagedData.length > 0}
    <GlassCard hover={false}>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-default)">
              <th class="py-2 px-3 text-left font-semibold cursor-pointer select-none"
                style="color: var(--text-secondary)"
                onclick={() => onSort('timestamp')}
              >time {sortCol === 'timestamp' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th class="py-2 px-3 text-left font-semibold" style="color: var(--text-secondary)">agent</th>
              <th class="py-2 px-3 text-left font-semibold" style="color: var(--text-secondary)">plugin</th>
              <th class="py-2 px-3 text-left font-semibold" style="color: var(--text-secondary)">metric</th>
              <th class="py-2 px-3 text-right font-semibold cursor-pointer select-none"
                style="color: var(--text-secondary)"
                onclick={() => onSort('value')}
              >value {sortCol === 'value' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th class="py-2 px-3 text-center font-semibold" style="color: var(--text-secondary)">alarm</th>
            </tr>
          </thead>
          <tbody>
            {#each pagedData as row}
              <tr class="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]" style="border-bottom: 1px solid var(--border-default)">
                <td class="py-2 px-3 whitespace-nowrap font-mono opacity-70" style="color: var(--text-secondary)">{fmt(row.timestamp)}</td>
                <td class="py-2 px-3" style="color: var(--text-primary)">{agentTitleMap[row.agentid] || row.agentid}</td>
                <td class="py-2 px-3" style="color: var(--text-primary)">{pluginTitleMap[row.pluginid] || row.pluginid}</td>
                <td class="py-2 px-3 font-mono" style="color: var(--text-primary)">{row.metric}</td>
                <td class="py-2 px-3 text-right font-mono font-medium tabular-nums" style="color: var(--text-primary)">{fmtVal(row.value)}</td>
                <td class="py-2 px-3 text-center">
                  {#if row.alarm_id}
                    <span class="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style="background: rgba(239,68,68,0.1); color: #ef4444">
                      alarm
                      {#if row.acknowledged}
                        <span style="color: #22c55e">✓</span>
                      {/if}
                    </span>
                  {:else}
                    <span style="color: var(--text-secondary)">—</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if totalPages > 1}
        <div class="flex items-center justify-between px-3 py-2 border-t" style="border-color: var(--border-default)">
          <span class="text-[10px]" style="color: var(--text-secondary)">page {page + 1} of {totalPages}</span>
          <div class="flex gap-1">
            <button
              disabled={page <= 0}
              onclick={() => onPageChange(page - 1)}
              class="px-2.5 py-1 rounded text-[10px] font-medium transition-all duration-150 disabled:opacity-30"
              style="background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary)"
            >prev</button>
            <button
              disabled={page >= totalPages - 1}
              onclick={() => onPageChange(page + 1)}
              class="px-2.5 py-1 rounded text-[10px] font-medium transition-all duration-150 disabled:opacity-30"
              style="background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary)"
            >next</button>
          </div>
        </div>
      {/if}
    </GlassCard>
  {/if}
</div>