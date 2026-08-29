<script>
  /**
   * Single-select segmented control (glass style).
   * options: [{ value, label?, icon?, title?, color? }]
   */
  let {
    options = [],
    value = '',
    onchange = () => {},
    stretch = false,
  } = $props();
</script>

<div
  class="inline-flex items-center p-0.5 rounded-lg border h-[34px] box-border"
  style="border-color: var(--border-default); background: var(--bg-surface, rgba(0, 0, 0, 0.03));"
>
  {#each options as opt (opt.value)}
    {@const active = opt.value === value}
    {@const color = opt.color || 'var(--color-primary)'}
    {@const Icon = opt.icon}
    <button
      type="button"
      onclick={() => onchange(opt.value)}
      title={opt.title}
      class="h-full px-2.5 rounded-[6px] transition-all duration-150 cursor-pointer flex items-center justify-center gap-1"
      class:flex-1={stretch}
      style={active
        ? `background: color-mix(in srgb, ${color} 18%, transparent); color: ${color}; font-weight: 600; font-size: 10px;`
        : 'color: var(--text-secondary); font-size: 10px;'}
    >
      {#if Icon}
        <Icon size={14} strokeWidth={active ? 2.5 : 2} />
      {/if}
      {#if opt.label !== undefined}<span>{opt.label}</span>{/if}
    </button>
  {/each}
</div>