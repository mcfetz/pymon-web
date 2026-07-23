<script>
  import { Bell, Clock, ChartArea, Cog } from 'lucide-svelte';

  let { tab = 'alarms', onNavigate, alarmCount = 0 } = $props();

  const items = [
    { id: 'alarms', icon: Bell, label: 'Alarms' },
    { id: 'history', icon: Clock, label: 'History' },
    { id: 'metrics', icon: ChartArea, label: 'Metrics' },
    { id: 'config', icon: Cog, label: 'Config' },
  ];
</script>

<nav class="fixed bottom-0 left-0 right-0 z-40 safe-bottom">
  <div class="mx-auto max-w-lg px-4 pb-3">
    <div class="glass-pill flex items-center justify-around px-2 py-2">
      {#each items as { id, icon: Icon, label }}
        <button
          onclick={() => onNavigate(id)}
          class="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-200 min-w-0"
          style="background: {tab === id ? 'rgba(var(--color-primary-rgb), 0.1)' : 'transparent'}"
          aria-label={label}
        >
          <div class="icon-wrap relative">
            {#if id === 'alarms' && alarmCount > 0}
              <span class="absolute -top-2.5 -right-3.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1 animate-scale-in" style="background: var(--color-primary)">{alarmCount}</span>
            {/if}
            <Icon
              size={20}
              strokeWidth={tab === id ? 2.5 : 1.8}
              class="nav-icon"
              style={tab === id ? 'color: var(--color-primary); transform: translateY(-2px)' : 'color: var(--text-secondary)'}
            />
          </div>
          <span
            class="text-[10px] font-medium leading-none truncate"
            style="color: {tab === id ? 'var(--color-primary)' : 'var(--text-secondary)'}"
          >{label}</span>
        </button>
      {/each}
    </div>
  </div>
</nav>
<style>
  .icon-wrap :global(svg) {
    transition: transform 0.2s ease;
  }
  .icon-wrap:hover :global(svg) {
    transform: translateY(-2px) scale(1.1);
  }
</style>