<script>
  let { options = [], selected = new Set(), onchange = () => {}, counts = {}, colors = {} } = $props();

  function toggle(opt) {
    const s = new Set(selected);
    if (s.has(opt)) s.delete(opt); else s.add(opt);
    onchange(s);
  }
</script>

<div class="flex flex-wrap gap-1.5">
  {#each options as opt}
    <button
      onclick={() => toggle(opt)}
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border"
      style="
        background: {selected.has(opt) ? colors[opt] || 'var(--color-primary)' : 'transparent'};
        color: {selected.has(opt) ? '#1e293b' : 'var(--text-secondary)'};
        border-color: {selected.has(opt) ? colors[opt] || 'var(--color-primary)' : 'var(--border-default)'};
        opacity: {selected.has(opt) ? '1' : '0.5'};
      "
    >
      <span class="w-2 h-2 rounded-full" style="background: {colors[opt] || 'currentColor'}"></span>
      {opt}
      {#if counts[opt] !== undefined}
        <span class="opacity-70">({counts[opt]})</span>
      {/if}
    </button>
  {/each}
</div>