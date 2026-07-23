<script>
  let { options = [], selected = new Set(), onchange = () => {}, counts = {}, icons = {} } = $props();

  function toggle(opt) {
    const s = new Set(selected);
    if (s.has(opt)) s.delete(opt); else s.add(opt);
    onchange(s);
  }
</script>

<div class="flex flex-wrap gap-1.5 justify-center">
  {#each options as opt}
    <button
      onclick={() => toggle(opt)}
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border"
      style="
        opacity: {selected.has(opt) ? '1' : '0.5'};
        border-color: {selected.has(opt) ? (icons[opt]?.color || 'var(--color-primary)') : 'var(--border-default)'};
      "
    >
      {#if icons[opt]}
        <svelte:component this={icons[opt].icon} size={12} strokeWidth={2} style="color: {icons[opt].color}" />
      {/if}
      {opt}
      {#if counts[opt] !== undefined}
        <span class="opacity-70">({counts[opt]})</span>
      {/if}
    </button>
  {/each}
</div>