<script>
  import { onMount, onDestroy } from 'svelte';
  import Bell from 'lucide-svelte/icons/bell';
  import User from 'lucide-svelte/icons/user';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import AlertCircle from 'lucide-svelte/icons/alert-circle';
  import BellOff from 'lucide-svelte/icons/bell-off';

  let {
    onAccount = () => {},
    onSeverityClick = () => {},
    severityCounts = {},
    lastActivityMs = 0,
  } = $props();

  // Live / connectivity status derived from the last successful API poll
  let now = $state(Date.now());
  let timer = null;
  onMount(() => { timer = setInterval(() => { now = Date.now(); }, 1000); });
  onDestroy(() => { if (timer) clearInterval(timer); });

  let liveColor = $derived.by(() => {
    if (!lastActivityMs) return '#ef4444';
    const secs = Math.floor((now - lastActivityMs) / 1000);
    if (secs <= 30) return '#22c55e';
    if (secs <= 120) return '#f59e0b';
    return '#ef4444';
  });

  let active = $derived(liveColor === '#22c55e');

  const badgeDefs = [
    { key: 'critical', icon: AlertCircle, color: '#ef4444', label: 'crit' },
    { key: 'warning', icon: AlertTriangle, color: '#f59e0b', label: 'warn' },
    { key: 'snoozed', icon: BellOff, color: '#eab308', label: 'snoozed' },
  ];
</script>

<header class="sticky top-0 z-30 safe-top mt-3 mb-4">
  <div class="mx-auto max-w-sm px-4">
    <div class="glass-pill flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-2.5">
      <!-- Logo -->
      <div class="flex items-center gap-2 order-1">
        <div class="icon-wrap">
          <Bell size={18} strokeWidth={2} style="color: var(--color-primary)" />
        </div>
        <h1 class="text-base font-bold m-0" style="color: var(--text-primary)">pymon</h1>
      </div>

      <!-- Live / connectivity status + account (always right-aligned) -->
      <div class="flex items-center gap-1 order-2 ml-auto">
        <div
          class="flex items-center"
          title="Backend connectivity from the last successful poll"
        >
          <span class="relative flex h-2 w-2 flex-shrink-0">
            {#if active}
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style="background: {liveColor}"></span>
            {/if}
            <span class="relative inline-flex rounded-full h-2 w-2" style="background: {liveColor}"></span>
          </span>
        </div>
        <button onclick={onAccount} class="p-1 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5" aria-label="account">
          <div class="icon-wrap">
            <User size={18} strokeWidth={1.8} style="color: var(--text-secondary)" />
          </div>
        </button>
      </div>

      <!-- Severity status badges (own row on narrow screens, inline on wider) -->
      <div class="flex items-center gap-1 w-full justify-center order-3 min-[480px]:w-auto min-[480px]:flex-1 min-[480px]:order-none">
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
    </div>
  </div>
</header>