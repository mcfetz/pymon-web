<script>
  import GlassCard from './GlassCard.svelte';
  import EmptyState from './EmptyState.svelte';
  import MultiSelect from './MultiSelect.svelte';
  import Select from './Select.svelte';
  import MetricsChart from '../MetricsChart.svelte';
  import ChartArea from 'lucide-svelte/icons/chart-area';

  let {
    filters,
    onfilterchange = () => {},
    ongroupchange = () => {},
    onagentchange = () => {},
    onpluginchange = () => {},
    doQuery = () => {},
    groups = [],
    groupTitleMap = {},
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
  <GlassCard className="relative z-10">
    <div class="flex flex-wrap items-end gap-2 p-4">
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] uppercase tracking-wide font-semibold" style="color: var(--text-secondary)">group</span>
        <Select
          items={groups.map(g => ({ id: g, title: groupTitleMap[g] || g }))}
          selected={filters.group}
          placeholder="all groups"
          onchange={(v) => { filters.group = v; onfilterchange(); ongroupchange(); }}
        />
      </div>

      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] uppercase tracking-wide font-semibold" style="color: var(--text-secondary)">agents</span>
        <MultiSelect
          items={filteredAgents}
          selected={filters.agentid}
          placeholder="all agents"
          onchange={(s) => { filters.agentid = s; onagentchange(); }}
        />
      </div>

      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] uppercase tracking-wide font-semibold" style="color: var(--text-secondary)">plugin</span>
        <Select
          items={plugins}
          selected={filters.pluginid}
          placeholder="all plugins"
          onchange={(v) => { filters.pluginid = v; onpluginchange(); }}
        />
      </div>

      <div class="flex flex-col gap-0.5 flex-1 min-w-[120px]">
        <span class="text-[9px] uppercase tracking-wide font-semibold invisible">_</span>
        <input
          type="text"
          placeholder="metric name..."
          bind:value={filters.metric}
          class="px-3 py-2 rounded-lg border text-xs bg-transparent outline-none"
          style="border-color: var(--border-default); color: var(--text-primary)"
        />
      </div>

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
    <div class="flex flex-col gap-2 mb-2">
      {#each metricsStats as s}
        <div class="glass rounded-[var(--radius-card)] p-3">
          <p class="text-[11px] font-semibold mb-2 truncate" style="color: var(--text-primary)">{s.label}</p>
          <div class="grid grid-cols-5 gap-1 text-center">
            {#each [['min', s.min], ['avg', s.avg], ['max', s.max], ['latest', s.latest], ['Δ', s.delta]] as [lbl, val]}
              <div>
                <div class="text-[9px] uppercase tracking-wide mb-0.5" style="color: var(--text-secondary)">{lbl}</div>
                <div class="text-xs font-mono font-bold tabular-nums" style="color:{lbl === 'Δ' ? (val >= 0 ? '#22c55e' : '#ef4444') : 'var(--text-primary)'}">{fmtVal(val)}</div>
              </div>
            {/each}
          </div>
          <div class="text-[9px] mt-1.5 text-right" style="color: var(--text-secondary)">{s.count} values</div>
        </div>
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