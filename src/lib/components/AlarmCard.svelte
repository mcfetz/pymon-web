<script>
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import ChevronUp from 'lucide-svelte/icons/chevron-up';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import AlertCircle from 'lucide-svelte/icons/alert-circle';
  import Info from 'lucide-svelte/icons/info';
  import { fade, slide } from 'svelte/transition';

  let { group = null, onAck = () => {}, onAckAll = () => {}, onRule = () => {}, onHistory = () => {}, onSnooze = () => {}, onDetail = () => {}, ruleTitleMap = {}, agentTitleMap = {}, pluginLabelMap = {}, snoozed = false, acking = new Set(), expanded = false, onexpand = () => {}, history = false } = $props();

  const snoozeOptions = [
    { label: '1h', value: '1h' },
    { label: '6h', value: '6h' },
    { label: '1d', value: '1d' },
    { label: '1w', value: '1w' },
  ];
  let snoozeMenuOpen = $state(false);
  let snoozeControl = $state(null);

  function closeSnoozeMenuOnWindow(event) {
    if (snoozeMenuOpen && !snoozeControl?.contains(event.target)) snoozeMenuOpen = false;
  }

  function closeSnoozeMenuOnKeydown(event) {
    if (event.key === 'Escape') snoozeMenuOpen = false;
  }

  let alarms       = $derived(group?.alarms || []);
  let rule_id      = $derived(group?.rule_id || '');
  let agentid      = $derived(group?.agentid || '');
  let pluginid     = $derived(group?.pluginid || '');
  let metric       = $derived(group?.metric || '');
  let severity     = $derived(group?.alarms?.[0]?.severity || 'warning');
  let rule_label   = $derived(ruleTitleMap[rule_id] || rule_id);
  let agent_label  = $derived(agentTitleMap[agentid] || agentid);
  let plugin_label = $derived(pluginLabelMap[pluginid] || pluginid);

  let sevIcons = { critical: AlertCircle, warning: AlertTriangle, info: Info };
  let sevColors = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };

  function fmt(iso) {
    if (!iso) return '';
    const s = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
    return new Date(s).toLocaleString();
  }

  let latest = $derived(alarms[0]);
</script>

<svelte:window onclick={closeSnoozeMenuOnWindow} onkeydown={closeSnoozeMenuOnKeydown} />

<div
  class="glass rounded-[var(--radius-card)] transition-all duration-200 overflow-visible"
  style="border-left: 3px solid {sevColors[severity] || '#888'}"
>
  <div class="p-4">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <svelte:component this={sevIcons[severity] || Info} size={14} strokeWidth={2} style="color: {sevColors[severity]}" />
        <span class="text-xs font-medium truncate" style="color: var(--text-primary)">{rule_label}</span>
        {#if alarms.length > 1}
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style="background: var(--color-primary">{alarms.length}×</span>
        {/if}
      </div>
      {#if latest?.created_at}
        <span class="text-[10px] opacity-60 whitespace-nowrap ml-2" style="color: var(--text-secondary)">{fmt(latest.created_at)}</span>
      {/if}
    </div>

    <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] mb-3" style="color: var(--text-secondary)">
      <span>Agent: {agent_label}</span>
      <span>Plugin: {plugin_label}</span>
      <span>Metric: {metric}</span>
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      <button onclick={() => onRule(rule_id)} class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 hover:brightness-110 active:scale-95" style="background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary">Rule</button>
      <button onclick={() => onHistory(agentid, pluginid, metric)} class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 hover:brightness-110 active:scale-95" style="background: rgba(139,92,246,0.1); color: #8b5cf6">Metrics</button>
      <button onclick={() => onDetail(latest?.id)} class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 hover:brightness-110 active:scale-95" style="background: rgba(20,184,166,0.1); color: #14b8a6">Details</button>

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

      <div bind:this={snoozeControl} class="relative flex snooze-control">
        <div class="flex rounded-lg overflow-hidden border" style="border-color: var(--border-default)">
          <button
            onclick={() => onSnooze(group)}
            class="px-2.5 py-1 text-[11px] font-medium transition-all duration-150 hover:brightness-110 active:scale-95"
            style="background: {snoozed ? 'rgba(234,179,8,0.15)' : 'rgba(0,0,0,0.03)'}; color: {snoozed ? '#ca8a04' : 'var(--text-secondary)'}; opacity: {snoozed ? '1' : '0.5'}"
            title={snoozed ? 'unsnooze' : 'snooze'}
          >{snoozed ? 'Snoozed' : 'Snooze'}</button>
          <button
            onclick={() => snoozeMenuOpen = !snoozeMenuOpen}
            class="px-1.5 py-1 border-l transition-all duration-150 hover:brightness-110 active:scale-95"
            style="background: {snoozed ? 'rgba(234,179,8,0.15)' : 'rgba(0,0,0,0.03)'}; border-color: var(--border-default); color: var(--text-secondary)"
            title="set snooze duration"
            aria-label="set snooze duration"
            aria-haspopup="menu"
            aria-expanded={snoozeMenuOpen}
          ><span class="transition-transform" class:rotate-180={snoozeMenuOpen}><ChevronDown size={12} /></span></button>
        </div>
        {#if snoozeMenuOpen}
          <div
            class="absolute right-0 top-full z-30 mt-1 min-w-20 rounded-lg border p-1 shadow-lg"
            style="background: var(--glass-bg); border-color: var(--border-default)"
            role="menu"
          >
            {#each snoozeOptions as option}
              <button
                onclick={() => { snoozeMenuOpen = false; onSnooze(group, option.value); }}
                class="block w-full rounded-md px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style="color: var(--text-secondary)"
                role="menuitem"
              >{option.label}</button>
            {/each}
          </div>
        {/if}
      </div>
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
    <div class="border-t px-4 py-2 space-y-1 max-h-48 overflow-y-auto" style="border-color: var(--border-default)">
      {#each alarms as alarm, i (alarm.id)}
        <div class="flex items-center justify-between py-1.5 text-[11px]" style="border-bottom: 1px solid var(--border-default)">
          <div class="flex items-center gap-2">
            <span class="opacity-50" style="color: var(--text-secondary)">#{alarms.length - i}</span>
            <span class="font-mono opacity-60" style="color: var(--text-secondary)">{fmt(alarm.created_at)}</span>
            {#if alarm.value != null}
              <span class="font-mono font-medium" style="color: var(--text-primary)">{alarm.value}</span>
            {/if}
          </div>
          <div class="flex items-center gap-1">
            <button
              onclick={() => onDetail(alarm.id)}
              class="px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-150 hover:brightness-110"
              style="background: rgba(20,184,166,0.1); color: #14b8a6"
            >Details</button>
            <button
              onclick={() => onAck(alarm.id)}
              disabled={acking.has(alarm.id)}
              class="px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-150 hover:brightness-110 disabled:opacity-40"
              style="background: rgba(34,197,94,0.1); color: #22c55e"
            >{acking.has(alarm.id) ? '...' : '✓'}</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
