<script>
  /**
   * Shared full screen shell. Lives here so the platform quirks only ever get
   * fixed once:
   *
   *  - safe-area insets, otherwise the close button sits under the status bar
   *    on notched iPhones and the user is trapped in the overlay
   *  - the native Fullscreen API, which iOS Safari does not implement for
   *    arbitrary elements; the fixed overlay is the fallback that always works
   *  - 100dvh, because iOS with dynamic toolbars can size a plain fixed
   *    inset-0 element taller than the visible area
   *
   * Must NOT be rendered inside a .glass card: those carry backdrop-filter and
   * a hover transform, either of which makes position:fixed resolve against
   * the card instead of the viewport.
   */
  import { tick } from 'svelte';
  import X from 'lucide-svelte/icons/x';

  let { open = false, title = '', scroll = false, onclose = () => {}, children } = $props();

  let surface = $state(null);

  function close() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onclose();
  }

  $effect(() => {
    if (!open) return;
    // Ask for real full screen once the element exists. `surface` is only
    // non-null because of bind:this -- without it this branch gets optimized
    // away and full screen silently never fires.
    (async () => {
      await tick();
      try {
        if (surface?.requestFullscreen) await surface.requestFullscreen();
      } catch {
        // Denied or unsupported: the fixed overlay still works.
      }
    })();

    const onKey = (e) => { if (e.key === 'Escape') close(); };
    // Native ESC exits full screen without reaching us; catch it here.
    const onFsChange = () => { if (!document.fullscreenElement) onclose(); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.body.style.overflow = '';
    };
  });
</script>

{#if open}
  <div
    bind:this={surface}
    class="fixed inset-0 z-50 flex flex-col"
    style="background: var(--bg-app); height: 100vh; height: 100dvh;"
    role="dialog"
    aria-modal="true"
    aria-label={title || 'full screen'}
  >
    <div
      onclick={close}
      title="Close"
      class="flex items-center justify-between gap-2 pl-4 pr-2 pb-3 pt-3 flex-shrink-0 cursor-pointer"
      style="border-bottom: 1px solid var(--border-default); padding-top: calc(0.75rem + env(safe-area-inset-top, 0px));"
    >
      <h3 class="text-sm font-semibold m-0 truncate min-w-0" style="color: var(--text-primary);">
        {title}
      </h3>
      <button
        type="button"
        onclick={close}
        title="Close full screen"
        aria-label="close full screen"
        class="flex items-center justify-center w-11 h-11 rounded-lg flex-shrink-0 cursor-pointer hover:brightness-110 active:scale-95 transition-all"
        style="background: rgba(var(--color-primary-rgb), 0.08); color: var(--color-primary);"
      >
        <X size={18} strokeWidth={2} />
      </button>
    </div>

    <!-- min-h-0 lets children size against this instead of overflowing it. -->
    <div
      class="flex-1 min-h-0 px-3 py-3 {scroll ? 'overflow-auto' : 'overflow-hidden'}"
      style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));"
    >
      {@render children?.()}
    </div>
  </div>
{/if}