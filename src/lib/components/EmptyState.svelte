<script>
  import FileSearch from 'lucide-svelte/icons/file-search';

  let { icon = FileSearch, message = 'No data', sub = '' } = $props();
</script>

<div class="flex flex-col items-center justify-center py-16 gap-3 animate-fade-in">
  <div class="opacity-30">
    <svelte:component this={icon} size={48} strokeWidth={1.5} style="color: var(--text-secondary)" />
  </div>
  <p class="text-sm font-medium m-0" style="color: var(--text-secondary)">{message}</p>
  {#if sub}
    <p class="text-xs m-0 opacity-60" style="color: var(--text-secondary)">{sub}</p>
  {/if}
</div>