<script>
  import Check from 'lucide-svelte/icons/check';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';

  let { items = [], selected = [], onchange = () => {}, placeholder = 'Select...' } = $props();
  let open = $state(false);

  function toggle() { open = !open; }
  function select(item) {
    const s = selected.includes(item) ? selected.filter(i => i !== item) : [...selected, item];
    onchange(s);
  }
</script>

<div class="relative">
  <button
    onclick={toggle}
    class="flex items-center justify-between gap-1 px-3 py-2 rounded-lg border text-xs bg-transparent outline-none min-w-[120px] w-full"
    style="border-color: var(--border-default); color: {selected.length ? 'var(--text-primary)' : 'var(--text-secondary)'}"
  >
    <span class="truncate">{selected.length > 0 ? `${selected.length} selected` : placeholder}</span>
    <ChevronDown size={12} style="color: var(--text-secondary); transform: {open ? 'rotate(180deg)' : 'rotate(0)'}; transition: transform 0.2s" />
  </button>

  {#if open}
    <div class="absolute top-full left-0 mt-1 z-[100] max-h-[200px] overflow-y-auto min-w-full rounded-lg p-1 border"
      style="background: var(--bg-surface); border-color: var(--border-default); box-shadow: 0 8px 32px rgba(0,0,0,0.12)"
    >
      {#each items as item}
        <button
          onclick={() => select(item.id)}
          class="flex items-center justify-between w-full px-3 py-1.5 rounded text-xs text-left hover:bg-black/5 dark:hover:bg-white/5"
          style="color: var(--text-primary)"
        >
          <span>{item.title}</span>
          {#if selected.includes(item.id)}
            <Check size={12} style="color: var(--color-primary)" />
          {/if}
        </button>
      {/each}
      {#if items.length === 0}
        <div class="px-3 py-2 text-xs opacity-50" style="color: var(--text-secondary)">no items</div>
      {/if}
    </div>
  {/if}
</div>