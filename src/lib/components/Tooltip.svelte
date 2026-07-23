<script>
  import { Info } from 'lucide-svelte';
  let { text = '' } = $props();
  let show = $state(false);
</script>

<span class="relative inline-flex" style="margin-left:2px;vertical-align:middle;">
  <button
    onmouseenter={() => show = true}
    onmouseleave={() => show = false}
    onclick={() => show = !show}
    class="inline-flex items-center cursor-help"
    style="background:none;border:none;padding:0;"
    aria-label="info"
  >
    <Info size={11} style="color: var(--text-secondary); opacity: 0.5;" />
  </button>
  {#if show}
    <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 px-2 py-1.5 rounded-lg text-[10px] leading-relaxed whitespace-nowrap shadow-lg animate-scale-in"
      style="background: var(--text-primary); color: var(--bg-app); max-width: 240px; white-space: normal;"
    >
      {text}
    </span>
  {/if}
</span>