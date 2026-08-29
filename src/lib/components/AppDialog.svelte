<script>
  import X from 'lucide-svelte/icons/x';

  let { title = '', onclose = () => {}, width = '500px', children, footer } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={onclose}></div>
<div class="dialog" style="--dlg-width: {width};">
  <div class="dialog-header">
    <h3>{title}</h3>
    <button class="btn-close" onclick={onclose} aria-label="close dialog">&#10005;</button>
  </div>
  <div class="dialog-body">
    {@render children?.()}
  </div>
  {#if footer}
    <div class="dialog-footer">
      {@render footer()}
    </div>
  {/if}
</div>

<style>
  .overlay { position: fixed; inset: 0; z-index: 50; background: rgba(0, 0, 0, 0.5); touch-action: none; overscroll-behavior: none; }
  .dialog {
    position: fixed;
    top: max(1.5rem, env(safe-area-inset-top, 0px) + 1.5rem);
    left: 50%;
    transform: translateX(-50%);
    z-index: 51;
    background: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid var(--border-default, #e2e8f0);
    border-radius: var(--radius-card);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
    width: min(var(--dlg-width, 500px), calc(100vw - 2rem));
    max-height: calc(100vh - max(3rem, env(safe-area-inset-top, 0px) + 3rem) - env(safe-area-inset-bottom, 0px));
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  :global(.dark) .dialog { box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5); }
  .dialog-header { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-default); position: sticky; top: 0; background: var(--bg-surface); z-index: 1; }
  .dialog-header h3 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-primary); }
  .btn-close { background: none; border: none; font-size: 1rem; cursor: pointer; color: var(--text-secondary); padding: 0.2rem 0.4rem; border-radius: 5px; transition: background 0.15s; }
  .btn-close:hover { background: rgba(0, 0, 0, 0.05); }
  .dialog-body { padding: 1rem 1.25rem; }
  .dialog-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0.75rem 1.25rem; padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--border-default); }
</style>