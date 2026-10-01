<script>
  let { label = '' } = $props();
</script>

<div class="flex items-center gap-3 pt-1 pb-0.5" role="separator">
  <span class="text-[10px] font-medium tracking-wide whitespace-nowrap" style="color: var(--text-secondary)">{label}</span>
  <span class="flex-1 h-px" style="background: var(--border-default)"></span>
</div>