<script>
  import { onMount } from 'svelte';
  import { AlertTriangle, AlertCircle, Info, Plus } from 'lucide-svelte';
  import PluginForm from './PluginForm.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import {
    fetchPluginSchemas, fetchAdminAgents, fetchAdminGroups,
    createAgent, deleteAgent, setAgentGroups, setAgentPluginConfig,
    removeAgentPlugin, setGroupPlugins, deleteGroup, setAgentEnabled, updateAgent,
    fetchRuleSchema, fetchRules, saveRule, deleteRule,
    fetchExecutors, saveExecutor, deleteExecutor,
    fetchNotifications, saveNotification, deleteNotification, fetchNotifySchema, testNotification,
    fetchAdminPlugins, fetchPluginSource, fetchPluginTemplate, savePluginSource, deletePlugin, togglePluginEnabled,
    updateAccount, setToken,
    fetchBlackouts, fetchBlackoutSchema, saveBlackout, deleteBlackout,
  } from './api.js';

  let { pendingRule = null, onLogout = () => {} } = $props();

  $effect(() => {
    if (pendingRule?.id && pendingRule.id in rules) {
      view = 'rules';
      editRule(pendingRule.id);
    }
  });

  function fmtTime(iso) {
    if (!iso) return '';
    const s = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
    const d = new Date(s);
    return d.toLocaleString();
  }

  function genId(prefix) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 7; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return prefix + s;
  }

  let view = $state('agents'); // 'agents' | 'rules' | 'executors' | 'notify' | 'groups' | 'plugins' | 'account'
  // ── Account state ──
  let accUsername = $state('');
  let accCurPw = $state('');
  let accNewPw = $state('');
  let accNewPw2 = $state('');
  let accMsg = $state('');
  let accError = $state('');
  let accLoading = $state(false);

  async function handleAccountSave() {
    accMsg = '';
    accError = '';
    if (accNewPw && accNewPw !== accNewPw2) { accError = 'passwords do not match'; return; }
    accLoading = true;
    try {
      const body = { current_password: accCurPw };
      if (accUsername) body.new_username = accUsername;
      if (accNewPw) body.new_password = accNewPw;
      const res = await updateAccount(body);
      setToken(res.token);
      accMsg = 'account updated';
      accCurPw = '';
      accNewPw = '';
      accNewPw2 = '';
    } catch (e) { accError = e.message; }
    finally { accLoading = false; }
  }
  let schemas = $state({});
  let agents = $state({});
  let groups = $state({});
  let loading = $state(true);
  let error = $state(null);
  let selectedAgent = $state(null);
  let selectedPlugin = $state(null);
  let editedPluginConfig = $state(null);
  let saving = $state(false);
  let newAgentId = $state('');
  let showAgentDialog = $state(false);
  let editingAgent = $state(null);
  let editedAgentData = $state(null);

  // Rules state
  let rules = $state({});
  let ruleSchema = $state({ fields: [] });
  let editingRule = $state(null);
  let editedRule = $state(null);
  let showRuleDialog = $state(false);

  // Executors state
  let executors = $state({});
  let editingExec = $state(null);
  let editedExec = $state(null);
  let showExecDialog = $state(false);

  // Notifications state
  let notifications = $state({});
  let notifySchema = $state({ fields: [] });
  let editingNotify = $state(null);
  let editedNotify = $state(null);
  let showNotifyDialog = $state(false);

  // Groups state
  let editingGroup = $state(null);
  let editedGroup = $state(null);
  let showGroupDialog = $state(false);
  let allPluginNames = $state([]);

  // Plugin management state
  let pluginList = $state([]);
  let selPluginName = $state(null);
  let pluginSource = $state('');
  let pluginSourceDirty = $state(false);
  let checkResult = $state(null);
  let checking = $state(false);
  let showPluginDialog = $state(false);
  let editedPlugin = $state(null);
  let fsEditor = $state(null);
  let expandedAgents = $state(false);
  let expandedExecutors = $state(false);
  let expandedNotifications = $state(false);
  let expandedBlackoutRules = $state(false);
  let expandedBlackoutAgents = $state(false);
  let expandedBlackoutGroups = $state(false);
  let showBlackoutDialog = $state(false);
  let editingBlackout = $state(null);
  let editedBlackout = $state(null);
  let blackouts = $state({});
  let blackoutSchema = $state({ fields: [] }); // fullscreen editor content

  // ── Filters ──
  let filterText = $state('');

  let filteredAgents = $derived.by(() => {
    const ids = Object.keys(agents);
    if (!filterText) return ids.sort();
    const q = filterText.toLowerCase();
    return ids.filter(id => {
      const a = agents[id];
      return (a.title || id).toLowerCase().includes(q) || id.toLowerCase().includes(q);
    }).sort();
  });

  let filteredRules = $derived.by(() => {
    const vals = Object.values(rules);
    if (!filterText) return vals.sort((a, b) => a.id.localeCompare(b.id));
    const q = filterText.toLowerCase();
    return vals.filter(r => r.id.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q))
      .sort((a, b) => a.id.localeCompare(b.id));
  });

  let filteredExecutors = $derived.by(() => {
    const vals = Object.values(executors);
    if (!filterText) return vals.sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
    const q = filterText.toLowerCase();
    return vals.filter(ex => (ex.title || ex.id).toLowerCase().includes(q) || ex.id.toLowerCase().includes(q) || (ex.command || '').toLowerCase().includes(q))
      .sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
  });

  let filteredNotifications = $derived.by(() => {
    const vals = Object.values(notifications);
    if (!filterText) return vals.sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
    const q = filterText.toLowerCase();
    return vals.filter(n => (n.title || n.id).toLowerCase().includes(q) || n.id.toLowerCase().includes(q) || (n.to || '').toLowerCase().includes(q))
      .sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
  });

  let filteredGroups = $derived.by(() => {
    const ids = Object.keys(groups);
    if (!filterText) return ids.sort();
    const q = filterText.toLowerCase();
    return ids.filter(gid => gid.toLowerCase().includes(q)).sort();
  });

  let filteredPlugins = $derived.by(() => {
    if (!filterText) return [...pluginList].sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name));
    const q = filterText.toLowerCase();
    return pluginList.filter(p => (p.label || '').toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
      .sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name));
  });

  async function load() {
    loading = true; error = null;
    try {
      const [s, a, g, rs, rsc, ex, nt, ns, pl, bs, bsc] = await Promise.all([
        fetchPluginSchemas(), fetchAdminAgents(), fetchAdminGroups(),
        fetchRules(), fetchRuleSchema(), fetchExecutors(),
        fetchNotifications(), fetchNotifySchema(),
        fetchAdminPlugins(),
        fetchBlackouts(), fetchBlackoutSchema(),
      ]);
      schemas = s; agents = a; groups = g; rules = rs; ruleSchema = rsc;
      executors = ex; notifications = nt; notifySchema = ns; pluginList = pl;
      blackouts = bs; blackoutSchema = bsc;
      allPluginNames = Object.keys(s);
    } catch (e) { error = e.message; }
    finally { loading = false; }
  }

  function openAgentDialog(id) {
    editingAgent = id;
    selectedAgent = id;
    editedAgentData = { ...agents[id], id };
    selectedPlugin = null;
    editedPluginConfig = null;
    showAgentDialog = true;
  }

  function closeAgentDialog() {
    showAgentDialog = false;
    editingAgent = null;
    selectedAgent = null;
    editedAgentData = null;
    selectedPlugin = null;
    editedPluginConfig = null;
  }

  async function handleCreateAgent() {
    if (!newAgentId.trim()) return;
    try {
      await createAgent(newAgentId.trim());
      newAgentId = '';
      await load();
    } catch (e) { error = e.message; }
  }

  async function handleDeleteAgent(id) {
    if (!confirm(`Really delete agent ${id}?`)) return;
    try {
      await deleteAgent(id);
      if (selectedAgent === id) { selectedAgent = null; selectedPlugin = null; }
      await load();
    } catch (e) { error = e.message; }
  }

  async function toggleGroup(agentId, group) {
    const a = agents[agentId];
    const g = [...a.groups];
    if (g.includes(group)) g.splice(g.indexOf(group), 1);
    else g.push(group);
    try {
      await setAgentGroups(agentId, g);
      await load();
    } catch (e) { error = e.message; }
  }

  async function togglePlugin(agentId, plugin) {
    const a = agents[agentId];
    const hasPlugin = plugin in (a.plugins || {});
    try {
      if (hasPlugin) {
        await removeAgentPlugin(agentId, plugin);
      } else {
        const schema = schemas[plugin];
        const defaults = {};
        for (const f of (schema?.fields || [])) {
          if ('default' in f) defaults[f.key] = f.default;
        }
        await setAgentPluginConfig(agentId, plugin, defaults);
      }
      await load();
    } catch (e) { error = e.message; }
  }

  async function savePluginConfig(agentId, plugin) {
    saving = true;
    try {
      await setAgentPluginConfig(agentId, plugin, editedPluginConfig);
      selectedPlugin = null;
      editedPluginConfig = null;
      await load();
    } catch (e) { error = e.message; }
    finally { saving = false; }
  }

  function selectPlugin(agentId, plugin) {
    const a = agents[agentId];
    const cfg = a?.plugins?.[plugin] || {};
    selectedPlugin = plugin;
    editedPluginConfig = { ...cfg };
  }

  // ── Rules ──
  function openNewRule() {
    const def = {};
    for (const f of ruleSchema.fields) {
      if ('default' in f) def[f.key] = f.default;
      else def[f.key] = '';
    }
    def.id = '';
    editingRule = def;
    editedRule = { ...def };
    showRuleDialog = true;
  }

  function editRule(id) {
    editingRule = id;
    editedRule = { ...rules[id], id };
    showRuleDialog = true;
  }

  async function handleSaveRule() {
    if (!editedRule) return;
    if (!editedRule.id?.trim()) editedRule.id = genId('r');
    saving = true;
    try {
      if (editingRule && typeof editingRule === 'string' && editingRule !== editedRule.id) {
        await deleteRule(editingRule);
      }
      await saveRule(editedRule.id, editedRule);
      showRuleDialog = false;
      editingRule = null;
      editedRule = null;
      rules = await fetchRules();
    } catch (e) { error = e.message; }
    finally { saving = false; }
  }

  async function handleDeleteRule(id) {
    if (!confirm(`Really delete rule ${id}?`)) return;
    try {
      await deleteRule(id);
      rules = await fetchRules();
    } catch (e) { error = e.message; }
  }

  // ── Executors ──
  function openNewExec() {
    editedExec = { id: '', command: '' };
    showExecDialog = true;
  }

  function editExec(id) {
    editingExec = id;
    editedExec = { ...executors[id] };
    showExecDialog = true;
  }

  async function handleSaveExec() {
    if (!editedExec) return;
    if (!editedExec.id?.trim()) editedExec.id = genId('e');
    saving = true;
    try {
      if (editingExec && editingExec !== editedExec.id) {
        await deleteExecutor(editingExec);
      }
      await saveExecutor(editedExec.id, editedExec);
      showExecDialog = false;
      editedExec = null;
      editingExec = null;
      executors = await fetchExecutors();
    } catch (e) { error = e.message; }
    finally { saving = false; }
  }

  async function handleDeleteExec(id) {
    if (!confirm(`Really delete executor ${id}?`)) return;
    try {
      await deleteExecutor(id);
      executors = await fetchExecutors();
    } catch (e) { error = e.message; }
  }

  // ── Notifications ──
  function openNewNotify() {
    const def = {};
    for (const f of notifySchema.fields) {
      if ('default' in f) def[f.key] = f.default;
      else def[f.key] = '';
    }
    def.id = '';
    editedNotify = def;
    showNotifyDialog = true;
  }

  function editNotify(id) {
    editingNotify = id;
    editedNotify = { ...notifications[id] };
    showNotifyDialog = true;
  }

  async function handleSaveNotify() {
    if (!editedNotify) return;
    if (!editedNotify.id?.trim()) editedNotify.id = genId('n');
    saving = true;
    try {
      if (editingNotify && editingNotify !== editedNotify.id) {
        await deleteNotification(editingNotify);
      }
      await saveNotification(editedNotify.id, editedNotify);
      showNotifyDialog = false;
      editedNotify = null;
      editingNotify = null;
      notifications = await fetchNotifications();
    } catch (e) { error = e.message; }
    finally { saving = false; }
  }

  async function handleDeleteNotify(id) {
    if (!confirm(`Really delete notification ${id}?`)) return;
    try {
      await deleteNotification(id);
      notifications = await fetchNotifications();
    } catch (e) { error = e.message; }
  }

  // All available plugins across all groups
  let allPlugins = $derived.by(() => {
    const set = new Set();
    for (const g of Object.values(groups)) {
      for (const p of g) set.add(p);
    }
    return [...set].sort();
  });

  let agentPlugins = $derived.by(() => {
    if (!selectedAgent || !agents[selectedAgent]) return [];
    const a = agents[selectedAgent];
    // Resolve from groups + direct assignments
    const fromGroups = new Set();
    for (const g of a.groups) {
      for (const p of (groups[g] || [])) fromGroups.add(p);
    }
    const direct = new Set(Object.keys(a.plugins || {}));
    return [...new Set([...fromGroups, ...direct])].sort();
  });

  function closeFs() {
    if (fsEditor !== null) {
      pluginSource = fsEditor;
      fsEditor = null;
    }
  }

  function onFsKeydown(e) {
    if (e.key === 'Escape' && fsEditor !== null) closeFs();
  }

  function openNewBlackout() {
    const def = {};
    for (const f of blackoutSchema.fields) {
      if ('default' in f) def[f.key] = Array.isArray(f.default) ? [...f.default] : f.default;
      else def[f.key] = '';
    }
    def.id = '';
    editingBlackout = def;
    editedBlackout = { ...def };
    showBlackoutDialog = true;
  }
  function editBlackout(id) {
    editingBlackout = id;
    editedBlackout = { ...blackouts[id], id };
    showBlackoutDialog = true;
  }
  async function handleSaveBlackout() {
    if (!editedBlackout) return;
    if (!editedBlackout.id?.trim()) editedBlackout.id = genId('b');
    saving = true;
    try {
      if (editingBlackout && typeof editingBlackout === 'string' && editingBlackout !== editedBlackout.id)
        await deleteBlackout(editingBlackout);
      await saveBlackout(editedBlackout.id, editedBlackout);
      showBlackoutDialog = false;
      editingBlackout = null;
      editedBlackout = null;
      blackouts = await fetchBlackouts();
    } catch (e) { error = e.message; }
    finally { saving = false; }
  }
  async function handleDeleteBlackout(id) {
    if (!confirm(`Really delete blackout ${id}?`)) return;
    try { await deleteBlackout(id); blackouts = await fetchBlackouts(); }
    catch (e) { error = e.message; }
  }
  let filteredBlackouts = $derived.by(() => {
    const vals = Object.values(blackouts);
    if (!filterText) return vals.sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
    const q = filterText.toLowerCase();
    return vals.filter(b => (b.title || b.id).toLowerCase().includes(q)).sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
  });

  onMount(load);
