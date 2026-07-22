<script>
  let { className = '', hover = true, children } = $props();
</script>

<div
  class="glass rounded-[var(--radius-card)] transition-all duration-200 {className}"
  class:hover:scale-[1.005]={hover}
  class:hover:shadow-xl={hover}
>
  {@render children?.()}
</div>