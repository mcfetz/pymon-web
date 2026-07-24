<script>
  import ChevronDown from 'lucide-svelte/icons/chevron-down';

  let { items = [], selected = '', onchange = () => {}, placeholder = 'Select...' } = $props();
  let open = $state(false);
  let selectedLabel = $derived(items.find(i => i.id === selected)?.title || selected);

  function toggle() { open = !open; }
</script>

<div class="relative">
  <button
    onclick={toggle}
    class="flex items-center justify-between gap-1 px-3 py-2 rounded-lg border text-xs bg-transparent outline-none min-w-[100px] w-full"
    style="border-color: var(--border-default); color: {selected ? 'var(--text-primary)' : 'var(--text-secondary)'}"
  >
    <span class="truncate">{selected ? selectedLabel : placeholder}</span>
    <ChevronDown size={12} style="color: var(--text-secondary); transform: {open ? 'rotate(180deg)' : 'rotate(0)'}; transition: transform 0.2s" />
  </button>

  {#if open}
    <div class="absolute top-full left-0 mt-1 z-[100] max-h-[200px] overflow-y-auto min-w-full rounded-lg p-1 border"
      style="background: var(--bg-surface); border-color: var(--border-default); box-shadow: 0 8px 32px rgba(0,0,0,0.12)"
    >
      <button
        onclick={() => { onchange(''); open = false; }}
        class="flex items-center w-full px-3 py-1.5 rounded text-xs text-left hover:bg-black/5 dark:hover:bg-white/5"
        style="color: var(--text-secondary)"
      >{placeholder}</button>
      {#each items as item}
        <button
          onclick={() => { onchange(item.id); open = false; }}
          class="flex items-center justify-between w-full px-3 py-1.5 rounded text-xs text-left hover:bg-black/5 dark:hover:bg-white/5"
          style="color: {selected === item.id ? 'var(--color-primary)' : 'var(--text-primary)'}"
        >
          <span>{item.title}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>