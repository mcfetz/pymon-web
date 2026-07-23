<script>
  let { icon, title } = $props();
</script>

<div class="flex items-center gap-3 mb-4">
  <div class="p-2.5 rounded-2xl" style="background: rgba(var(--color-primary-rgb), 0.1)">
    <svelte:component this={icon} size={22} strokeWidth={1.8} style="color: var(--color-primary)" />
  </div>
  <h2 class="text-lg font-bold m-0" style="color: var(--text-primary)">{title}</h2>
</div>