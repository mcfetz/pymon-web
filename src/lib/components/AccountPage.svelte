<script>
  import LogOut from 'lucide-svelte/icons/log-out';
  import User from 'lucide-svelte/icons/user';
  import UserPlus from 'lucide-svelte/icons/user-plus';
  import Shield from 'lucide-svelte/icons/shield';
  import GlassCard from './GlassCard.svelte';
  import {
    createUser, deleteUser, fetchUsers, updateUser,
  } from '../api.js';

  let {
    onlogout = () => {},
    onsave = () => {},
    currentUser = null,
  } = $props();

  let username = $state('');
  let curPw = $state('');
  let newPw = $state('');
  let newPw2 = $state('');
  let msg = $state('');
  let error = $state('');
  let loading = $state(false);

  let users = $state([]);
  let usersLoading = $state(false);
  let usersError = $state('');
  let usersMsg = $state('');
  let roleDrafts = $state({});
  let newUser = $state({ username: '', display_name: '', password: '', role: 'user' });
  let creatingUser = $state(false);

  let isAdmin = $derived(currentUser?.role === 'admin');

  async function loadUsers() {
    if (!isAdmin) return;
    usersLoading = true; usersError = '';
    try {
      users = await fetchUsers();
      roleDrafts = Object.fromEntries(users.map(u => [u.username, u.role]));
    } catch (e) { usersError = e.message; }
    finally { usersLoading = false; }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    if (creatingUser) return;
    creatingUser = true; usersError = ''; usersMsg = '';
    try {
      await createUser(newUser);
      newUser = { username: '', display_name: '', password: '', role: 'user' };
      await loadUsers();
    } catch (err) { usersError = err.message; }
    finally { creatingUser = false; }
  }

  async function saveRole(user) {
    usersError = ''; usersMsg = '';
    try {
      await updateUser(user.username, { role: roleDrafts[user.username] });
      await loadUsers();
    } catch (err) { usersError = err.message; }
  }

  async function resetPassword(user) {
    const password = window.prompt(`New password for ${user.username} (min. 8 characters)`);
    if (!password) return;
    usersError = ''; usersMsg = '';
    try {
      await updateUser(user.username, { password });
      usersMsg = `password reset for ${user.username}`;
    } catch (err) { usersError = err.message; }
  }

  async function removeUser(user) {
    if (!confirm(`Delete user ${user.username}?`)) return;
    usersError = ''; usersMsg = '';
    try {
      await deleteUser(user.username);
      await loadUsers();
    } catch (err) { usersError = err.message; }
  }

  $effect(() => {
    if (isAdmin) loadUsers();
  });

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
    <div>
      <h2 class="text-lg font-bold m-0" style="color: var(--text-primary)">Account</h2>
      {#if currentUser}
        <div class="text-[11px]" style="color:var(--text-secondary)">
          signed in as {currentUser.display_name || currentUser.username} ({currentUser.role})
        </div>
      {/if}
    </div>
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

  {#if isAdmin}
    <div class="flex items-center gap-3 mb-3 mt-8">
      <div class="p-2.5 rounded-2xl" style="background: rgba(var(--color-primary-rgb), 0.1)">
        <Shield size={22} strokeWidth={1.8} style="color: var(--color-primary)" />
      </div>
      <div>
        <h2 class="text-lg font-bold m-0" style="color: var(--text-primary)">Users</h2>
        <div class="text-[11px]" style="color: var(--text-secondary)">admin and user accounts</div>
      </div>
    </div>

    <GlassCard>
      <div class="p-5 flex flex-col gap-3">
        {#if usersLoading}
          <div class="text-xs" style="color: var(--text-secondary)">loading users...</div>
        {:else}
          {#each users as user (user.username)}
            {@const isSelf = user.username === currentUser?.username}
            <div class="rounded-xl p-3" style="border:1px solid var(--border-default)">
              <div class="flex items-center gap-2 mb-2 min-w-0">
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium truncate" style="color:var(--text-primary)">
                    {user.display_name || user.username}
                    {#if isSelf}<span class="text-[10px] font-normal" style="color:var(--text-secondary)">(you)</span>{/if}
                  </div>
                  <div class="text-[11px] font-mono truncate" style="color:var(--text-secondary)">@{user.username}</div>
                </div>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-medium" style="background:{user.role === 'admin' ? 'rgba(139,92,246,0.12)' : 'rgba(var(--color-primary-rgb),0.1)'};color:{user.role === 'admin' ? '#8b5cf6' : 'var(--color-primary)'}">
                  {user.role}
                </span>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <select
                  bind:value={roleDrafts[user.username]}
                  disabled={isSelf}
                  class="px-2 py-1 rounded-lg border text-[11px] bg-transparent outline-none"
                  style="border-color:var(--border-default);color:var(--text-primary)"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
                <button
                  onclick={() => saveRole(user)}
                  disabled={isSelf || roleDrafts[user.username] === user.role}
                  class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:brightness-110 disabled:opacity-40"
                  style="background:rgba(var(--color-primary-rgb),0.1);color:var(--color-primary)"
                >Save role</button>
                {#if !isSelf}
                  <button
                    onclick={() => resetPassword(user)}
                    class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:brightness-110"
                    style="background:rgba(245,158,11,0.1);color:#f59e0b"
                  >Reset password</button>
                  <button
                    onclick={() => removeUser(user)}
                    class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:brightness-110"
                    style="background:rgba(239,68,68,0.1);color:#ef4444"
                  >Delete</button>
                {/if}
              </div>
            </div>
          {/each}
        {/if}

        {#if usersError}
          <div class="text-xs px-2 py-1.5 rounded-lg" style="background:rgba(239,68,68,0.08);color:#ef4444">{usersError}</div>
        {/if}
        {#if usersMsg}
          <div class="text-xs px-2 py-1.5 rounded-lg" style="background:rgba(34,197,94,0.08);color:#22c55e">{usersMsg}</div>
        {/if}

        <form onsubmit={handleCreateUser} class="rounded-xl p-3 flex flex-col gap-2" style="border:1px solid var(--border-default);background:rgba(var(--color-primary-rgb),0.03)">
          <div class="flex items-center gap-1.5 text-[11px] font-semibold" style="color:var(--text-secondary)">
            <UserPlus size={12} />
            Add user
          </div>
          <div class="grid grid-cols-2 gap-2">
            <input type="text" bind:value={newUser.username} placeholder="username" required
              class="px-2.5 py-2 rounded-lg border text-xs bg-transparent outline-none"
              style="border-color:var(--border-default);color:var(--text-primary)" />
            <input type="text" bind:value={newUser.display_name} placeholder="display name"
              class="px-2.5 py-2 rounded-lg border text-xs bg-transparent outline-none"
              style="border-color:var(--border-default);color:var(--text-primary)" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <input type="password" bind:value={newUser.password} placeholder="password (min. 8)" required minlength="8"
              class="px-2.5 py-2 rounded-lg border text-xs bg-transparent outline-none"
              style="border-color:var(--border-default);color:var(--text-primary)" />
            <select bind:value={newUser.role}
              class="px-2.5 py-2 rounded-lg border text-xs bg-transparent outline-none"
              style="border-color:var(--border-default);color:var(--text-primary)">
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <button type="submit" disabled={creatingUser}
            class="py-2 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style="background:var(--color-primary)"
          >{creatingUser ? 'creating...' : 'Create user'}</button>
        </form>
      </div>
    </GlassCard>
  {/if}

  <button onclick={onlogout}
    class="w-full mt-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] flex items-center justify-center gap-2"
    style="color: var(--text-secondary); border: 1px solid var(--border-default)"
  >
    <LogOut size={14} />
    logout
  </button>
</div>