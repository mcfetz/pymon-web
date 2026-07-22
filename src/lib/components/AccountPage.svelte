<script>
  import { LogOut, User } from 'lucide-svelte';
  import GlassCard from './GlassCard.svelte';

  let { onlogout = () => {}, onsave = () => {} } = $props();

  let username = $state('');
  let curPw = $state('');
  let newPw = $state('');
  let newPw2 = $state('');
  let msg = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handle(e) {
    e.preventDefault();
    msg = ''; error = '';
    if (newPw && newPw !== newPw2) { error = 'passwords do not match'; return; }
    loading = true;
    try {
      await onsave({ username: username.trim() || undefined, curPw, newPw: newPw || undefined });
      msg = 'account updated';
      curPw = ''; newPw = ''; newPw2 = '';
    } catch (e) { error = e.message; }
    finally { loading = false; }
  }
</script>

<div class="max-w-md">
  <div class="flex items-center gap-3 mb-6">
    <div class="p-2.5 rounded-2xl" style="background: rgba(var(--color-primary-rgb), 0.1)">
      <User size={24} strokeWidth={1.8} style="color: var(--color-primary)" />
    </div>
    <h2 class="text-lg font-bold m-0" style="color: var(--text-primary)">Account</h2>
  </div>

  <GlassCard>
    <form onsubmit={handle} class="flex flex-col gap-3 p-5">
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-medium uppercase tracking-wide" style="color: var(--text-secondary)">username</label>
        <input type="text" bind:value={username} placeholder="new username" disabled={loading}
          class="w-full px-3 py-2.5 rounded-lg border text-sm transition-colors outline-none"
          style="background: var(--bg-surface); border-color: var(--border-default); color: var(--text-primary)"
          onfocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
          onblur={(e) => e.target.style.borderColor = 'var(--border-default)'}
        />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-medium uppercase tracking-wide" style="color: var(--text-secondary)">current password</label>
        <input type="password" bind:value={curPw} required disabled={loading}
          class="w-full px-3 py-2.5 rounded-lg border text-sm transition-colors outline-none"
          style="background: var(--bg-surface); border-color: var(--border-default); color: var(--text-primary)"
          onfocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
          onblur={(e) => e.target.style.borderColor = 'var(--border-default)'}
        />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-medium uppercase tracking-wide" style="color: var(--text-secondary)">new password</label>
        <input type="password" bind:value={newPw} placeholder="leave empty to keep" disabled={loading}
          class="w-full px-3 py-2.5 rounded-lg border text-sm transition-colors outline-none"
          style="background: var(--bg-surface); border-color: var(--border-default); color: var(--text-primary)"
          onfocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
          onblur={(e) => e.target.style.borderColor = 'var(--border-default)'}
        />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-medium uppercase tracking-wide" style="color: var(--text-secondary)">confirm new password</label>
        <input type="password" bind:value={newPw2} placeholder="leave empty to keep" disabled={loading}
          class="w-full px-3 py-2.5 rounded-lg border text-sm transition-colors outline-none"
          style="background: var(--bg-surface); border-color: var(--border-default); color: var(--text-primary)"
          onfocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
          onblur={(e) => e.target.style.borderColor = 'var(--border-default)'}
        />
      </div>
      {#if error}<p class="text-xs text-red-400 m-0">{error}</p>{/if}
      {#if msg}<p class="text-xs text-green-400 m-0">{msg}</p>{/if}
      <button type="submit" disabled={loading || !curPw}
        class="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        style="background: var(--color-primary)"
      >{loading ? 'saving...' : 'save'}</button>
    </form>
  </GlassCard>

  <button onclick={onlogout}
    class="w-full mt-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] flex items-center justify-center gap-2"
    style="color: var(--text-secondary); border: 1px solid var(--border-default)"
  >
    <LogOut size={14} />
    logout
  </button>
</div>