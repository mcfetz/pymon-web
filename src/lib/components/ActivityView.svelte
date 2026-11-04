<script>
  import { onMount } from 'svelte';
  import History from 'lucide-svelte/icons/history';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import User from 'lucide-svelte/icons/user';
  import Bot from 'lucide-svelte/icons/bot';
  import Cog from 'lucide-svelte/icons/cog';
  import { fetchAudit } from '../api.js';
  import { fmtSmartTime } from '../metricsUtils.js';

  let entries = $state([]);
  let loading = $state(true);
  let error = $state('');
  let filters = $state({
    actor_id: '',
    action: '',
    target_type: '',
    target_id: '',
    limit: 200,
  });

  const TARGET_TYPES = ['', 'alarm', 'snooze', 'rule', 'agent', 'group', 'plugin', 'notification', 'executor', 'variable', 'blackout', 'dashboard', 'cron_task', 'user', 'database', 'metrics', 'cleanup_job'];

  const ACTOR_META = {
    user: { icon: User, color: 'var(--color-primary)', bg: 'rgba(var(--color-primary-rgb),0.1)' },
    agent: { icon: Bot, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    system: { icon: Cog, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  };

  async function load() {
    loading = true; error = '';
    try {
      entries = await fetchAudit(filters);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function changed(entry) {
    const fields = entry?.details?.changed_fields;
    return Array.isArray(fields) && fields.length ? fields.join(', ') : '';
  }

  function actorMeta(entry) {
    return ACTOR_META[entry.actor_type] || ACTOR_META.system;
  }

  onMount(load);
</script>

<div class="space-y-3">
  <div class="flex items-center gap-3">
    <div class="p-2.5 rounded-2xl" style="background:rgba(var(--color-primary-rgb),0.1)">
      <History size={22} strokeWidth={1.8} style="color:var(--color-primary)" />
    </div>
    <div>
      <h2 class="text-lg font-bold m-0" style="color:var(--text-primary)">Activity</h2>
      <div class="text-[11px]" style="color:var(--text-secondary)">who changed what</div>
    </div>
    <button
      onclick={load}
      class="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:brightness-110 disabled:opacity-50"
      style="background:rgba(var(--color-primary-rgb),0.1);color:var(--color-primary)"
      disabled={loading}
    >
      <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      refresh
    </button>
  </div>

  <div class="glass rounded-[var(--radius-card)] p-3 grid grid-cols-2 gap-2">
    <input
      type="text"
      bind:value={filters.actor_id}
      placeholder="actor (e.g. hermes)"
      class="px-2.5 py-2 rounded-lg border text-xs bg-transparent outline-none"
      style="border-color:var(--border-default);color:var(--text-primary)"
    />
    <input
      type="text"
      bind:value={filters.action}
      placeholder="action (e.g. alarm.ack)"
      class="px-2.5 py-2 rounded-lg border text-xs bg-transparent outline-none"
      style="border-color:var(--border-default);color:var(--text-primary)"
    />
    <select
      bind:value={filters.target_type}
      class="px-2.5 py-2 rounded-lg border text-xs bg-transparent outline-none"
      style="border-color:var(--border-default);color:var(--text-primary)"
    >
      {#each TARGET_TYPES as type}
        <option value={type}>{type || 'any target'}</option>
      {/each}
    </select>
    <input
      type="text"
      bind:value={filters.target_id}
      placeholder="target id"
      class="px-2.5 py-2 rounded-lg border text-xs bg-transparent outline-none"
      style="border-color:var(--border-default);color:var(--text-primary)"
    />
    <div class="col-span-2 flex items-center gap-2">
      <select
        bind:value={filters.limit}
        class="px-2.5 py-2 rounded-lg border text-xs bg-transparent outline-none"
        style="border-color:var(--border-default);color:var(--text-primary)"
      >
        {#each [50, 100, 200, 500] as limit}
          <option value={limit}>{limit} entries</option>
        {/each}
      </select>
      <button
        onclick={load}
        disabled={loading}
        class="px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
        style="background:var(--color-primary)"
      >{loading ? 'loading...' : 'apply'}</button>
      {#if filters.actor_id || filters.action || filters.target_type || filters.target_id}
        <button
          onclick={() => { filters = { actor_id: '', action: '', target_type: '', target_id: '', limit: filters.limit }; load(); }}
          class="text-[11px] underline"
          style="color:var(--text-secondary)"
        >reset</button>
      {/if}
    </div>
  </div>

  {#if error}
    <div class="text-xs px-3 py-2 rounded-lg" style="background:rgba(239,68,68,0.08);color:#ef4444">{error}</div>
  {/if}

  {#if loading && entries.length === 0}
    <div class="text-sm text-center py-12" style="color:var(--text-secondary)">loading activity...</div>
  {:else if entries.length === 0}
    <div class="text-sm text-center py-12" style="color:var(--text-secondary)">no activity</div>
  {:else}
    <div class="space-y-2">
      {#each entries as entry (entry.id)}
        {@const meta = actorMeta(entry)}
        <div class="glass rounded-[var(--radius-card)] px-3 py-2.5">
          <div class="flex items-center gap-2 min-w-0">
            <span class="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium flex-shrink-0" style="background:{meta.bg};color:{meta.color};max-width:10rem">
              <svelte:component this={meta.icon} size={10} strokeWidth={2.5} />
              <span class="truncate">{entry.actor_label || entry.actor_id}</span>
            </span>
            <span class="text-xs font-medium truncate" style="color:var(--text-primary)">{entry.summary || entry.action}</span>
            <span class="ml-auto text-[10px] whitespace-nowrap flex-shrink-0" style="color:var(--text-secondary)">{fmtSmartTime(entry.created_at)}</span>
          </div>
          <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono mt-1" style="color:var(--text-secondary)">
            <span>{entry.action}</span>
            <span>·</span>
            <span>{entry.target_type}{entry.target_id ? `:${entry.target_id}` : ''}</span>
            {#if changed(entry)}
              <span>·</span>
              <span class="truncate">changed: {changed(entry)}</span>
            {/if}
            {#if entry.details?.created}<span>· created</span>{/if}
            {#if entry.details?.deleted}<span>· deleted</span>{/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
