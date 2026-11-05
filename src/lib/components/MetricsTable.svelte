<script>
  /**
   * Metrics result table. Extracted so the paginated view and the full screen
   * view render exactly the same rows and the same interactions.
   */
  import StickyNote from 'lucide-svelte/icons/sticky-note';
  import { fmtTime as fmt, fmtVal, copyText } from '../metricsUtils.js';

  let {
    rows = [],
    agentTitleMap = {},
    pluginTitleMap = {},
    sortCol = 'timestamp',
    sortDir = 'desc',
    onSort = () => {},
    onNote = () => {},
  } = $props();
</script>

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
        <th class="py-2 px-3 text-left font-semibold" style="color: var(--text-secondary)">note</th>
        <th class="py-2 px-3 text-center font-semibold" style="color: var(--text-secondary)">alarm</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row}
        <tr class="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]" style="border-bottom: 1px solid var(--border-default)">
          <td class="py-2 px-3 whitespace-nowrap font-mono opacity-70" style="color: var(--text-secondary)">{fmt(row.timestamp)}</td>
          <td class="py-2 px-3" style="color: var(--text-primary)">{agentTitleMap[row.agentid] || row.agentid}</td>
          <td class="py-2 px-3" style="color: var(--text-primary)">{pluginTitleMap[row.pluginid] || row.pluginid}</td>
          <td class="py-2 px-3 font-mono cursor-pointer select-all transition-colors hover:brightness-110" style="color: var(--color-primary)" title="Click to copy" onclick={() => copyText(row.metric)}>{row.metric}</td>
          <td class="py-2 px-3 text-right font-mono font-medium tabular-nums" style="color: var(--text-primary)">{fmtVal(row.value)}</td>
          <td class="py-2 px-3 max-w-[190px]">
            {#if row.note}
              <button
                type="button"
                onclick={() => onNote(row)}
                class="flex items-center gap-1 text-[10px] max-w-full text-left transition-opacity hover:opacity-80"
                style="color:#b45309"
                title={row.note}
              >
                <StickyNote size={11} strokeWidth={2} style="flex-shrink:0" />
                <span class="truncate">{row.note}</span>
              </button>
            {:else}
              <button
                type="button"
                onclick={() => onNote(row)}
                class="text-[10px] opacity-40 hover:opacity-100 transition-opacity whitespace-nowrap"
                style="color:var(--text-secondary)"
                title="add note"
              >+ note</button>
            {/if}
          </td>
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