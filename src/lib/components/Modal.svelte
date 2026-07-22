<script>
  import { X } from 'lucide-svelte';
  import { fly, fade } from 'svelte/transition';

  let { open = false, title = '', onclose = () => {}, children } = $props();

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onclose();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onclick={handleBackdrop}></div>
    <div class="glass relative max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 animate-scale-in" transition:fly|scale>
      {#if title}
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold m-0" style="color: var(--text-primary)">{title}</h2>
          <button onclick={onclose} class="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" aria-label="close">
            <X size={18} style="color: var(--text-secondary)" />
          </button>
        </div>
      {/if}
      {@render children?.()}
    </div>
  </div>
{/if}