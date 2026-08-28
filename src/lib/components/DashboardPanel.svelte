<script>
  import GlassCard from './GlassCard.svelte';
  import EmptyState from './EmptyState.svelte';
  import MetricsChart from '../MetricsChart.svelte';
  import ChartArea from 'lucide-svelte/icons/chart-area';
  import Table2 from 'lucide-svelte/icons/table-2';
  import Sigma from 'lucide-svelte/icons/sigma';
  import CircleDot from 'lucide-svelte/icons/circle-dot';

  let { panel, data = [], loading = false, error = null } = $props();

  const TYPE_LABEL = { chart: 'Chart', table: 'Table', stats: 'Stats', last: 'Last value' };
  const TYPE_ICON = { chart: ChartArea, table: Table2, stats: Sigma, last: CircleDot };

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

  let lastValues = $derived.by(() => {
    const map = {};
    for (const row of data) {
      const key = `${row.agent_title || row.agentid} › ${row.plugin_title || row.pluginid} › ${row.metric}`;
      if (!(key in map) || new Date(map[key].timestamp) < new Date(row.timestamp)) {
        map[key] = row;
      }
    }
    return Object.values(map).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  });

  let stats = $derived.by(() => {
    const map = {};
    for (const row of data) {
      if (typeof row.value !== 'number') continue;
      const key = `${row.agent_title || row.agentid} › ${row.plugin_title || row.pluginid} › ${row.metric}`;
      if (!map[key]) map[key] = { vals: [], latest: null, oldest: null };
      const s = map[key];
      s.vals.push(row.value);
      if (s.latest === null) s.latest = row.value;
      s.oldest = row.value;
    }
    return Object.entries(map).map(([label, s]) => {
      let min = Infinity, max = -Infinity, sum = 0;
      for (const v of s.vals) { if (v < min) min = v; if (v > max) max = v; sum += v; }
      const avg = sum / s.vals.length;
      return { label, count: s.vals.length, min, avg, max, latest: s.latest, delta: s.latest - s.oldest };
    });
  });
</script>

<GlassCard className="p-4">
  <div class="flex items-center justify-between mb-3 gap-2">
    <div class="flex items-center gap-2 min-w-0">
      {#if TYPE_ICON[panel.type]}
        <svelte:component this={TYPE_ICON[panel.type]} size={14} strokeWidth={2} style="color: var(--color-primary); flex-shrink: 0" />
      {/if}
      <h3 class="text-sm font-semibold m-0 truncate" style="color: var(--text-primary)">
        {panel.title || panel.metric || 'Panel'}
      </h3>
      <span class="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0" style="background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary)">
        {TYPE_LABEL[panel.type] || panel.type}
      </span>
    </div>
  </div>

  {#if loading}
    <div class="text-xs py-6 text-center" style="color: var(--text-secondary)">loading…</div>
  {:else if error}
    <div class="text-xs py-4 text-red-400">query failed: {error}</div>
  {:else if data.length === 0}
    <EmptyState icon={TYPE_ICON[panel.type] || ChartArea} message="no data" sub="try adjusting the panel filters or time range" />
  {:else if panel.type === 'last'}
    <div class="flex flex-col gap-2">
      {#each lastValues as row}
        <div class="flex items-center justify-between gap-3 rounded-[var(--radius-card)] px-3 py-3" style="background: rgba(0,0,0,0.02)">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold truncate" style="color: var(--text-primary)">
              {row.agent_title || row.agentid} › {row.plugin_title || row.pluginid} › {row.metric}
            </p>
            <p class="text-[9px] tabular-nums mt-0.5 truncate" style="color: var(--text-secondary)">{fmt(row.timestamp)}</p>
          </div>
          <div class="text-right flex-shrink-0">
            <span class="text-base font-mono font-bold tabular-nums" style="color: var(--color-primary)">{fmtVal(row.value)}</span>
          </div>
        </div>
      {/each}
      {#if lastValues.length === 0}
        <div class="text-xs py-4 text-center" style="color: var(--text-secondary)">no values</div>
      {/if}
    </div>
  {:else if panel.type === 'chart'}
    <MetricsChart data={data} />
  {:else if panel.type === 'table'}
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-default)">
            <th class="py-1.5 px-2 text-left font-semibold" style="color: var(--text-secondary)">time</th>
            <th class="py-1.5 px-2 text-left font-semibold" style="color: var(--text-secondary)">agent</th>
            <th class="py-1.5 px-2 text-left font-semibold" style="color: var(--text-secondary)">plugin</th>
            <th class="py-1.5 px-2 text-left font-semibold" style="color: var(--text-secondary)">metric</th>
            <th class="py-1.5 px-2 text-right font-semibold" style="color: var(--text-secondary)">value</th>
          </tr>
        </thead>
        <tbody>
          {#each data as row}
            <tr style="border-bottom: 1px solid var(--border-default)">
              <td class="py-1.5 px-2 whitespace-nowrap font-mono opacity-70" style="color: var(--text-secondary)">{fmt(row.timestamp)}</td>
              <td class="py-1.5 px-2" style="color: var(--text-primary)">{row.agent_title || row.agentid}</td>
              <td class="py-1.5 px-2" style="color: var(--text-primary)">{row.plugin_title || row.pluginid}</td>
              <td class="py-1.5 px-2 font-mono" style="color: var(--text-primary)">{row.metric}</td>
              <td class="py-1.5 px-2 text-right font-mono font-medium tabular-nums" style="color: var(--text-primary)">{fmtVal(row.value)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="flex flex-col gap-2">
      {#each stats as s}
        <div class="rounded-[var(--radius-card)] p-3" style="background: rgba(0,0,0,0.02)">
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
      {#if stats.length === 0}
        <div class="text-xs py-4 text-center" style="color: var(--text-secondary)">no numeric values</div>
      {/if}
    </div>
  {/if}
</GlassCard>