<script>
  import { onMount, onDestroy } from 'svelte';
  import Bell from 'lucide-svelte/icons/bell';
  import User from 'lucide-svelte/icons/user';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import AlertCircle from 'lucide-svelte/icons/alert-circle';
  import BellOff from 'lucide-svelte/icons/bell-off';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';

  let {
    onAccount = () => {},
    onSeverityClick = () => {},
    severityCounts = {},
    appVersion = '',
    updateAvailable = false,
    onReload = () => {},
    reloading = false,
    lastActivityMs = 0,
  } = $props();

  // Live / connectivity status derived from the last successful API poll
  let now = $state(Date.now());
  let timer = null;
  onMount(() => { timer = setInterval(() => { now = Date.now(); }, 1000); });
  onDestroy(() => { if (timer) clearInterval(timer); });

  let liveState = $derived.by(() => {
    if (!lastActivityMs) return { label: 'offline', color: '#ef4444' };
    const secs = Math.floor((now - lastActivityMs) / 1000);
    if (secs <= 30) return { label: 'live', color: '#22c55e' };
    if (secs <= 120) return { label: `${Math.floor(secs / 60)}m ago`, color: '#f59e0b' };
    return { label: 'offline', color: '#ef4444' };
  });

  let active = $derived(liveState.color === '#22c55e');

  const badgeDefs = [
    { key: 'critical', icon: AlertCircle, color: '#ef4444', label: 'crit' },
    { key: 'warning', icon: AlertTriangle, color: '#f59e0b', label: 'warn' },
    { key: 'snoozed', icon: BellOff, color: '#eab308', label: 'snoozed' },
  ];
</script>

<header class="sticky top-0 z-30 safe-top mt-3 mb-4">
  <div class="mx-auto max-w-sm px-4">
    <div class="glass-pill flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-2.5">
      <div class="flex items-center gap-2">
        <div class="icon-wrap">
          <Bell size={18} strokeWidth={2} style="color: var(--color-primary)" />
        </div>
        <h1 class="text-base font-bold m-0" style="color: var(--text-primary)">pymon</h1>
      </div>

      <!-- Severity status badges -->
      <div class="flex items-center gap-1 flex-1 justify-center order-3 min-[400px]:order-none">
        {#each badgeDefs as { key, icon: Icon, color, label }}
          <button
            type="button"
            onclick={() => onSeverityClick(key)}
            title="{label}: {severityCounts[key] || 0}"
            class="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150 cursor-pointer hover:brightness-110 active:scale-95"
            style="background: {color}18; color: {color};"
          >
            <Icon size={11} strokeWidth={2.5} />
            <span class="tabular-nums font-bold">{severityCounts[key] || 0}</span>
          </button>
        {/each}
      </div>

      <!-- Live / connectivity status -->
      <div
        class="flex items-center gap-1.5 ml-auto"
        title="Backend connectivity from the last successful poll"
      >
        <span class="relative flex h-2 w-2 flex-shrink-0">
          {#if active}
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style="background: {liveState.color}"></span>
          {/if}
          <span class="relative inline-flex rounded-full h-2 w-2" style="background: {liveState.color}"></span>
        </span>
        <span class="text-[10px] font-medium tabular-nums hidden min-[340px]:inline" style="color: {liveState.color}">{liveState.label}</span>
      </div>

      <!-- Version chip / update indicator -->
      <button
        type="button"
        onclick={updateAvailable ? onReload : undefined}
        class="flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono text-[10px] transition-all duration-150 cursor-pointer"
        class:opacity-60={!updateAvailable}
        class:hover:brightness-110={updateAvailable}
        title={updateAvailable ? `update ${appVersion} → available — click to reload` : `version ${appVersion}`}
        style="background: {updateAvailable ? 'rgba(var(--color-primary-rgb), 0.15)' : 'rgba(0,0,0,0.04)'}; color: {updateAvailable ? 'var(--color-primary)' : 'var(--text-secondary)'};"
      >
        {#if updateAvailable}
          <RefreshCw size={10} class={reloading ? 'animate-spin' : 'animate-pulse'} />
        {/if}
        {appVersion}
      </button>

      <button onclick={onAccount} class="p-1 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5" aria-label="account">
        <div class="icon-wrap">
          <User size={18} strokeWidth={1.8} style="color: var(--text-secondary)" />
        </div>
      </button>
    </div>
  </div>
</header>