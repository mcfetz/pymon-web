<script>
  let { options = [], selected = new Set(), onchange = () => {}, counts = {}, icons = {} } = $props();

  function toggle(opt) {
    const s = new Set(selected);
    if (s.has(opt)) s.delete(opt); else s.add(opt);
    onchange(s);
  }
</script>

<div class="flex justify-center">
  <div
    class="inline-flex items-center p-0.5 rounded-xl border flex-wrap gap-0.5"
    style="border-color: var(--border-default); background: var(--bg-surface, rgba(0, 0, 0, 0.03));"
  >
    {#each options as opt}
      {@const active = selected.has(opt)}
      {@const itemColor = icons[opt]?.color || 'var(--color-primary)'}
      {@const Icon = icons[opt]?.icon}
      <button
        type="button"
        onclick={() => toggle(opt)}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer"
        style="
          background: {active ? `color-mix(in srgb, ${itemColor} 15%, transparent)` : 'transparent'};
          color: {active ? itemColor : 'var(--text-secondary)'};
          font-weight: {active ? '600' : '400'};
          opacity: {active ? '1' : '0.55'};
        "
      >
        {#if Icon}
          <Icon size={13} strokeWidth={active ? 2.5 : 1.8} style="color: {active ? itemColor : 'var(--text-secondary)'}" />
        {/if}
        <span>{opt}</span>
        {#if counts[opt] !== undefined}
          <span
            class="text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-mono"
            style="background: {active ? `color-mix(in srgb, ${itemColor} 25%, transparent)` : 'rgba(0,0,0,0.06)'}; color: {active ? itemColor : 'var(--text-secondary)'}"
          >
            {counts[opt]}
          </span>
        {/if}
      </button>
    {/each}
  </div>
</div>