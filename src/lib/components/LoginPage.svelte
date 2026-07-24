<script>
  import Shield from 'lucide-svelte/icons/shield';

  let { error = '', loading = false, onsubmit = () => {} } = $props();
  let username = $state('');
  let password = $state('');

  function handle(e) {
    e.preventDefault();
    onsubmit(username, password);
  }
</script>

<div class="flex items-center justify-center min-h-[70vh] p-4">
  <div class="glass w-full max-w-sm p-8 animate-scale-in">
    <div class="flex flex-col items-center mb-6">
      <div class="icon-wrap mb-3">
        <div class="p-3 rounded-2xl" style="background: rgba(var(--color-primary-rgb), 0.1)">
          <Shield size={32} strokeWidth={1.8} style="color: var(--color-primary)" />
        </div>
      </div>
      <h1 class="text-xl font-bold m-0" style="color: var(--text-primary)">pymon</h1>
      <p class="text-sm mt-1 m-0" style="color: var(--text-secondary)">monitoring dashboard</p>
    </div>

    <form onsubmit={handle} class="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Username"
        bind:value={username}
        disabled={loading}
        required
        class="w-full px-3 py-2.5 rounded-lg border text-sm transition-colors outline-none focus:ring-2"
        style="background: var(--bg-surface); border-color: var(--border-default); color: var(--text-primary)"
        onfocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
        onblur={(e) => e.target.style.borderColor = 'var(--border-default)'}
      />
      <input
        type="password"
        placeholder="Password"
        bind:value={password}
        disabled={loading}
        required
        class="w-full px-3 py-2.5 rounded-lg border text-sm transition-colors outline-none focus:ring-2"
        style="background: var(--bg-surface); border-color: var(--border-default); color: var(--text-primary)"
        onfocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
        onblur={(e) => e.target.style.borderColor = 'var(--border-default)'}
      />
      {#if error}
        <p class="text-xs text-red-400 m-0">{error}</p>
      {/if}
      <button
        type="submit"
        disabled={loading || !username || !password}
        class="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 mt-1
               hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        style="background: var(--color-primary)"
      >
        {loading ? 'logging in...' : 'login'}
      </button>
    </form>
  </div>
</div>