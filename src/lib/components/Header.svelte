<script>
  import { Bell, User } from 'lucide-svelte';

  let { onAccount = () => {} } = $props();
</script>

<header class="sticky top-0 z-30 safe-top mt-3 mb-4">
  <div class="mx-auto max-w-xl px-4">
    <div class="glass-pill flex items-center justify-between px-4 py-2.5">
      <div class="flex items-center gap-2">
        <div class="icon-wrap">
          <Bell size={18} strokeWidth={2} style="color: var(--color-primary)" />
        </div>
        <h1 class="text-base font-bold m-0" style="color: var(--text-primary)">pymon</h1>
      </div>

      <button onclick={onAccount} class="p-1 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5" aria-label="account">
        <div class="icon-wrap">
          <User size={18} strokeWidth={1.8} style="color: var(--text-secondary)" />
        </div>
      </button>
    </div>
  </div>
</header>