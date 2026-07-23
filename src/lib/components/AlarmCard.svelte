<script>
  import { ChevronDown, ChevronUp, AlertTriangle, AlertCircle, Info } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';

  let { group = null, onAck = () => {}, onAckAll = () => {}, onRule = () => {}, onHistory = () => {}, onSnooze = () => {}, snoozed = false, acking = new Set(), expanded = false, onexpand = () => {}, history = false } = $props();

  let { alarms = [], rule_id = '', agentid = '', pluginid = '', metric = '', severity = 'warning' } = group || {};

  let sevIcons = { critical: AlertCircle, warning: AlertTriangle, info: Info };
  let sevColors = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };

  function fmt(iso) {
    if (!iso) return '';
    const s = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
    return new Date(s).toLocaleString();
  }

  let latest = alarms[0];
</script>

<div
  class="glass rounded-[var(--radius-card)] transition-all duration-200 overflow-hidden"
  style="border-left: 3px solid {sevColors[severity] || '#888'}"
>
  <div class="p-4">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <svelte:component this={sevIcons[severity] || Info} size={14} strokeWidth={2} style="color: {sevColors[severity]}" />
        <span class="text-xs font-medium truncate font-mono" style="color: var(--text-primary)">{rule_id}</span>
        {#if alarms.length > 1}
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style="background: var(--color-primary">{alarms.length}×</span>
        {/if}
      </div>
      {#if latest?.created_at}
        <span class="text-[10px] opacity-60 whitespace-nowrap ml-2" style="color: var(--text-secondary)">{fmt(latest.created_at)}</span>
      {/if}
    </div>

    <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] mb-3" style="color: var(--text-secondary)">
      <span>Agent: {agentid}</span>
      <span>Plugin: {pluginid}</span>
      <span>Metric: {metric}</span>
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      <button onclick={() => onRule(rule_id)} class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 hover:brightness-110 active:scale-95" style="background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary">Rule</button>
      <button onclick={() => onHistory(agentid, pluginid, metric)} class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 hover:brightness-110 active:scale-95" style="background: rgba(139,92,246,0.1); color: #8b5cf6">Metrics</button>

      {#if !history}
      <div class="flex rounded-lg overflow-hidden border ml-auto" style="border-color: var(--border-default">
        <button
          onclick={() => onAck(latest?.id)}
          disabled={acking.has(latest?.id)}
          class="px-2.5 py-1 text-[11px] font-medium transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-50"
          style="background: rgba(34,197,94,0.1); color: #22c55e"
          title="acknowledge latest"
        >{acking.has(latest?.id) ? '...' : '✓'}</button>
        {#if alarms.length > 1}
          <button
            onclick={() => { if (confirm(`Acknowledge all ${alarms.length} alarms for this rule?`)) onAckAll(rule_id, agentid, pluginid, metric); }}
            disabled={acking.size > 0}
            class="px-2.5 py-1 text-[11px] font-medium transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-50 border-l"
            style="background: rgba(22,163,74,0.15); color: #16a34a; border-color: var(--border-default)"
            title="acknowledge all {alarms.length}"
          >✓ {alarms.length}</button>
        {/if}
      </div>

      <button
        onclick={() => onSnooze(group)}
        class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 hover:brightness-110 active:scale-95"
        style="background: {snoozed ? 'rgba(234,179,8,0.15)' : 'rgba(0,0,0,0.03)'}; color: {snoozed ? '#ca8a04' : 'var(--text-secondary)'}; opacity: {snoozed ? '1' : '0.5'}"
        title={snoozed ? 'unsnooze' : 'snooze'}
      >{snoozed ? 'Snoozed' : 'Snooze'}</button>
      {/if}

      {#if alarms.length > 1}
        <button
          onclick={onexpand}
          class="p-1 rounded-lg transition-all duration-150 hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="expand"
        >
          {#if expanded}
            <ChevronUp size={14} style="color: var(--text-secondary)" />
          {:else}
            <ChevronDown size={14} style="color: var(--text-secondary)" />
          {/if}
        </button>
      {/if}
    </div>
  </div>

  {#if expanded && alarms.length > 1}
    <div class="border-t px-4 py-2 space-y-1 max-h-48 overflow-y-auto" style="border-color: var(--border-default">
      {#each alarms as alarm, i (alarm.id)}
        <div class="flex items-center justify-between py-1.5 text-[11px}" style="border-bottom: 1px solid var(--border-default)">
          <div class="flex items-center gap-2">
            <span class="opacity-50" style="color: var(--text-secondary)">#{alarms.length - i}</span>
            <span class="font-mono opacity-60" style="color: var(--text-secondary)">{fmt(alarm.created_at)}</span>
            {#if alarm.value != null}
              <span class="font-mono font-medium" style="color: var(--text-primary)">{alarm.value}</span>
            {/if}
          </div>
          <button
            onclick={() => onAck(alarm.id)}
            disabled={acking.has(alarm.id)}
            class="px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-150 hover:brightness-110 disabled:opacity-40"
            style="background: rgba(34,197,94,0.1); color: #22c55e"
          >{acking.has(alarm.id) ? '...' : '✓'}</button>
        </div>
      {/each}
    </div>
  {/if}
</div>