</script>

{#if error}
    <div class="glass px-4 py-3 rounded-[var(--radius-card)] text-sm text-red-400 border-l-2 border-red-400 mb-4">{error}</div>
  {/if}

  {#if loading}
    <div class="text-center py-16 text-sm" style="color: var(--text-secondary)">loading configuration...</div>
  {:else}
    <div class="flex gap-0 mb-6 border-b overflow-x-auto" style="border-color: var(--border-default)">
      {#each ['Agents','Rules','Executors','Notifications','Groups','Blackouts','Plugins'] as label}
        {@const id = label === 'Notifications' ? 'notify' : label.toLowerCase()}
        <button
          onclick={() => view = id}
          class="relative px-3 py-2 text-xs font-medium transition-colors duration-150 whitespace-nowrap"
          class:font-semibold={view === id}
          style="color: {view === id ? 'var(--color-primary)' : 'var(--text-secondary)'}"
        >
          {label}
          {#if view === id}
            <span class="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style="background: var(--color-primary)"></span>
          {/if}
        </button>
      {/each}
    </div>

    {#if view === 'agents'}
  <div class="rules-view">
    <div class="rules-header">
      <h3>Agents</h3>
      <input type="text" class="filter-input" placeholder="Filter agents..." bind:value={filterText} />
      <button class="ml-auto p-1.5 rounded-full text-white transition-all duration-150 hover:scale-110 active:scale-95" style="background: var(--color-primary)" onclick={async () => {
        const title = prompt('Agent title:');
        if (!title?.trim()) return;
        const id = genId('a');
        try { await createAgent(id, [], title.trim()); await load(); }
        catch (e) { error = e.message; }
      }}><Plus size={14} strokeWidth={2} /></button>
    </div>
    {#if filteredAgents.length === 0}
      <div class="empty">No agents</div>
    {:else}
      {#each filteredAgents as id}
        {@const a = agents[id]}
        <div class="rule-card">
          <div class="rule-head">
            <span class="status-dot" class:online={a.online} style="display:inline-block;width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-right:0.3rem;"></span>
            <span class="rule-id">{a.title || id}</span>
            <span style="margin-left:auto;font-size:0.75rem;color:#888;">
              {#if a.last_seen}{fmtTime(a.last_seen)}{:else}never{/if}
            </span>
          </div>
          <div class="rule-desc" style="font-size:0.72rem;">groups: {a.groups?.length ? a.groups.join(', ') : '—'}</div>
          <div class="rule-actions">
            <span class="rule-status" class:active={a.enabled !== false}>{a.enabled !== false ? 'Enabled' : 'Disabled'}</span>
            <button class="btn-edit" onclick={() => openAgentDialog(id)}>Edit</button>
            <button class="btn-dup" onclick={async () => {
              const newId = genId('a');
              await createAgent(newId, a.groups || []);
              for (const [plugin, cfg] of Object.entries(a.plugins || {})) {
                await setAgentPluginConfig(newId, plugin, cfg);
              }
              await load();
            }}>Duplicate</button>
            <button class="btn-del" onclick={() => handleDeleteAgent(id)}>Delete</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
{/if}

{#if view === 'rules'}
  <div class="rules-view">
    <div class="rules-header">
      <h3>Alarm Rules</h3>
      <input type="text" class="filter-input" placeholder="Filter rules..." bind:value={filterText} />
      <button class="ml-auto p-1.5 rounded-full text-white transition-all duration-150 hover:scale-110 active:scale-95" style="background: var(--color-primary)" onclick={openNewRule}><Plus size={14} strokeWidth={2} /></button>
    </div>

    {#each filteredRules as rule (rule.id)}
      <div class="rule-card" style="border-left: 3px solid {rule.severity === 'critical' ? '#ef4444' : rule.severity === 'warning' ? '#f59e0b' : '#3b82f6'}">
        <div class="rule-head">
          <svelte:component this={rule.severity === 'critical' ? AlertCircle : rule.severity === 'warning' ? AlertTriangle : Info} size={14} strokeWidth={2} style="color: {rule.severity === 'critical' ? '#ef4444' : rule.severity === 'warning' ? '#f59e0b' : '#3b82f6'}" />
          <span class="rule-id">{rule.id}</span>
        </div>
        <div class="rule-desc">{rule.description || '—'}</div>
        <div class="rule-actions">
          <span class="rule-status" class:active={rule.enabled}>{rule.enabled ? 'Active' : 'Inactive'}</span>
          <button class="btn-edit" onclick={() => editRule(rule.id)}>Edit</button>
          <button class="btn-dup" onclick={async () => {
            const copy = { ...rule, id: genId('r') };
            await saveRule(copy.id, copy);
            rules = await fetchRules();
          }}>Duplicate</button>
          <button class="btn-del" onclick={() => handleDeleteRule(rule.id)}>Delete</button>
        </div>
      </div>
    {/each}
  </div>
{/if}
{#if view === 'executors'}
  <div class="rules-view">
    <div class="rules-header">
      <h3>Executors</h3>
      <input type="text" class="filter-input" placeholder="Filter executors..." bind:value={filterText} />
      <button class="ml-auto p-1.5 rounded-full text-white transition-all duration-150 hover:scale-110 active:scale-95" style="background: var(--color-primary)" onclick={openNewExec}><Plus size={14} strokeWidth={2} /></button>
    </div>
    {#each filteredExecutors as exec (exec.id)}
      <div class="rule-card">
        <div class="rule-head">
          <span class="rule-id">{exec.title || exec.id}</span>
        </div>
        <div class="rule-actions">
          <span class="rule-status" class:active={exec.enabled ?? true}>{exec.enabled ?? true ? 'Active' : 'Inactive'}</span>
          <button class="btn-edit" onclick={() => editExec(exec.id)}>Edit</button>
          <button class="btn-dup" onclick={async () => {
            const copy = { ...exec, id: genId('e') };
            await saveExecutor(copy.id, copy);
            executors = await fetchExecutors();
          }}>Duplicate</button>
          <button class="btn-del" onclick={() => handleDeleteExec(exec.id)}>Delete</button>
        </div>
      </div>
    {/each}
  </div>
{/if}
{#if view === 'notify'}
  <div class="rules-view">
    <div class="rules-header">
      <h3>Notifications</h3>
      <input type="text" class="filter-input" placeholder="Filter notifications..." bind:value={filterText} />
      <button class="ml-auto p-1.5 rounded-full text-white transition-all duration-150 hover:scale-110 active:scale-95" style="background: var(--color-primary)" onclick={openNewNotify}><Plus size={14} strokeWidth={2} /></button>
    </div>
    {#each filteredNotifications as n (n.id)}
      <div class="rule-card">
        <div class="rule-head">
          <span class="rule-id">{n.title || n.id}</span>
          <span class="rule-badge">{n.to}</span>
        </div>
        <div class="rule-actions">
          <span class="rule-status" class:active={n.enabled ?? true}>{n.enabled ?? true ? 'Active' : 'Inactive'}</span>
          <button class="btn-edit" onclick={() => editNotify(n.id)}>Edit</button>
          <button class="btn-dup" onclick={async () => {
            const copy = { ...n, id: genId('n') };
            await saveNotification(copy.id, copy);
            notifications = await fetchNotifications();
          }}>Duplicate</button>
          <button class="btn-del" onclick={() => handleDeleteNotify(n.id)}>Delete</button>
        </div>
      </div>
    {/each}
  </div>
{/if}
{#if view === 'groups'}
  <div class="rules-view">
    <div class="rules-header">
      <h3>Groups</h3>
      <input type="text" class="filter-input" placeholder="Filter groups..." bind:value={filterText} />
      <button class="ml-auto p-1.5 rounded-full text-white transition-all duration-150 hover:scale-110 active:scale-95" style="background: var(--color-primary)" onclick={() => { editedGroup = { plugins: [] }; showGroupDialog = true; }}><Plus size={14} strokeWidth={2} /></button>
    </div>
    {#if filteredGroups.length === 0}
      <div class="empty">No groups</div>
    {:else}
      {#each filteredGroups as gid}
        <div class="rule-card">
          <div class="rule-head">
            <span class="rule-id">{gid}</span>
          </div>
          <div class="rule-desc">{(groups[gid] || []).join(', ') || '—'}</div>
          <div class="rule-actions">
            <button class="btn-edit" onclick={() => { editedGroup = { id: gid, plugins: [...(groups[gid] || [])] }; showGroupDialog = true; }}>Edit</button>
            <button class="btn-del" onclick={async () => { if (!confirm(`Delete group ${gid}?`)) return; try { await deleteGroup(gid); groups = await fetchAdminGroups(); } catch (e) { error = e.message; } }}>Delete</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
{/if}
{#if view === 'blackouts'}
  <div class="rules-view">
    <div class="rules-header">
      <h3>Blackouts</h3>
      <input type="text" class="filter-input" placeholder="Filter blackouts..." bind:value={filterText} />
      <button class="ml-auto p-1.5 rounded-full text-white transition-all duration-150 hover:scale-110 active:scale-95" style="background: var(--color-primary)" onclick={openNewBlackout}><Plus size={14} strokeWidth={2} /></button>
    </div>
    {#each filteredBlackouts as b}
      <div class="rule-card">
<div class="rule-head">
            <span class="rule-id">{b.title || b.id}</span>
          </div>
          <div class="rule-desc">{b.weekdays?.length ? b.weekdays.map(d => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).join(', ') : 'every day'} · {b.start_time}–{b.end_time} · rules: {b.target_rules?.length || 0} · agents: {b.target_agents?.length || 0} · groups: {b.target_groups?.length || 0}</div>
        <div class="rule-actions">
          <span class="rule-status" class:active={b.enabled !== false}>{b.enabled !== false ? 'Active' : 'Inactive'}</span>
          <button class="btn-edit" onclick={() => editBlackout(b.id)}>Edit</button>
          <button class="btn-dup" onclick={async () => { const copy = { ...b, id: genId('b') }; await saveBlackout(copy.id, copy); blackouts = await fetchBlackouts(); }}>Duplicate</button>
          <button class="btn-del" onclick={() => handleDeleteBlackout(b.id)}>Delete</button>
        </div>
      </div>
    {/each}
    {#if filteredBlackouts.length === 0}
      <div class="empty">No blackouts</div>
    {/if}
  </div>
{/if}
{#if view === 'plugins'}
  <div class="rules-view">
    <div class="rules-header">
      <h3>Plugins</h3>
      <input type="text" class="filter-input" placeholder="Filter plugins..." bind:value={filterText} />
      <div class="ml-auto" style="display:flex;gap:0.4rem;">
        <button class="p-1.5 rounded-full text-white transition-all duration-150 hover:scale-110 active:scale-95" style="background: var(--color-primary)" onclick={async () => {
          const name = prompt('New plugin name (without .py):');
          if (!name?.trim()) return;
          const nn = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
          const template = `#!/usr/bin/env python3
"""${nn}.py — Description of your plugin. No external deps."""
import json
import sys

# ── Schema ──
# Defines which fields are shown in the config UI.
# Supported field types:
#   "number"       — integer/float input
#   "string"       — text input
#   "boolean"      — checkbox
#   "array:string" — list of strings with +/− buttons
#   "array:object" — list of objects with sub-fields
__schema__ = {
    "label": "${nn}",
    "description": "Description of your plugin",
    "fields": [
        {
            "key": "sleep",
            "label": "Interval (s)",
            "type": "number",
            "default": 60,
            "min": 5,
        },
        {
            "key": "api_url",
            "label": "API URL",
            "type": "string",
            "default": "https://example.com/api",
            "optional": True,
        },
        {
            "key": "verbose",
            "label": "Verbose logging",
            "type": "boolean",
            "default": False,
            "optional": True,
        },
        {
            "key": "hosts",
            "label": "Host list",
            "type": "array:string",
            "default": ["host1", "host2"],
        },
        {
            "key": "urls",
            "label": "URL checks",
            "type": "array:object",
            "default": [],
            "fields": [
                {"key": "name", "label": "Name", "type": "string"},
                {"key": "url", "label": "URL", "type": "string"},
                {
                    "key": "timeout",
                    "label": "Timeout (s)",
                    "type": "number",
                    "default": 5,
                    "optional": True,
                },
            ],
        },
    ],
}

# ── Plugin logic ──
# Config is read from stdin as JSON.
# Output must be a single JSON object with flat key-value pairs.
# Keys become metric names, values must be numbers, strings,
# or booleans.
# Example: {"cpu_percent": 45.2, "status": "ok"}

if __name__ == "__main__":
    config = json.load(sys.stdin)

    sleep = config.get("sleep", 60)  # noqa: F841
    api_url = config.get("api_url", "")
    verbose = config.get("verbose", False)  # noqa: F841
    hosts = config.get("hosts", [])  # noqa: F841
    url_checks = config.get("urls", [])  # noqa: F841

    # Your monitoring logic here
    # ...

    # Return metrics as flat JSON
    output = {
        "example_metric_1": 42.0,
        "example_status": "running",
    }
    print(json.dumps(output))
`;
          try {
            await fetch(`/api/admin/plugins/${nn}/source`, { method: 'PUT', headers: { 'agentid': 'admin', 'X-API-Key': '333', 'Content-Type': 'text/plain' }, body: template });
            pluginList = await fetchAdminPlugins();
            // Open the editor with the new plugin
            selPluginName = nn;
            pluginSource = template;
            pluginSourceDirty = false;
            checkResult = null;
          } catch (err) { error = err.message; }
        }}><Plus size={14} strokeWidth={2} /></button>
        <label style="cursor:pointer;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;border:1px dashed var(--border-default);color:var(--text-secondary);transition:all 0.15s">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <input type="file" accept=".py" style="display:none" onchange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            const name = file.name.replace(/\.py$/, '');
            const text = await file.text();
            try {
              await fetch('/api/admin/plugins/'+name+'/source', { method: 'PUT', headers: { 'agentid': 'admin', 'X-API-Key': '333', 'Content-Type': 'text/plain' }, body: text });
              pluginList = await fetchAdminPlugins();
            } catch (err) { error = err.message; }
            e.target.value = '';
          }} />
        </label>
      </div>
    </div>
    {#each filteredPlugins as p}
      <div class="rule-card" style="cursor:pointer;" class:active={selPluginName === p.name}>
<div class="rule-head">
            <span class="rule-id">{p.label}</span>
        </div>
        <div class="rule-desc">{p.description || '—'}</div>
        <div class="rule-actions">
          <span class="rule-status" class:active={p.enabled !== false}>{p.enabled !== false ? 'Active' : 'Inactive'}</span>
          <button class="btn-edit" onclick={async () => { const pi = pluginList.find(x => x.name === p.name); editedPlugin = { ...pi }; pluginSource = await fetchPluginSource(pi.name); pluginSourceDirty = false; checkResult = null; showPluginDialog = true; }}>Edit</button>
          <a href="/api/admin/plugins/{p.name}/source" download="{p.name}.py" style="font-size:0.78rem;color:#4361ee;text-decoration:none;" onclick={(e) => e.stopPropagation()}>Download</a>
          <button class="btn-dup" onclick={async () => { const nn = genId('p'); const src = await fetchPluginSource(p.name); await fetch('/api/admin/plugins/'+nn+'/source', { method: 'PUT', headers: { 'agentid': 'admin', 'X-API-Key': '333', 'Content-Type': 'text/plain' }, body: src }); pluginList = await fetchAdminPlugins(); }}>Duplicate</button>
          <button class="btn-del" onclick={async () => { if (confirm(`Delete plugin ${p.name}?`)) { await deletePlugin(p.name); if (selPluginName === p.name) { selPluginName = null; pluginSource = ''; } pluginList = await fetchAdminPlugins(); } }}>Delete</button>
        </div>
      </div>
    {/each}
  </div>
  {#if selPluginName}
    <div style="margin-top:1rem;border-top:1px solid #e2e8f0;padding-top:1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
        <h4 style="margin:0;font-size:0.9rem;">{selPluginName}.py {pluginSourceDirty ? '(unsaved)' : ''}</h4>
        <div style="display:flex;gap:0.4rem;">
          <button class="btn-cancel" disabled={checking} onclick={async () => {
            checking = true; checkResult = null;
            try { const r = await fetch('/api/admin/plugins/check', { method: 'POST', headers: { 'agentid': 'admin', 'X-API-Key': '333', 'Content-Type': 'text/plain' }, body: pluginSource }); checkResult = await r.json(); }
            catch(e) { checkResult = { ok: false, errors: [{ type: 'error', msg: e.message }]}; }
            finally { checking = false; }
          }}>Check</button>
          <button class="btn-save-rule" disabled={!pluginSourceDirty} onclick={async () => { await savePluginSource(selPluginName, pluginSource); pluginSourceDirty = false; }}>Save</button>
          <button class="btn-cancel" onclick={() => { selPluginName = null; pluginSource = ''; checkResult = null; }}>Close</button>
        </div>
      </div>
      {#key selPluginName}
        <div style="height:400px;border:1px solid #cbd5e0;border-radius:6px;overflow:hidden;">
          <CodeEditor value={pluginSource} onchange={(v) => { pluginSource = v; pluginSourceDirty = true; }} />
        </div>
      {/key}
      {#if checkResult}
        <div class="check-result" class:ok={checkResult.ok}>
          {#if checkResult.ok}✅ No errors{:else}<strong>⚠ {checkResult.errors.length} Errors:</strong>{#each checkResult.errors as err}<div class="check-error">Line {err.line || '?'}: {err.msg}</div>{/each}{/if}
        </div>
      {/if}
    </div>
{/if}
{/if}
{#if view === 'account'}
  <div class="account-section">
    <h2>Account</h2>
    <form onsubmit={(e) => { e.preventDefault(); handleAccountSave(); }}>
      <label>Username <input type="text" bind:value={accUsername} placeholder="new username" disabled={accLoading} /></label>
      <label>Current password <input type="password" bind:value={accCurPw} required disabled={accLoading} /></label>
      <label>New password <input type="password" bind:value={accNewPw} placeholder="leave empty to keep" disabled={accLoading} /></label>
      <label>Confirm new password <input type="password" bind:value={accNewPw2} placeholder="leave empty to keep" disabled={accLoading} /></label>
      {#if accError}<div class="form-error">{accError}</div>{/if}
      {#if accMsg}<div class="form-ok">{accMsg}</div>{/if}
      <button type="submit" disabled={accLoading || !accCurPw}>
        {accLoading ? 'saving...' : 'save'}
      </button>
    </form>
    <button class="logout-btn" onclick={onLogout}>Logout</button>
  </div>
{/if}
{/if}

<!-- Rule Dialog -->
{#if showRuleDialog && editedRule}
  <div class="dialog-overlay" onclick={() => showRuleDialog = false}></div>
  <div class="dialog">
    <div class="dialog-header">
      <h3>Rule {editingRule?.id?.includes('new_') ? 'create' : 'edit'}</h3>
      <button class="btn-close" onclick={() => showRuleDialog = false}>✕</button>
    </div>
    <div class="dialog-body">
      <div class="dialog-field" style="margin-bottom:0.75rem">
        <label>Severity</label>
        <div class="flex items-center gap-2">
          <select bind:value={editedRule.severity} class="px-3 py-2 rounded-lg border text-xs bg-transparent outline-none" style="border-color: var(--border-default); color: var(--text-primary)">
            <option value="warning">warning</option>
            <option value="critical">critical</option>
            <option value="info">info</option>
          </select>
          <svelte:component this={editedRule.severity === 'critical' ? AlertCircle : editedRule.severity === 'warning' ? AlertTriangle : Info} size={16} strokeWidth={2} style="color: {editedRule.severity === 'critical' ? '#ef4444' : editedRule.severity === 'warning' ? '#f59e0b' : '#3b82f6'}" />
        </div>
      </div>
      {#each ruleSchema.fields as field}
        {#if field.key === 'agents_mode' || field.key === 'agents' || field.key === 'executors' || field.key === 'notifications' || field.key === 'severity'}
          <!-- skip - rendered in collapsible section -->
        {:else}
        <div class="dialog-field">
          <label>{field.label}</label>
          {#if field.key === 'pluginid'}
            <select bind:value={editedRule[field.key]}>
              <option value="">—</option>
              {#each filteredPlugins as p}
                <option value={p.name}>{p.label} ({p.name})</option>
              {/each}
            </select>
          {:else if field.key === 'notifications'}
            <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
              {#each Object.values(notifications).sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id)) as n (n.id)}
                <label class="checkbox-row" style="cursor:pointer;font-size:0.8rem;">
                  <input type="checkbox" checked={(editedRule[field.key] || []).includes(n.id)} onchange={(e) => {
                    const arr = [...(editedRule[field.key] || [])];
                    if (e.target.checked) arr.push(n.id); else arr.splice(arr.indexOf(n.id), 1);
                    editedRule[field.key] = arr;
                  }} />
                  {n.title || n.id} ({n.id})
                </label>
              {/each}
            </div>
          {:else if field.key === 'executors'}
            <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
              {#each Object.values(executors).sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id)) as ex (ex.id)}
                <label class="checkbox-row" style="cursor:pointer;font-size:0.8rem;">
                  <input type="checkbox" checked={(editedRule[field.key] || []).includes(ex.id)} onchange={(e) => {
                    const arr = [...(editedRule[field.key] || [])];
                    if (e.target.checked) arr.push(ex.id); else arr.splice(arr.indexOf(ex.id), 1);
                    editedRule[field.key] = arr;
                  }} />
                  {ex.title || ex.id} ({ex.id})
                </label>
              {/each}
            </div>
          {:else if field.type === 'select'}
            <select bind:value={editedRule[field.key]}>
              {#each field.options || [] as opt}
                <option value={opt}>{opt}</option>
              {/each}
            </select>
          {:else if field.type === 'boolean'}
            <input type="checkbox" checked={editedRule[field.key] || false} onchange={(e) => editedRule[field.key] = e.target.checked} />
          {:else if field.type === 'number'}
            <input type="number" value={editedRule[field.key] ?? ''} oninput={(e) => editedRule[field.key] = parseFloat(e.target.value) || 0} />
          {:else if field.type === 'array:string'}
            <div class="dialog-array">
              {#each (editedRule[field.key] || []) as item, i}
                <div class="array-row">
                  <input type="text" value={item} oninput={(e) => { const a = [...(editedRule[field.key] || [])]; a[i] = e.target.value; editedRule[field.key] = a; }} />
                  <button class="btn-sm" onclick={() => { const a = [...(editedRule[field.key] || [])]; a.splice(i,1); editedRule[field.key] = a; }}>✕</button>
                </div>
              {/each}
              <button class="btn-sm" onclick={() => { editedRule[field.key] = [...(editedRule[field.key] || []), '']; }}>+</button>
            </div>
          {:else}
            <input type="text" bind:value={editedRule[field.key]} />
          {/if}
        </div>
        {/if}
      {/each}

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button
          onclick={() => expandedAgents = !expandedAgents}
          class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2"
          style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;"
        >
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedAgents ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span>
          restricted agents
        </button>
        {#if expandedAgents}
          {#each ruleSchema.fields as field}
            {#if field.key === 'agents_mode'}
              <div class="dialog-field">
                <label>{field.label}</label>
                <select bind:value={editedRule[field.key]}>
                  {#each field.options || [] as opt}
                    <option value={opt}>{opt}</option>
                  {/each}
                </select>
              </div>
            {:else if field.key === 'agents'}
              <div class="dialog-field">
                <label>{field.label}</label>
                <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
                  {#each Object.entries(agents).sort(([ka, a], [kb, b]) => String(a.title || ka).localeCompare(String(b.title || kb))) as [agentId, agent] (agentId)}
                    <label class="checkbox-row" style="cursor:pointer;font-size:0.8rem;">
                      <input type="checkbox" checked={(editedRule[field.key] || []).includes(agentId)} onchange={(e) => {
                        const arr = [...(editedRule[field.key] || [])];
                        if (e.target.checked) arr.push(agentId); else arr.splice(arr.indexOf(agentId), 1);
                        editedRule[field.key] = arr;
                      }} />
                      {agent.title || agentId}
                    </label>
                  {/each}
                </div>
              </div>
            {/if}
          {/each}
        {/if}
      </div>

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button
          onclick={() => expandedNotifications = !expandedNotifications}
          class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2"
          style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;"
        >
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedNotifications ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span>
          notifications
        </button>
        {#if expandedNotifications}
          {#each ruleSchema.fields as field}
            {#if field.key === 'notifications'}
              <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
                {#each Object.values(notifications).sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id)) as n (n.id)}
                  <label class="checkbox-row" style="cursor:pointer;font-size:0.8rem;">
                    <input type="checkbox" checked={(editedRule[field.key] || []).includes(n.id)} onchange={(e) => {
                      const arr = [...(editedRule[field.key] || [])];
                      if (e.target.checked) arr.push(n.id); else arr.splice(arr.indexOf(n.id), 1);
                      editedRule[field.key] = arr;
                    }} />
                    {n.title || n.id} ({n.id})
                  </label>
                {/each}
              </div>
            {/if}
          {/each}
        {/if}
      </div>

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button
          onclick={() => expandedExecutors = !expandedExecutors}
          class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2"
          style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;"
        >
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedExecutors ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span>
          executors
        </button>
        {#if expandedExecutors}
          {#each ruleSchema.fields as field}
            {#if field.key === 'executors'}
              <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
                {#each Object.values(executors).sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id)) as ex (ex.id)}
                  <label class="checkbox-row" style="cursor:pointer;font-size:0.8rem;">
                    <input type="checkbox" checked={(editedRule[field.key] || []).includes(ex.id)} onchange={(e) => {
                      const arr = [...(editedRule[field.key] || [])];
                      if (e.target.checked) arr.push(ex.id); else arr.splice(arr.indexOf(ex.id), 1);
                      editedRule[field.key] = arr;
                    }} />
                    {ex.title || ex.id} ({ex.id})
                  </label>
                {/each}
              </div>
            {/if}
          {/each}
        {/if}
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn-cancel" onclick={() => showRuleDialog = false}>Cancel</button>
      <button class="btn-save-rule" onclick={handleSaveRule} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
    </div>
  </div>
{/if}

<!-- Executor Dialog -->
{#if showExecDialog && editedExec}
  <div class="dialog-overlay" onclick={() => showExecDialog = false}></div>
  <div class="dialog">
    <div class="dialog-header">
      <h3>Executor {editedExec.id ? 'edit' : 'create'}</h3>
      <button class="btn-close" onclick={() => showExecDialog = false}>✕</button>
    </div>
    <div class="dialog-body">
      <div class="dialog-field">
        <label>Enabled</label>
        <input type="checkbox" checked={editedExec.enabled ?? true} onchange={(e) => editedExec.enabled = e.target.checked} />
      </div>
      <div class="dialog-field">
        <label>ID</label>
        <input type="text" bind:value={editedExec.id} />
      </div>
      <div class="dialog-field">
        <label>Title</label>
        <input type="text" bind:value={editedExec.title} />
      </div>
      <div class="dialog-field">
        <label>Shell Command</label>
        <textarea rows="3" bind:value={editedExec.command} style="padding:0.35rem;border:1px solid #cbd5e0;border-radius:5px;font-size:0.82rem;font-family:monospace;"></textarea>
        <div style="font-size:0.72rem;color:#888;margin-top:0.2rem;">Available variables: {'{rule_id}'}, {'{agentid}'}, {'{pluginid}'}, {'{metric}'}, {'{value}'}, {'{message}'}, {'{severity}'}</div>
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn-cancel" onclick={() => showExecDialog = false}>Cancel</button>
      <button class="btn-save-rule" onclick={handleSaveExec} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
    </div>
  </div>
{/if}

<!-- Notifications Dialog -->
{#if showNotifyDialog && editedNotify}
  <div class="dialog-overlay" onclick={() => showNotifyDialog = false}></div>
  <div class="dialog" style="width:560px;">
    <div class="dialog-header">
      <h3>Notification {editedNotify.id?.includes('new_') ? 'create' : 'edit'}</h3>
      <button class="btn-close" onclick={() => showNotifyDialog = false}>✕</button>
    </div>
    <div class="dialog-body">
      {#each notifySchema.fields as field}
        {@const ftype = field.key}
        {@const isCommon = ['id','title','enabled','type'].includes(ftype)}
        {@const isEmail = editedNotify.type === 'email' && ['to','from','server','port','user','password','use_tls'].includes(ftype)}
        {@const isWebPush = editedNotify.type === 'web_push' && ['vapid_public_key','vapid_private_key','vapid_subject'].includes(ftype)}
        {@const isNtfy = editedNotify.type === 'ntfy' && ['ntfy_url','ntfy_topic','ntfy_access_token'].includes(ftype)}
        {@const isTwilio = editedNotify.type === 'twilio_call' && ['twilio_account_sid','twilio_auth_token','twilio_call_from','twilio_call_to'].includes(ftype)}
        {#if isCommon || isEmail || isWebPush || isNtfy || isTwilio}
          <div class="dialog-field">
            <label>{field.label}</label>
            {#if field.type === 'select'}
              <select bind:value={editedNotify[field.key]}>
                {#each field.options || [] as opt}
                  <option value={opt}>{opt}</option>
                {/each}
              </select>
            {:else if field.type === 'boolean'}
              <input type="checkbox" checked={editedNotify[field.key] ?? false} onchange={(e) => editedNotify[field.key] = e.target.checked} />
            {:else if field.type === 'number'}
              <input type="number" value={editedNotify[field.key] ?? ''} oninput={(e) => editedNotify[field.key] = parseInt(e.target.value) || 0} />
            {:else}
              <input type="text" bind:value={editedNotify[field.key]} />
            {/if}
          </div>
        {/if}
      {/each}
      {#if editedNotify.type}
        <button class="btn-cancel" style="margin-top:0.5rem;background:#805ad5;color:#fff;border:none;" onclick={async () => {
          try { await testNotification(editedNotify); alert('Test sent successfully'); }
          catch (e) { alert('Test failed: ' + e.message); }
        }}>Send Test</button>
      {/if}
    </div>
    <div class="dialog-footer">
      <button class="btn-cancel" onclick={() => showNotifyDialog = false}>Cancel</button>
      <button class="btn-save-rule" onclick={handleSaveNotify} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
    </div>
  </div>
{/if}

<!-- Plugin Dialog -->
{#if showPluginDialog && editedPlugin}
  <div class="dialog-overlay" onclick={() => { showPluginDialog = false; selPluginName = null; }}></div>
  <div class="dialog" style="width:760px;top:5%;max-height:90vh;">
    <div class="dialog-header">
      <h3>Plugin: {editedPlugin.name}</h3>
      <button class="btn-close" onclick={() => { showPluginDialog = false; selPluginName = null; }}>✕</button>
    </div>
    <div class="dialog-body" style="overflow:visible;display:flex;flex-direction:column;gap:0.6rem;">
      <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:0;flex-shrink:0;">
        <div class="dialog-field" style="flex:1;">
          <label>ID (filename)</label>
          <input type="text" value={editedPlugin.name} disabled />
        </div>
        <div class="dialog-field" style="flex:1;">
          <label>Title</label>
          <input type="text" bind:value={editedPlugin.label} />
        </div>
        <div class="dialog-field" style="justify-content:center;">
          <label>
            <input type="checkbox" checked={editedPlugin.enabled !== false} onchange={(e) => editedPlugin.enabled = e.target.checked} />
            Enabled
          </label>
        </div>
      </div>
      <div style="display:flex;gap:0.4rem;margin-bottom:0.5rem;">
        <button class="btn-cancel" disabled={checking} onclick={async () => {
          checking = true; checkResult = null;
          try { const r = await fetch('/api/admin/plugins/check', { method: 'POST', headers: { 'agentid': 'admin', 'X-API-Key': '333', 'Content-Type': 'text/plain' }, body: pluginSource }); checkResult = await r.json(); }
          catch(e) { checkResult = { ok: false, errors: [{ type: 'error', msg: e.message }]}; }
          finally { checking = false; }
        }}>Check</button>
        <button class="btn-cancel" onclick={() => fsEditor = pluginSource}>⛶ Fullscreen</button>
        <span style="flex:1;"></span>
        <span style="font-size:0.78rem;color:#888;align-self:center;">{pluginSourceDirty ? '(unsaved)' : ''}</span>
      </div>
      {#key editedPlugin.name}
        <div style="height:350px;border:1px solid #cbd5e0;border-radius:6px;overflow:hidden;display:flex;flex-direction:column;">
          <CodeEditor value={pluginSource} onchange={(v) => { pluginSource = v; pluginSourceDirty = true; }} />
        </div>
      {/key}
      {#if checkResult}
        <div class="check-result" class:ok={checkResult.ok}>
          {#if checkResult.ok}✅ No errors{:else}<strong>⚠ {checkResult.errors.length} Errors:</strong>{#each checkResult.errors as err}<div class="check-error">Line {err.line || '?'}: {err.msg}</div>{/each}{/if}
        </div>
      {/if}
    </div>
    <div class="dialog-footer">
      <button class="btn-cancel" onclick={() => { showPluginDialog = false; selPluginName = null; }}>Close</button>
      <button class="btn-save-rule" onclick={async () => {
        if (pluginSourceDirty) await savePluginSource(editedPlugin.name, pluginSource);
        await togglePluginEnabled(editedPlugin.name, editedPlugin.enabled !== false);
        showPluginDialog = false; selPluginName = null; pluginSourceDirty = false;
        pluginList = await fetchAdminPlugins();
      }}>Save</button>
    </div>
  </div>
{/if}

<!-- Group Dialog -->
{#if showGroupDialog && editedGroup}
  <div class="dialog-overlay" onclick={() => showGroupDialog = false}></div>
  <div class="dialog">
    <div class="dialog-header">
      <h3>{editedGroup.id ? 'Edit Group' : 'New Group'}</h3>
      <button class="btn-close" onclick={() => showGroupDialog = false}>✕</button>
    </div>
    <div class="dialog-body">
      <div class="dialog-field">
        <label>Name</label>
        <input type="text" bind:value={editedGroup.id} disabled={!!editedGroup.id} placeholder="group-name" />
      </div>
      <div class="dialog-field">
        <label>Plugins</label>
        <div class="dialog-array" style="max-height:250px;overflow-y:auto;">
          {#each [...allPluginNames].sort() as pn}
            <label class="checkbox-row" style="cursor:pointer;font-size:0.8rem;">
              <input type="checkbox" checked={(editedGroup.plugins || []).includes(pn)} onchange={(e) => {
                const arr = [...(editedGroup.plugins || [])];
                if (e.target.checked) arr.push(pn); else arr.splice(arr.indexOf(pn), 1);
                editedGroup.plugins = arr;
              }} />
              {pn}
            </label>
          {/each}
        </div>
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn-cancel" onclick={() => showGroupDialog = false}>Cancel</button>
      <button class="btn-save-rule" onclick={async () => {
        if (!editedGroup.id?.trim()) return;
        try {
          await setGroupPlugins(editedGroup.id.trim(), editedGroup.plugins || []);
          showGroupDialog = false;
          groups = await fetchAdminGroups();
        } catch (e) { error = e.message; }
      }} disabled={!editedGroup.id?.trim()}>Save</button>
    </div>
  </div>
{/if}

<!-- Blackout Dialog -->
{#if showBlackoutDialog && editedBlackout}
  <div class="dialog-overlay" onclick={() => showBlackoutDialog = false}></div>
  <div class="dialog">
    <div class="dialog-header">
      <h3>Blackout {editingBlackout?.id?.includes('new_') ? 'create' : 'edit'}</h3>
      <button class="btn-close" onclick={() => showBlackoutDialog = false}>✕</button>
    </div>
    <div class="dialog-body">
      <div class="dialog-field">
        <label>Title</label>
        <input type="text" bind:value={editedBlackout.title} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)" />
      </div>
      <div class="dialog-field">
        <label>Enabled</label>
        <input type="checkbox" checked={editedBlackout.enabled !== false} onchange={(e) => editedBlackout.enabled = e.target.checked} />
      </div>
      <div class="dialog-field">
        <label>Weekdays</label>
        <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
          {#each ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as day, i}
            <label class="checkbox-row" style="cursor:pointer;font-size:0.78rem;display:flex;align-items:center;gap:0.2rem;">
              <input type="checkbox" checked={(editedBlackout.weekdays || []).includes(i)} onchange={(e) => {
                const arr = [...(editedBlackout.weekdays || [])];
                if (e.target.checked) arr.push(i); else arr.splice(arr.indexOf(i), 1);
                editedBlackout.weekdays = arr.sort((a,b) => a-b);
              }} />
              {day}
            </label>
          {/each}
        </div>
      </div>
      <div style="display:flex;gap:0.5rem;">
        <div class="dialog-field" style="flex:1">
          <label>Start time</label>
          <input type="time" bind:value={editedBlackout.start_time} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)" />
        </div>
        <div class="dialog-field" style="flex:1">
          <label>End time</label>
          <input type="time" bind:value={editedBlackout.end_time} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)" />
        </div>
      </div>
      <div class="dialog-field" style="margin-bottom:0.5rem">
        <label>Blackout mode</label>
        <select bind:value={editedBlackout.mode} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)">
          <option value="no_alarms">no alarms</option>
          <option value="no_notifications">no notifications</option>
        </select>
      </div>

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button
          onclick={() => expandedBlackoutRules = !expandedBlackoutRules}
          class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2"
          style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;"
        >
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedBlackoutRules ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span>
          target rules
        </button>
        {#if expandedBlackoutRules}
          <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
            {#each Object.values(rules).sort((a,b) => a.id.localeCompare(b.id)) as rule}
              <label class="checkbox-row" style="cursor:pointer;font-size:0.8rem;">
                <input type="checkbox" checked={(editedBlackout.target_rules || []).includes(rule.id)} onchange={(e) => {
                  const arr = [...(editedBlackout.target_rules || [])];
                  if (e.target.checked) arr.push(rule.id); else arr.splice(arr.indexOf(rule.id), 1);
                  editedBlackout.target_rules = arr;
                }} />
                {rule.id}
              </label>
            {/each}
          </div>
        {/if}
      </div>

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button
          onclick={() => expandedBlackoutAgents = !expandedBlackoutAgents}
          class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2"
          style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;"
        >
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedBlackoutAgents ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span>
          target agents
        </button>
        {#if expandedBlackoutAgents}
          <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
            {#each Object.entries(agents).sort(([ka,a],[kb,b]) => String(a.title||ka).localeCompare(String(b.title||kb))) as [agentId, agent]}
              <label class="checkbox-row" style="cursor:pointer;font-size:0.8rem;">
                <input type="checkbox" checked={(editedBlackout.target_agents || []).includes(agentId)} onchange={(e) => {
                  const arr = [...(editedBlackout.target_agents || [])];
                  if (e.target.checked) arr.push(agentId); else arr.splice(arr.indexOf(agentId), 1);
                  editedBlackout.target_agents = arr;
                }} />
                {agent.title || agentId}
              </label>
            {/each}
          </div>
        {/if}
      </div>

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button
          onclick={() => expandedBlackoutGroups = !expandedBlackoutGroups}
          class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2"
          style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;"
        >
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedBlackoutGroups ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span>
          target groups
        </button>
        {#if expandedBlackoutGroups}
          <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
            {#each Object.keys(groups).sort() as gid}
              <label class="checkbox-row" style="cursor:pointer;font-size:0.8rem;">
                <input type="checkbox" checked={(editedBlackout.target_groups || []).includes(gid)} onchange={(e) => {
                  const arr = [...(editedBlackout.target_groups || [])];
                  if (e.target.checked) arr.push(gid); else arr.splice(arr.indexOf(gid), 1);
                  editedBlackout.target_groups = arr;
                }} />
                {gid}
              </label>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn-cancel" onclick={() => showBlackoutDialog = false}>Cancel</button>
      <button class="btn-save-rule" onclick={handleSaveBlackout} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
    </div>
  </div>
{/if}

<!-- Source editor when opened inline from plugin dialog -->
{#if selPluginName && !showPluginDialog}
  <div style="margin-top:1rem;border-top:1px solid #e2e8f0;padding-top:1rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
      <h4 style="margin:0;font-size:0.9rem;">{selPluginName}.py</h4>
      <button class="btn-cancel" onclick={() => { selPluginName = null; pluginSource = ''; checkResult = null; }}>Close</button>
    </div>
    {#key selPluginName}
      <div style="height:400px;border:1px solid #cbd5e0;border-radius:6px;overflow:hidden;">
        <CodeEditor value={pluginSource} onchange={(v) => { pluginSource = v; pluginSourceDirty = true; }} />
      </div>
    {/key}
  </div>
{/if}

<!-- Agent Dialog -->
{#if showAgentDialog && editedAgentData}
  {@const agent = editedAgentData}
  {@const agentId = editingAgent}
  <div class="dialog-overlay" onclick={closeAgentDialog}></div>
  <div class="dialog" style="width:640px;top:5%;max-height:90vh;">
    <div class="dialog-header">
      <h3>Agent: {agentId}</h3>
      <button class="btn-close" onclick={closeAgentDialog}>✕</button>
    </div>
    <div class="dialog-body" style="overflow:visible;">
      <!-- Status & Install -->
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
        <span class="status-dot" class:online={agent.online} style="display:inline-block;width:10px;height:10px;border-radius:50%;flex-shrink:0;"></span>
        <span style="font-size:0.85rem;">{agent.online ? 'Online' : 'Offline'}</span>
        {#if agent.last_seen}
          <span style="font-size:0.75rem;color:#888;">last seen: {fmtTime(agent.last_seen)}</span>
        {/if}
        <span style="flex:1;"></span>
        <button class="btn-install" style="width:auto;padding:0.35rem 0.8rem;font-size:0.78rem;" onclick={() => navigator.clipboard.writeText(`curl -s '${window.location.origin}/api/agent/install.sh?agentid=${agentId}&apikey=${agent.apikey}' | sh`)}>
          📋 Copy install command
        </button>
      </div>

      <!-- Title -->
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
        <label style="font-size:0.82rem;font-weight:600;color:#555;min-width:60px;">Title</label>
        <input type="text" value={agent.title || ''} onchange={async (e) => {
          const val = e.target.value.trim();
          try { await updateAgent(agentId, { title: val }); await load(); editedAgentData = { ...agents[agentId], id: agentId }; }
          catch (err) { error = err.message; }
        }} style="flex:1;padding:0.35rem;border:1px solid #cbd5e0;border-radius:5px;font-size:0.82rem;" />
        <span style="font-size:0.72rem;color:#aaa;">ID: {agentId}</span>
      </div>

      <!-- Enabled toggle -->
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;padding-bottom:0.5rem;border-bottom:1px solid #e2e8f0;">
        <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;font-size:0.85rem;">
          <input type="checkbox" checked={agent.enabled !== false} onchange={async (e) => {
            const val = e.target.checked;
            try {
              await setAgentEnabled(agentId, val);
              await load();
              editedAgentData = { ...agents[agentId], id: agentId };
            } catch (err) { error = err.message; }
          }} />
          Agent enabled
        </label>
      </div>

      <!-- Groups -->
      <section class="config-section" style="margin-bottom:0.75rem;">
        <h4 style="margin:0 0 0.4rem;font-size:0.85rem;color:#555;">Groups</h4>
        <div class="chip-list">
          {#each Object.keys(groups).sort() as g}
            <button
              class="chip"
              class:active={agent.groups?.includes(g)}
              onclick={async () => {
                await toggleGroup(agentId, g);
                editedAgentData = { ...agents[agentId], id: agentId };
              }}
            >{g}</button>
          {/each}
        </div>
      </section>

      <!-- Plugins with inline config -->
      <section class="config-section">
        <h4 style="margin:0 0 0.4rem;font-size:0.85rem;color:#555;">Plugins</h4>
        <div class="plugin-grid">
          {#each agentPlugins as p}
            {@const schema = schemas[p]}
            {@const hasConfig = p in (agent.plugins || {})}
            <div class="plugin-card" class:active={selectedPlugin === p} class:configured={hasConfig}>
              <div class="plugin-header">
                <span class="plugin-name">{schema?.label || p}</span>
                <button
                  class="toggle-btn"
                  class:active={hasConfig}
                  onclick={async () => {
                    await togglePlugin(agentId, p);
                    editedAgentData = { ...agents[agentId], id: agentId };
                    selectedPlugin = null; editedPluginConfig = null;
                  }}
                >{hasConfig ? 'On' : 'Off'}</button>
              </div>
              <div class="plugin-desc">{schema?.description || ''}</div>
              {#if hasConfig}
                <button class="edit-btn" onclick={() => selectPlugin(agentId, p)}>
                  {selectedPlugin === p ? 'Editing...' : 'Configure'}
                </button>
              {/if}
            </div>
          {/each}
        </div>
        {#if selectedPlugin}
          <div style="margin-top:0.75rem;border-top:1px solid #e2e8f0;padding-top:0.75rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
              <strong style="font-size:0.85rem;">{schemas[selectedPlugin]?.label || selectedPlugin}</strong>
              <button class="btn-close" onclick={() => { selectedPlugin = null; editedPluginConfig = null; }}>✕</button>
            </div>
            <PluginForm
              schema={schemas[selectedPlugin]}
              config={agents[agentId]?.plugins?.[selectedPlugin] || {}}
              onchange={(c) => editedPluginConfig = c}
            />
            <button class="btn-save" style="margin-top:0.5rem;" onclick={async () => {
              await savePluginConfig(agentId, selectedPlugin);
              editedAgentData = { ...agents[agentId], id: agentId };
            }} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
{/if}
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn-cancel" onclick={closeAgentDialog}>Cancel</button>
      <button class="btn-save-rule" onclick={closeAgentDialog}>Save</button>
    </div>
{/if}

<!-- Fullscreen editor overlay -->
{#if fsEditor !== null}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fs-overlay" onkeydown={onFsKeydown}>
    <div class="fs-header">
      <span style="color:#aaa;font-size:0.85rem;">Editing — press Esc to close</span>
      <button class="btn-cancel" onclick={closeFs}>✕ Close</button>
    </div>
    <div class="fs-editor-body">
      <CodeEditor value={fsEditor} onchange={(v) => { fsEditor = v; }} />
    </div>
  </div>
{/if}

<style>
  .dialog-overlay { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,0.5); }
  .dialog { position: fixed; top: 1.5rem; left: 50%; transform: translateX(-50%); z-index: 51; background: #fff; border: 1px solid var(--border-default, #e2e8f0); border-radius: var(--radius-card); box-shadow: 0 16px 48px rgba(0,0,0,0.15); max-width: 500px; width: calc(100vw - 2rem); max-height: calc(100vh - 3rem); overflow-y: auto; }
  :global(.dark) .dialog { background: #0f172a; box-shadow: 0 16px 48px rgba(0,0,0,0.5); }
  .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-default); }
  .dialog-header h3 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-primary); }
  .dialog-body { padding: 1rem 1.25rem; }
  .dialog-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0.75rem 1.25rem; border-top: 1px solid var(--border-default); }
  .dialog-field { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.5rem; }
  .dialog-field label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
  .dialog-field select, .dialog-field input[type="text"], .dialog-field input[type="number"] { padding: 0.35rem 0.5rem; border: 1px solid var(--border-default); border-radius: 5px; font-size: 0.82rem; background: var(--bg-surface); color: var(--text-primary); }
  .dialog-field select:focus, .dialog-field input:focus { border-color: var(--color-primary); outline: none; }
  .dialog-field input[type="checkbox"] { width: 1.1rem; height: 1.1rem; accent-color: var(--color-primary); }
  .btn-cancel { background: transparent; border: 1px solid var(--border-default); border-radius: 5px; padding: 0.35rem 0.8rem; cursor: pointer; font-size: 0.8rem; color: var(--text-secondary); }
  .btn-save-rule { background: var(--color-primary); color: #fff; border: none; border-radius: 5px; padding: 0.35rem 0.8rem; cursor: pointer; font-size: 0.8rem; }
  .btn-save-rule:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-sm { background: none; border: 1px solid var(--border-default); border-radius: 3px; cursor: pointer; font-size: 0.7rem; padding: 0.1rem 0.35rem; color: var(--text-secondary); }
  .dialog-array { display: flex; flex-direction: column; gap: 0.25rem; }
  .array-row { display: flex; gap: 0.3rem; align-items: center; }
  .array-row input { flex: 1; }
  .check-result { margin-top: 0.5rem; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.82rem; }
  .check-result:not(.ok) { background: rgba(239,68,68,0.1); color: #ef4444; }
  .check-result.ok { background: rgba(34,197,94,0.1); color: #22c55e; }
  .check-error { font-family: monospace; font-size: 0.78rem; margin-top: 0.2rem; padding-left: 0.5rem; }
  .account-section { max-width: 400px; }
  .account-section h2 { font-size: 1.2rem; margin: 0 0 1rem; color: var(--text-primary); }
  .account-section form { display: flex; flex-direction: column; gap: 0.75rem; }
  .account-section label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.85rem; color: var(--text-secondary); }
  .account-section input { padding: 0.4rem 0.6rem; border: 1px solid var(--border-default); border-radius: 4px; font-size: 0.9rem; background: var(--bg-surface); color: var(--text-primary); }
  .account-section button[type="submit"] { padding: 0.4rem; background: var(--color-primary); color: #fff; border: none; border-radius: 5px; font-size: 0.9rem; cursor: pointer; }
  .account-section button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
  .account-section .logout-btn { margin-top: 1.5rem; padding: 0.4rem 0.8rem; border: 1px solid var(--border-default); border-radius: 5px; background: transparent; cursor: pointer; font-size: 0.85rem; color: var(--text-secondary); }
  .form-error { color: #ef4444; font-size: 0.85rem; }
  .form-ok { color: #22c55e; font-size: 0.85rem; }
  .fs-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.8); display: flex; flex-direction: column; }
  .fs-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-surface); border-bottom: 1px solid var(--border-default); }
  .fs-header span { color: var(--text-secondary); font-size: 0.85rem; }
  .fs-editor-body { flex: 1; overflow: hidden; }
  .fs-editor-body :global(.editor-wrap) { height: 100% !important; min-height: 0 !important; border: none !important; }
  /* Tag-based restyling for config views */
  .rule-card { border: 1px solid var(--border-default); border-radius: 6px; padding: 0.5rem 0.75rem; margin-bottom: 0.4rem; background: var(--bg-surface); transition: all 0.15s; }
  .rule-card:hover { transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
  .rule-head { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.15rem; }
  .rule-head .rule-id { font-weight: 600; font-size: 0.8rem; color: var(--text-primary); }
  .rule-sev { font-size: 0.6rem; padding: 0.1rem 0.35rem; border-radius: 999px; font-weight: 600; }
  .rule-sev.warning { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .rule-sev.critical { background: rgba(239,68,68,0.15); color: #ef4444; }
  .rule-sev.info { background: rgba(59,130,246,0.15); color: #3b82f6; }
  .rule-desc { font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.3rem; }
  .rule-actions { display: flex; gap: 0.25rem; }
  .rule-status { font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 999px; font-weight: 600; }
  .rule-status:not(.active) { background: rgba(239,68,68,0.1); color: #ef4444; }
  .rule-status.active { background: rgba(34,197,94,0.1); color: #22c55e; }
  .btn-edit { font-size: 0.7rem; color: var(--color-primary); cursor: pointer; background: none; border: none; padding: 0.1rem 0.3rem; }
  .btn-dup { font-size: 0.7rem; color: #8b5cf6; cursor: pointer; background: none; border: none; padding: 0.1rem 0.3rem; }
  .btn-del { font-size: 0.7rem; color: #ef4444; cursor: pointer; background: none; border: none; padding: 0.1rem 0.3rem; }
  .btn-add-rule { padding: 0.3rem 0.6rem; background: rgba(34,197,94,0.1); color: #22c55e; border: none; border-radius: 5px; font-size: 0.8rem; cursor: pointer; white-space: nowrap; }
  .btn-install { background: #1a202c; color: #e2e8f0; border: none; border-radius: 6px; padding: 0.4rem 0.8rem; cursor: pointer; font-family: monospace; font-size: 0.8rem; margin-top: 0.5rem; }
  .btn-install:hover { background: #2d3748; }
  .chip-list { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .chip { padding: 0.15rem 0.5rem; border: 1px solid var(--border-default); border-radius: 999px; font-size: 0.7rem; cursor: pointer; transition: all 0.15s; background: transparent; color: var(--text-secondary); }
  .chip.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
  .plugin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.5rem; }
  .plugin-card { border: 1px solid var(--border-default); border-radius: 8px; padding: 0.6rem; cursor: pointer; transition: all 0.15s; background: var(--bg-surface); }
  .plugin-card:hover { transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
  .plugin-card.active { border-color: var(--color-primary); }
  .plugin-card.configured { background: rgba(34,197,94,0.05); }
  .plugin-name { font-weight: 600; font-size: 0.8rem; color: var(--text-primary); }
  .plugin-desc { font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.25rem; }
  .toggle-btn { font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 999px; cursor: pointer; border: 1px solid var(--border-default); background: transparent; color: var(--text-secondary); }
  .toggle-btn.on { background: rgba(34,197,94,0.15); color: #22c55e; border-color: #22c55e; }
  .edit-btn { font-size: 0.7rem; color: var(--color-primary); text-decoration: none; cursor: pointer; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e0; flex-shrink: 0; display: inline-block; }
  .status-dot.online { background: #22c55e; }
  .rules-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
  .rules-header h3 { margin: 0; font-size: 1rem; color: var(--text-primary); flex-shrink: 0; }
  .filter-input { max-width: 180px; min-width: 100px; margin: 0 auto; padding: 0.3rem 0.5rem; border: 1px solid var(--border-default); border-radius: 5px; font-size: 0.8rem; background: var(--bg-surface); color: var(--text-primary); }
</style>
