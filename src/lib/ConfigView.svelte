<script>
  import { onMount } from 'svelte';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import AlertCircle from 'lucide-svelte/icons/alert-circle';
  import Info from 'lucide-svelte/icons/info';
  import Plus from 'lucide-svelte/icons/plus';
  import PluginForm from './PluginForm.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import Tooltip from './components/Tooltip.svelte';
  import {
    fetchPluginSchemas, fetchAdminAgents, fetchAdminGroups,
    createAgent, deleteAgent, setAgentGroups, setAgentPluginConfig,
    removeAgentPlugin, setGroupPlugins, deleteGroup, setAgentEnabled, updateAgent,
    fetchRuleSchema, fetchRules, saveRule, deleteRule,
    fetchExecutors, saveExecutor, deleteExecutor,
    fetchNotifications, saveNotification, deleteNotification, fetchNotifySchema, testNotification,
    fetchAdminPlugins, fetchPluginSource, fetchPluginTemplate, savePluginSource, checkPluginSource, deletePlugin, togglePluginEnabled, savePluginMeta,
    updateAccount, setToken,
    fetchBlackouts, fetchBlackoutSchema, saveBlackout, deleteBlackout,
    fetchVariables, saveVariable, deleteVariable,
  } from './api.js';

  let { pendingRule = null, onLogout = () => {}, onClearPendingRule = () => {} } = $props();

  let anyDialogOpen = $derived(
    showRuleDialog || showExecDialog || showNotifyDialog || showPluginDialog ||
    showGroupDialog || showBlackoutDialog || showAgentDialog || showVariableDialog
  );

  $effect(() => {
    document.body.style.overflow = anyDialogOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  });

  $effect(() => {
    if (pendingRule?.id && pendingRule.id in rules) {
      view = 'rules';
      editRule(pendingRule.id);
      onClearPendingRule();
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

  function alphaCompare(a, b) {
    return String(a ?? '').localeCompare(String(b ?? ''), undefined, { sensitivity: 'base' });
  }

  function namedValue(value, fallback = '') {
    if (!value || typeof value !== 'object') return value || fallback;
    return value.title || value.label || value.name || value.id || fallback;
  }

  function compareNamed(a, b) {
    return alphaCompare(namedValue(a), namedValue(b)) || alphaCompare(a?.id || a?.name || '', b?.id || b?.name || '');
  }

  function compareEntries([idA, valueA], [idB, valueB]) {
    return alphaCompare(namedValue(valueA, idA), namedValue(valueB, idB)) || alphaCompare(idA, idB);
  }

  let view = $state('agents'); // 'agents'|'rules'|'executors'|'notify'|'groups'|'blackouts'|'plugins'|'variables'|'account'
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
  let expandedRuleGeneral = $state(true);
  let expandedRuleSettings = $state(true);
  let expandedBlackoutRules = $state(false);
  let expandedBlackoutAgents = $state(false);
  let expandedBlackoutGroups = $state(false);
  let expandedExecGeneral = $state(true);
  let expandedExecSettings = $state(true);
  let expandedNotifyGeneral = $state(true);
  let expandedNotifySettings = $state(true);
  let expandedNotifyNtfy = $state(true);
  let expandedNotifyEmail = $state(true);
  let expandedNotifyPush = $state(true);
  let expandedNotifyTwilio = $state(true);
  let expandedBlackoutGeneral = $state(true);
  let expandedBlackoutSettings = $state(true);
  let expandedGroupGeneral = $state(true);
  let expandedGroupPlugins = $state(true);
  let expandedPluginGeneral = $state(true);
  let expandedPluginCode = $state(true);
  let expandedAgentGeneral = $state(true);
  let expandedAgentSettings = $state(true);
  let expandedAgentPlugins = $state(true);
  let showBlackoutDialog = $state(false);
  let editingBlackout = $state(null);
  let editedBlackout = $state(null);
  let blackouts = $state({});
  let blackoutSchema = $state({ fields: [] });

  // Variables state
  let variables = $state({});
  let showVariableDialog = $state(false);
  let editingVariable = $state(null);
  let editedVariable = $state(null);

  function openNewVariable() {
    editingVariable = null;
    editedVariable = { name: '$', description: '', value: 0, exceptions: [] };
    showVariableDialog = true;
  }

  function editVariable(id) {
    editingVariable = id;
    editedVariable = JSON.parse(JSON.stringify(variables[id]));
    showVariableDialog = true;
  }

  async function handleSaveVariable() {
    const id = editingVariable || genId('v');
    // Enforce $UPPERCASE format
    const name = ('$' + (editedVariable.name || '').replace(/^\$/, '').toUpperCase().replace(/[^A-Z0-9_]/g, ''));
    if (!/^\$[A-Z0-9_]+$/.test(name)) { error = 'Variable name must be $UPPERCASE (letters, numbers and _ only)'; return; }
    editedVariable.name = name;
    try {
      await saveVariable(id, { ...editedVariable, id });
      variables = await fetchVariables();
      showVariableDialog = false;
    } catch (e) { error = e.message; }
  }

  async function handleDeleteVariable(id) {
    if (!confirm(`Delete variable ${variables[id]?.name}?`)) return;
    try {
      await deleteVariable(id);
      variables = await fetchVariables();
    } catch (e) { error = e.message; }
  }

  function addVarException() {
    editedVariable.exceptions = [...(editedVariable.exceptions || []), { type: 'agent', id: '', value: 0 }];
  }

  function removeVarException(i) {
    editedVariable.exceptions = editedVariable.exceptions.filter((_, j) => j !== i);
  }

  // ── Filters ──
  let filterText = $state('');

  let filteredAgents = $derived.by(() => {
    const entries = Object.entries(agents);
    if (!filterText) return entries.sort(compareEntries).map(([id]) => id);
    const q = filterText.toLowerCase();
    return entries.filter(([id, a]) => {
      return (a.title || id).toLowerCase().includes(q) || id.toLowerCase().includes(q);
    }).sort(compareEntries).map(([id]) => id);
  });

  let filteredRules = $derived.by(() => {
    const vals = Object.values(rules);
    if (!filterText) return vals.sort(compareNamed);
    const q = filterText.toLowerCase();
    return vals.filter(r => r.id.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q))
      .sort(compareNamed);
  });

  let filteredExecutors = $derived.by(() => {
    const vals = Object.values(executors);
    if (!filterText) return vals.sort(compareNamed);
    const q = filterText.toLowerCase();
    return vals.filter(ex => (ex.title || ex.id).toLowerCase().includes(q) || ex.id.toLowerCase().includes(q) || (ex.command || '').toLowerCase().includes(q) || (ex.description || '').toLowerCase().includes(q))
      .sort(compareNamed);
  });

  let filteredNotifications = $derived.by(() => {
    const vals = Object.values(notifications);
    if (!filterText) return vals.sort(compareNamed);
    const q = filterText.toLowerCase();
    return vals.filter(n => (n.title || n.id).toLowerCase().includes(q) || n.id.toLowerCase().includes(q) || (n.to || '').toLowerCase().includes(q))
      .sort(compareNamed);
  });

  let filteredGroups = $derived.by(() => {
    const entries = Object.entries(groups);
    if (!filterText) return entries.sort(compareEntries).map(([id]) => id);
    const q = filterText.toLowerCase();
    return entries.filter(([gid, g]) => {
        const t = g?.title || '';
        return gid.toLowerCase().includes(q) || t.toLowerCase().includes(q);
      }).sort(compareEntries).map(([id]) => id);
  });

  let filteredPlugins = $derived.by(() => {
    if (!filterText) return [...pluginList].sort(compareNamed);
    const q = filterText.toLowerCase();
    return pluginList.filter(p => (p.label || '').toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
      .sort(compareNamed);
  });

  async function load() {
    loading = true; error = null;
    try {
      const [s, a, g, rs, rsc, ex, nt, ns, pl, bs, bsc, vs] = await Promise.all([
        fetchPluginSchemas(), fetchAdminAgents(), fetchAdminGroups(),
        fetchRules(), fetchRuleSchema(), fetchExecutors(),
        fetchNotifications(), fetchNotifySchema(),
        fetchAdminPlugins(),
        fetchBlackouts(), fetchBlackoutSchema(),
        fetchVariables(),
      ]);
      schemas = s; agents = a; groups = g; rules = rs; ruleSchema = rsc;
      executors = ex; notifications = nt; notifySchema = ns; pluginList = pl;
      blackouts = bs; blackoutSchema = bsc; variables = vs;
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
    return [...set].sort(alphaCompare);
  });

  let agentPlugins = $derived.by(() => {
    if (!selectedAgent || !agents[selectedAgent]) return [];
    const a = agents[selectedAgent];
    const fromGroups = new Set();
    for (const g of a.groups) {
      const plugins = groups[g]?.plugins || groups[g] || [];
      for (const p of plugins) fromGroups.add(p);
    }
    const direct = new Set(Object.keys(a.plugins || {}));
    return [...new Set([...fromGroups, ...direct])].sort((a, b) =>
      alphaCompare(schemas[a]?.label || a, schemas[b]?.label || b) || alphaCompare(a, b)
    );
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
    if (!filterText) return vals.sort(compareNamed);
    const q = filterText.toLowerCase();
    return vals.filter(b => (b.title || b.id).toLowerCase().includes(q)).sort(compareNamed);
  });

  onMount(load);
</script>

{#if error}
    <div class="glass px-4 py-3 rounded-[var(--radius-card)] text-sm text-red-400 border-l-2 border-red-400 mb-4">{error}</div>
  {/if}

  {#if loading}
    <div class="text-center py-16 text-sm" style="color: var(--text-secondary)">loading configuration...</div>
  {:else}
    <div class="tab-nav-wrapper mb-6">
      <button
        class="tab-nav-chevron"
        aria-label="scroll left"
        onclick={() => { const el = document.getElementById('cfg-tabs'); if(el) el.scrollBy({left:-120,behavior:'smooth'}); }}
      >&#8249;</button>
      <div id="cfg-tabs" class="tab-nav-scroll" style="border-color: var(--border-default)">
        {#each ['Agents','Rules','Notifications','Groups','Variables','Blackouts','Executors','Plugins'] as label}
          {@const id = label === 'Notifications' ? 'notify' : label.toLowerCase()}
          <button
            onclick={() => view = id}
            class="relative px-3 py-2 text-xs font-medium transition-colors duration-150 whitespace-nowrap flex-shrink-0"
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
      <button
        class="tab-nav-chevron"
        aria-label="scroll right"
        onclick={() => { const el = document.getElementById('cfg-tabs'); if(el) el.scrollBy({left:120,behavior:'smooth'}); }}
      >&#8250;</button>
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
          {#if a.description}
            <div class="rule-desc">{a.description}</div>
          {/if}
          <div class="rule-actions">
            <span class="rule-status" class:active={a.enabled !== false}>{a.enabled !== false ? 'Enabled' : 'Disabled'}</span>
            <button class="btn-edit" onclick={() => openAgentDialog(id)}>Edit</button>
            <button class="btn-dup" onclick={async () => {
              const newId = genId('a');
              await createAgent(newId, a.groups || [], (a.title || '') + ' Copy');
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
          <span class="rule-id">{rule.title || rule.id}</span>
        </div>
        <div class="rule-desc">{rule.description || '—'}</div>
        <div class="rule-actions">
          <span class="rule-status" class:active={rule.enabled}>{rule.enabled ? 'Enabled' : 'Disabled'}</span>
          <button class="btn-edit" onclick={() => editRule(rule.id)}>Edit</button>
          <button class="btn-dup" onclick={async () => {
            const copy = { ...rule, id: genId('r'), title: (rule.title || '') + ' Copy' };
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
        {#if exec.description}
          <div class="rule-desc">{exec.description}</div>
        {/if}
        <div class="rule-actions">
          <span class="rule-status" class:active={exec.enabled ?? true}>{exec.enabled ?? true ? 'Enabled' : 'Disabled'}</span>
          <button class="btn-edit" onclick={() => editExec(exec.id)}>Edit</button>
          <button class="btn-dup" onclick={async () => {
            const copy = { ...exec, id: genId('e'), title: (exec.title || '') + ' Copy' };
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
        </div>
        {#if n.description}
          <div class="rule-desc">{n.description}</div>
        {/if}
        <div class="rule-actions">
          <span class="rule-status" class:active={n.enabled ?? true}>{n.enabled ?? true ? 'Enabled' : 'Disabled'}</span>
          <button class="btn-edit" onclick={() => editNotify(n.id)}>Edit</button>
          <button class="btn-dup" onclick={async () => {
            const copy = { ...n, id: genId('n'), title: (n.title || '') + ' Copy' };
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
      <button class="ml-auto p-1.5 rounded-full text-white transition-all duration-150 hover:scale-110 active:scale-95" style="background: var(--color-primary)" onclick={() => { editedGroup = { id: '', title: '', description: '', plugins: [] }; showGroupDialog = true; }}><Plus size={14} strokeWidth={2} /></button>
    </div>
    {#if filteredGroups.length === 0}
      <div class="empty">No groups</div>
    {:else}
      {#each filteredGroups as gid}
        {@const g = groups[gid]}
        <div class="rule-card">
          <div class="rule-head">
            <span class="rule-id">{g?.title || gid}</span>
          </div>
          {#if g?.description}
            <div class="rule-desc">{g.description}</div>
          {/if}
          <div class="rule-actions">
            <button class="btn-edit" onclick={() => { const g = groups[gid] || {}; editedGroup = { id: gid, title: g.title || gid, description: g.description || '', plugins: [...(g.plugins || g || [])] }; showGroupDialog = true; }}>Edit</button>
            <button class="btn-dup" onclick={async () => {
              const ng = genId('g');
              const g = groups[gid] || {};
              const plugins = g.plugins || g || [];
              await setGroupPlugins(ng, { plugins: [...plugins], title: (g.title || '') + ' Copy', description: g.description || '' });
              groups = await fetchAdminGroups();
            }}>Duplicate</button>
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
{#if b.description}
            <div class="rule-desc">{b.description}</div>
          {/if}
          <div class="rule-actions">
          <span class="rule-status" class:active={b.enabled !== false}>{b.enabled !== false ? 'Enabled' : 'Disabled'}</span>
          <button class="btn-edit" onclick={() => editBlackout(b.id)}>Edit</button>
          <button class="btn-dup" onclick={async () => { const copy = { ...b, id: genId('b'), title: (b.title || '') + ' Copy' }; await saveBlackout(copy.id, copy); blackouts = await fetchBlackouts(); }}>Duplicate</button>
          <button class="btn-del" onclick={() => handleDeleteBlackout(b.id)}>Delete</button>
        </div>
      </div>
    {/each}
    {#if filteredBlackouts.length === 0}
      <div class="empty">No blackouts</div>
    {/if}
  </div>
{/if}

{#if view === 'variables'}
  <div class="rules-view">
    <div class="rules-header">
      <h3>Variables</h3>
      <button class="ml-auto p-1.5 rounded-full text-white transition-all duration-150 hover:scale-110 active:scale-95" style="background: var(--color-primary)" onclick={openNewVariable}><Plus size={14} strokeWidth={2} /></button>
    </div>
    {#if Object.keys(variables).length === 0}
      <div class="text-sm text-center py-8" style="color:var(--text-secondary)">No variables yet. Create one to use dynamic thresholds in rules.</div>
    {/if}
    {#each Object.entries(variables).sort((a, b) => alphaCompare(a[1].name, b[1].name) || alphaCompare(a[0], b[0])) as [vid, v]}
      <div class="rule-card">
        <div class="rule-head">
          <span class="rule-id font-mono" style="color:var(--color-primary)">{v.name}</span>
          <span class="rule-status active">default: {v.value}</span>
        </div>
        {#if v.description}
          <div class="rule-desc">{v.description}</div>
        {/if}
        {#if v.exceptions?.length}
          <div class="text-[11px] mt-1 flex flex-wrap gap-1" style="color:var(--text-secondary)">
            {#each v.exceptions as exc}
              <span class="px-1.5 py-0.5 rounded" style="background:rgba(var(--color-primary-rgb),0.08)">
                {exc.type === 'agent' ? '👤' : '🔷'} {exc.id}: {exc.value}
              </span>
            {/each}
          </div>
        {/if}
        <div class="rule-actions">
          <button class="btn-edit" onclick={() => editVariable(vid)}>Edit</button>
          <button class="btn-del" onclick={() => handleDeleteVariable(vid)}>Delete</button>
        </div>
      </div>
    {/each}
  </div>
{/if}

{#if view === 'plugins'}
  <div class="rules-view">
    <div class="rules-header">
      <h3>Plugins</h3>
      <input type="text" class="filter-input" placeholder="Filter plugins..." bind:value={filterText} />
      <button class="ml-auto p-1.5 rounded-full text-white transition-all duration-150 hover:scale-110 active:scale-95" style="background: var(--color-primary)" onclick={async () => {
          const nn = genId('p');
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
            await savePluginSource(nn, template);
            pluginList = await fetchAdminPlugins();
            const pi = pluginList.find(x => x.name === nn);
            editedPlugin = { ...pi, name: nn, label: nn, description: '', enabled: true };
            pluginSource = template;
            pluginSourceDirty = false;
            checkResult = null;
            showPluginDialog = true;
          } catch (err) { error = err.message; }
        }}><Plus size={14} strokeWidth={2} /></button>
      </div>
    {#each filteredPlugins as p}
      <div class="rule-card" style="cursor:pointer;" class:active={selPluginName === p.name}>
<div class="rule-head">
            <span class="rule-id">{p.label}</span>
        </div>
        {#if p.description}
          <div class="rule-desc">{p.description}</div>
        {/if}
        <div class="rule-actions">
          <span class="rule-status" class:active={p.enabled !== false}>{p.enabled !== false ? 'Enabled' : 'Disabled'}</span>
          <button class="btn-edit" onclick={async () => { const pi = pluginList.find(x => x.name === p.name); editedPlugin = { ...pi }; pluginSource = await fetchPluginSource(pi.name); pluginSourceDirty = false; checkResult = null; showPluginDialog = true; }}>Edit</button>
          <button class="btn-dup" onclick={async () => { const nn = genId('p'); const src = await fetchPluginSource(p.name); await savePluginSource(nn, src); await savePluginMeta(nn, { label: (p.label || p.name) + ' Copy', description: p.description || '' }); pluginList = await fetchAdminPlugins(); }}>Duplicate</button>
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
            try { checkResult = await checkPluginSource(pluginSource); }
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
      <button class="btn-close" onclick={() => showRuleDialog = false}>&#10005;</button>
    </div>
    <div class="dialog-body">
      <div style="margin-bottom:0.5rem;">
        <button onclick={() => expandedRuleGeneral = !expandedRuleGeneral} class="flex items-center gap-1 w-full text-left text-xs font-semibold" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedRuleGeneral ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> General
        </button>
      </div>
      {#if expandedRuleGeneral}
        <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
          <div style="display:flex;gap:1rem;">
            <div class="dialog-field" style="flex:1">
              <label>ID</label>
              <input type="text" value={editedRule.id || ''} placeholder="auto-generated" disabled={typeof editingRule === 'string'} />
            </div>
            <div class="dialog-field" style="display:flex;align-items:center;gap:0.5rem;padding-top:1.2rem;">
              <input type="checkbox" checked={editedRule.enabled ?? true} onchange={(e) => editedRule.enabled = e.target.checked} />
              <label style="margin:0;">Enabled</label>
            </div>
          </div>
          <div class="dialog-field"><label>Title</label><input type="text" bind:value={editedRule.title} /></div>
          <div class="dialog-field"><label>Description</label><input type="text" bind:value={editedRule.description} /></div>
        </div>
      {/if}

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button onclick={() => expandedRuleSettings = !expandedRuleSettings} class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedRuleSettings ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> Settings
        </button>
        {#if expandedRuleSettings}
          <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
            <div class="dialog-field">
              <label>Severity</label>
              <select bind:value={editedRule.severity} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)">
                <option value="warning">warning</option>
                <option value="critical">critical</option>
                <option value="info">info</option>
              </select>
            </div>
            <div class="dialog-field">
              <label>Plugin</label>
              <select bind:value={editedRule.pluginid} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)">
                <option value="">—</option>
                {#each filteredPlugins as p}
                  <option value={p.name}>{p.label} ({p.name})</option>
                {/each}
              </select>
            </div>
            <div style="display:flex;gap:0.5rem;">
              <div class="dialog-field" style="flex:1">
                <label>Metric</label>
                <input type="text" bind:value={editedRule.metric} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)" />
              </div>
              <div class="dialog-field" style="width:100px">
                <label>Condition</label>
                <select bind:value={editedRule.condition} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)">
                  {#each ['gt','ge','lt','le','eq','ne'] as c}
                    <option value={c}>{c}</option>
                  {/each}
                </select>
              </div>
              <div class="dialog-field" style="width:140px">
                <label>Threshold</label>
                <input
                  type="text"
                  value={editedRule.threshold ?? ''}
                  oninput={(e) => {
                    const v = e.target.value;
                    editedRule.threshold = v.startsWith('$') ? v.toUpperCase().replace(/[^$A-Z0-9_]/g,'') : v;
                    e.target.value = editedRule.threshold;
                  }}
                  placeholder="80 or $VAR"
                  style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:{String(editedRule.threshold).startsWith('$') ? 'var(--color-primary)' : 'var(--text-primary)'}; font-family: {String(editedRule.threshold).startsWith('$') ? 'monospace' : 'inherit'}"
                />
                {#if Object.keys(variables).length > 0}
                  <select
                    style="width:100%;padding:0.3rem 0.4rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.75rem;background:var(--bg-surface);color:var(--text-secondary);margin-top:2px"
                    onchange={(e) => { if (e.target.value) editedRule.threshold = e.target.value; e.target.value = ''; }}
                  >
                    <option value="">— use variable —</option>
                    {#each Object.values(variables).sort((a, b) => alphaCompare(a.name, b.name) || alphaCompare(a.id, b.id)) as v}
                      <option value={v.name}>{v.name} (default: {v.value})</option>
                    {/each}
                  </select>
                {/if}
              </div>
            </div>
            <div style="display:flex;gap:0.5rem;">
              <div class="dialog-field" style="flex:1">
                <label>Scope <Tooltip text="Single — evaluate each individual measurement. Moving avg — evaluate average of last N values. Count ratio — evaluate how many of last N values violate the threshold." /></label>
                <select bind:value={editedRule.scope} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)">
                  <option value="single">single</option>
                  <option value="moving_avg">moving_avg</option>
                  <option value="count_ratio">count_ratio</option>
                </select>
              </div>
              <div class="dialog-field" style="width:100px">
                <label>Window <Tooltip text="Number of recent measurements to consider for moving_avg and count_ratio scopes." /></label>
                <input type="number" bind:value={editedRule.window_size} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)" />
              </div>
              <div class="dialog-field" style="width:100px">
                <label>Violations <Tooltip text="Minimum number of threshold violations needed within the window for count_ratio to trigger." /></label>
                <input type="number" bind:value={editedRule.min_violations} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)" />
              </div>
            </div>
            <div class="dialog-field">
              <label>Fire mode <Tooltip text="Single — only one open alarm per agent+rule until ack'd. Multi — new alarm for every violation. Replace — ack existing open alarm and create a new one." /></label>
              <select bind:value={editedRule.fire} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)">
                <option value="single">single</option>
                <option value="multi">multi</option>
                <option value="replace">replace</option>
              </select>
            </div>
          </div>
        {/if}
      </div>

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button onclick={() => expandedAgents = !expandedAgents}
          class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2"
          style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;"
        >
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedAgents ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span>
          Restricted agents
        </button>
        {#if expandedAgents}
          <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);">
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
                  {#each Object.entries(agents).sort(compareEntries) as [agentId, agent] (agentId)}
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
          </div>
        {/if}
      </div>

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button onclick={() => expandedNotifications = !expandedNotifications}
          class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2"
          style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;"
        >
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedNotifications ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span>
          Notifications
        </button>
        {#if expandedNotifications}
          <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);">
          {#each ruleSchema.fields as field}
            {#if field.key === 'notifications'}
              <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
                {#each Object.values(notifications).sort(compareNamed) as n (n.id)}
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
          </div>
        {/if}
      </div>

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button onclick={() => expandedExecutors = !expandedExecutors}
          class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2"
          style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;"
        >
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedExecutors ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span>
          Executors
        </button>
        {#if expandedExecutors}
          <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);">
          {#each ruleSchema.fields as field}
            {#if field.key === 'executors'}
              <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
                {#each Object.values(executors).sort(compareNamed) as ex (ex.id)}
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
          </div>
        {/if}
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn-cancel" onclick={() => showRuleDialog = false}>Cancel</button>
      <button class="btn-save-rule" onclick={handleSaveRule} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
    </div>
  </div>
{/if}

<!-- Executor Dialog --><!-- Executor Dialog -->
{#if showExecDialog && editedExec}
  <div class="dialog-overlay" onclick={() => showExecDialog = false}></div>
  <div class="dialog">
    <div class="dialog-header">
      <h3>Executor {editedExec.id ? 'edit' : 'create'}</h3>
      <button class="btn-close" onclick={() => showExecDialog = false}>✕</button>
    </div>
    <div class="dialog-body">
      <div style="margin-bottom:0.5rem;">
        <button onclick={() => expandedExecGeneral = !expandedExecGeneral} class="flex items-center gap-1 w-full text-left text-xs font-semibold" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedExecGeneral ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> General
        </button>
      </div>
      {#if expandedExecGeneral}
        <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
          <div style="display:flex;gap:1rem;">
            <div class="dialog-field" style="flex:1">
              <label>ID</label>
              <input type="text" value={editedExec.id || ''} placeholder="auto-generated" disabled={typeof editingExec === 'string'} />
            </div>
            <div class="dialog-field" style="display:flex;align-items:center;gap:0.5rem;padding-top:1.2rem;">
              <input type="checkbox" checked={editedExec.enabled ?? true} onchange={(e) => editedExec.enabled = e.target.checked} />
              <label style="margin:0;">Enabled</label>
            </div>
          </div>
          <div class="dialog-field"><label>Title</label><input type="text" bind:value={editedExec.title} /></div>
          <div class="dialog-field"><label>Description</label><input type="text" bind:value={editedExec.description} /></div>
        </div>
      {/if}

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button onclick={() => expandedExecSettings = !expandedExecSettings} class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedExecSettings ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> Settings
        </button>
        {#if expandedExecSettings}
          <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
            <div class="dialog-field">
              <label>Execute on</label>
              <select bind:value={editedExec.execution_target} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)">
                <option value="server">server</option>
                <option value="agent">agent</option>
              </select>
            </div>
            <div class="dialog-field">
              <label>Shell Command</label>
              <textarea rows="3" bind:value={editedExec.command} style="padding:0.35rem;border:1px solid #cbd5e0;border-radius:5px;font-size:0.82rem;font-family:monospace;"></textarea>
              <div style="font-size:0.72rem;color:#888;margin-top:0.2rem;">Available variables: {'{rule_id}'}, {'{agentid}'}, {'{pluginid}'}, {'{metric}'}, {'{value}'}, {'{message}'}, {'{severity}'}</div>
            </div>
          </div>
        {/if}
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
  <div class="dialog" style="width:560px;max-width:calc(100vw - 2rem)">
    <div class="dialog-header">
      <h3>Notification {editedNotify.id?.includes('new_') ? 'create' : 'edit'}</h3>
      <button class="btn-close" onclick={() => showNotifyDialog = false}>✕</button>
    </div>
    <div class="dialog-body">
      <div style="margin-bottom:0.5rem;">
        <button onclick={() => expandedNotifyGeneral = !expandedNotifyGeneral} class="flex items-center gap-1 w-full text-left text-xs font-semibold" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedNotifyGeneral ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> General
        </button>
      </div>
      {#if expandedNotifyGeneral}
        <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
          <div style="display:flex;gap:1rem;">
            <div class="dialog-field" style="flex:1">
              <label>ID</label>
              <input type="text" value={editedNotify.id || ''} placeholder="auto-generated" disabled={typeof editingNotify === 'string'} />
            </div>
            <div class="dialog-field" style="display:flex;align-items:center;gap:0.5rem;padding-top:1.2rem;">
              <input type="checkbox" checked={editedNotify.enabled ?? true} onchange={(e) => editedNotify.enabled = e.target.checked} />
              <label style="margin:0;">Enabled</label>
            </div>
          </div>
          <div class="dialog-field"><label>Title</label><input type="text" bind:value={editedNotify.title} /></div>
          <div class="dialog-field"><label>Description</label><input type="text" bind:value={editedNotify.description} /></div>
        </div>
      {/if}

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button onclick={() => expandedNotifySettings = !expandedNotifySettings} class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedNotifySettings ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> Settings
        </button>
        {#if expandedNotifySettings}
          <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
            <div class="dialog-field">
              <label>Type</label>
              <select bind:value={editedNotify.type} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)">
                <option value="ntfy">ntfy</option>
                <option value="email">email</option>
                <option value="web_push">web_push</option>
                <option value="twilio_call">twilio_call</option>
              </select>
            </div>
          </div>
        {/if}
      </div>

      {#if editedNotify.type}
        {#if editedNotify.type === 'ntfy'}
          <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
            <button onclick={() => expandedNotifyNtfy = !expandedNotifyNtfy} class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
              <span style="display:inline-block; transition: transform 0.2s; transform: {expandedNotifyNtfy ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> Ntfy
            </button>
            {#if expandedNotifyNtfy}
              <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
                <div class="dialog-field"><label>ntfy Server URL</label><input type="text" bind:value={editedNotify.ntfy_url} /></div>
                <div class="dialog-field"><label>ntfy Topic</label><input type="text" bind:value={editedNotify.ntfy_topic} /></div>
                <div class="dialog-field"><label>ntfy Access Token</label><input type="password" bind:value={editedNotify.ntfy_access_token} /></div>
              </div>
            {/if}
          </div>
        {/if}

        {#if editedNotify.type === 'email'}
          <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
            <button onclick={() => expandedNotifyEmail = !expandedNotifyEmail} class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
              <span style="display:inline-block; transition: transform 0.2s; transform: {expandedNotifyEmail ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> Email
            </button>
            {#if expandedNotifyEmail}
              <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
                <div class="dialog-field"><label>Recipient</label><input type="text" bind:value={editedNotify.to} /></div>
                <div class="dialog-field"><label>Sender</label><input type="text" bind:value={editedNotify.from} /></div>
                <div class="dialog-field"><label>SMTP Server</label><input type="text" bind:value={editedNotify.server} /></div>
                <div style="display:flex;gap:0.5rem;">
                  <div class="dialog-field" style="flex:1"><label>Port</label><input type="number" bind:value={editedNotify.port} /></div>
                  <div class="dialog-field" style="flex:1"><label>SMTP User</label><input type="text" bind:value={editedNotify.user} /></div>
                </div>
                <div class="dialog-field"><label>Password</label><input type="password" bind:value={editedNotify.password} /></div>
                <div class="dialog-field">
                  <label><input type="checkbox" checked={editedNotify.use_tls ?? true} onchange={(e) => editedNotify.use_tls = e.target.checked} /> Use TLS</label>
                </div>
              </div>
            {/if}
          </div>
        {/if}

        {#if editedNotify.type === 'web_push'}
          <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
            <button onclick={() => expandedNotifyPush = !expandedNotifyPush} class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
              <span style="display:inline-block; transition: transform 0.2s; transform: {expandedNotifyPush ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> Push
            </button>
            {#if expandedNotifyPush}
              <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
                <div class="dialog-field"><label>VAPID Public Key</label><input type="text" bind:value={editedNotify.vapid_public_key} /></div>
                <div class="dialog-field"><label>VAPID Private Key</label><input type="password" bind:value={editedNotify.vapid_private_key} /></div>
                <div class="dialog-field"><label>VAPID Subject</label><input type="text" bind:value={editedNotify.vapid_subject} /></div>
              </div>
            {/if}
          </div>
        {/if}

        {#if editedNotify.type === 'twilio_call'}
          <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
            <button onclick={() => expandedNotifyTwilio = !expandedNotifyTwilio} class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
              <span style="display:inline-block; transition: transform 0.2s; transform: {expandedNotifyTwilio ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> Twilio
            </button>
            {#if expandedNotifyTwilio}
              <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
                <div class="dialog-field"><label>Account SID</label><input type="text" bind:value={editedNotify.twilio_account_sid} /></div>
                <div class="dialog-field"><label>Auth Token</label><input type="password" bind:value={editedNotify.twilio_auth_token} /></div>
                <div class="dialog-field"><label>Call From</label><input type="text" bind:value={editedNotify.twilio_call_from} /></div>
                <div class="dialog-field"><label>Call To</label><input type="text" bind:value={editedNotify.twilio_call_to} /></div>
              </div>
            {/if}
          </div>
        {/if}
      {/if}

      <button class="btn-cancel" style="margin-top:0.5rem;background:#805ad5;color:#fff;border:none;" onclick={async () => {
        try { await testNotification(editedNotify); alert('Test sent successfully'); }
        catch (e) { alert('Test failed: ' + e.message); }
      }}>Send Test</button>
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
  <div class="dialog" style="width:760px;max-width:calc(100vw - 2rem);top:5%;max-height:90vh;">
    <div class="dialog-header">
      <h3>Plugin: {editedPlugin.name}</h3>
      <button class="btn-close" onclick={() => { showPluginDialog = false; selPluginName = null; }}>✕</button>
    </div>
    <div class="dialog-body" style="overflow:visible;display:flex;flex-direction:column;gap:0.6rem;">
      <div style="margin-bottom:0.5rem;">
        <button onclick={() => expandedPluginGeneral = !expandedPluginGeneral} class="flex items-center gap-1 w-full text-left text-xs font-semibold" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedPluginGeneral ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> General
        </button>
      </div>
      {#if expandedPluginGeneral}
        <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
          <div style="display:flex;gap:1rem;">
            <div class="dialog-field" style="flex:1">
              <label>ID</label>
              <input type="text" value={editedPlugin.name} disabled />
            </div>
            <div class="dialog-field" style="display:flex;align-items:center;gap:0.5rem;padding-top:1.2rem;">
              <input type="checkbox" checked={editedPlugin.enabled !== false} onchange={async (e) => { await togglePluginEnabled(editedPlugin.name, e.target.checked); editedPlugin.enabled = e.target.checked; pluginList = await fetchAdminPlugins(); }} />
              <label style="margin:0;">Enabled</label>
            </div>
          </div>
          <div class="dialog-field">
            <label>Title</label>
            <input type="text" bind:value={editedPlugin.label} />
          </div>
          <div class="dialog-field">
            <label>Description</label>
            <input type="text" bind:value={editedPlugin.description} />
          </div>
        </div>
      {/if}

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button onclick={() => expandedPluginCode = !expandedPluginCode} class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedPluginCode ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> Code
        </button>
        {#if expandedPluginCode}
          <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
            <div style="display:flex;gap:0.4rem;margin-bottom:0.5rem;">
              <button class="btn-cancel" disabled={checking} onclick={async () => {
                checking = true; checkResult = null;
                try { checkResult = await checkPluginSource(pluginSource); }
                catch(e) { checkResult = { ok: false, errors: [{ type: 'error', msg: e.message }]}; }
                finally { checking = false; }
              }}>Check</button>
              <a href="/api/admin/plugins/{editedPlugin.name}/source" download="{editedPlugin.name}.py" class="btn-cancel" style="display:inline-flex;align-items:center;gap:0.2rem;text-decoration:none;">⬇ Download</a>
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
        {/if}
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn-cancel" onclick={() => { showPluginDialog = false; selPluginName = null; }}>Close</button>
      <button class="btn-save-rule" onclick={async () => {
        if (pluginSourceDirty) await savePluginSource(editedPlugin.name, pluginSource);
        await togglePluginEnabled(editedPlugin.name, editedPlugin.enabled !== false);
        await savePluginMeta(editedPlugin.name, { label: editedPlugin.label || '', description: editedPlugin.description || '' });
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
      <div style="margin-bottom:0.5rem;">
        <button onclick={() => expandedGroupGeneral = !expandedGroupGeneral} class="flex items-center gap-1 w-full text-left text-xs font-semibold" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedGroupGeneral ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> General
        </button>
      </div>
      {#if expandedGroupGeneral}
        <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
          <div class="dialog-field">
            <label>ID</label>
            <input type="text" bind:value={editedGroup.id} disabled={!!editedGroup.id} placeholder="auto-generated" />
          </div>
          <div class="dialog-field">
            <label>Title</label>
            <input type="text" bind:value={editedGroup.title} placeholder="group name" />
          </div>
          <div class="dialog-field">
            <label>Description</label>
            <input type="text" bind:value={editedGroup.description} />
          </div>
        </div>
      {/if}

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button onclick={() => expandedGroupPlugins = !expandedGroupPlugins} class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedGroupPlugins ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> Plugins
        </button>
        {#if expandedGroupPlugins}
          <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
            <div class="dialog-array" style="max-height:250px;overflow-y:auto;">
              {#each [...allPluginNames].sort(alphaCompare) as pn}
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
        {/if}
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn-cancel" onclick={() => showGroupDialog = false}>Cancel</button>
<button class="btn-save-rule" onclick={async () => {
        const gid = editedGroup.id?.trim() || genId('g');
        if (!gid) return;
        try {
          await setGroupPlugins(gid, {
            plugins: editedGroup.plugins || [],
            title: editedGroup.title || '',
            description: editedGroup.description || '',
          });
          showGroupDialog = false;
          groups = await fetchAdminGroups();
        } catch (e) { error = e.message; }
      }} disabled={!editedGroup.title?.trim()}>Save</button>
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
      <div style="margin-bottom:0.5rem;">
        <button onclick={() => expandedBlackoutGeneral = !expandedBlackoutGeneral} class="flex items-center gap-1 w-full text-left text-xs font-semibold" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedBlackoutGeneral ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> General
        </button>
      </div>
      {#if expandedBlackoutGeneral}
        <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
          <div style="display:flex;gap:1rem;">
            <div class="dialog-field" style="flex:1">
              <label>ID</label>
              <input type="text" readonly placeholder="auto-generated" style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-secondary)" />
            </div>
            <div class="dialog-field" style="display:flex;align-items:center;gap:0.5rem;padding-top:1.2rem;">
              <input type="checkbox" checked={editedBlackout.enabled !== false} onchange={(e) => editedBlackout.enabled = e.target.checked} />
              <label style="margin:0;">Enabled</label>
            </div>
          </div>
          <div class="dialog-field"><label>Title</label><input type="text" bind:value={editedBlackout.title} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)" /></div>
          <div class="dialog-field"><label>Description</label><input type="text" bind:value={editedBlackout.description} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)" /></div>
        </div>
      {/if}

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button onclick={() => expandedBlackoutSettings = !expandedBlackoutSettings} class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedBlackoutSettings ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> Settings
        </button>
        {#if expandedBlackoutSettings}
          <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
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
          </div>
        {/if}
      </div>

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button
          onclick={() => expandedBlackoutRules = !expandedBlackoutRules}
          class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2"
          style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;"
        >
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedBlackoutRules ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span>
          Target rules
        </button>
        {#if expandedBlackoutRules}
          <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);">
          <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
              {#each Object.values(rules).sort((a, b) => alphaCompare(a.id, b.id)) as rule}
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
          Target agents
        </button>
        {#if expandedBlackoutAgents}
          <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);">
          <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
            {#each Object.entries(agents).sort(compareEntries) as [agentId, agent]}
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
          Target groups
        </button>
        {#if expandedBlackoutGroups}
          <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);">
          <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
            {#each Object.entries(groups).sort(compareEntries).map(([gid]) => gid) as gid}
              <label class="checkbox-row" style="cursor:pointer;font-size:0.8rem;">
                <input type="checkbox" checked={(editedBlackout.target_groups || []).includes(gid)} onchange={(e) => {
                  const arr = [...(editedBlackout.target_groups || [])];
                  if (e.target.checked) arr.push(gid); else arr.splice(arr.indexOf(gid), 1);
                  editedBlackout.target_groups = arr;
                }} />
{groups[gid]?.title || gid}
              </label>
            {/each}
          </div>
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
  <div class="dialog" style="width:640px;max-width:calc(100vw - 2rem);top:5%;max-height:90vh;">
    <div class="dialog-header">
      <h3>Agent edit</h3>
      <button class="btn-close" onclick={closeAgentDialog}>✕</button>
    </div>
    <div class="dialog-body" style="overflow:visible;">
      <div style="margin-bottom:0.5rem;">
        <button onclick={() => expandedAgentGeneral = !expandedAgentGeneral} class="flex items-center gap-1 w-full text-left text-xs font-semibold" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedAgentGeneral ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> General
        </button>
      </div>
      {#if expandedAgentGeneral}
        <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
          <div style="display:flex;gap:1rem;margin-bottom:0.5rem;">
            <div class="dialog-field" style="flex:1">
              <label>ID</label>
              <input type="text" value={agentId} disabled />
            </div>
            <div class="dialog-field" style="display:flex;align-items:center;gap:0.5rem;padding-top:1.2rem;">
              <input type="checkbox" checked={agent.enabled !== false} onchange={async (e) => {
                const val = e.target.checked;
                try { await setAgentEnabled(agentId, val); await load(); editedAgentData = { ...agents[agentId], id: agentId }; }
                catch (err) { error = err.message; }
              }} />
              <label style="margin:0;">Enabled</label>
            </div>
          </div>
          <div style="margin-bottom:0.5rem;">
            <label style="font-size:0.82rem;font-weight:600;color:#555;">Title</label>
            <input type="text" bind:value={agent.title} onblur={async () => {
              try { await updateAgent(agentId, { title: agent.title }); await load(); editedAgentData = { ...agents[agentId], id: agentId }; }
              catch (err) { error = err.message; }
            }} style="width:100%;padding:0.35rem;border:1px solid #cbd5e0;border-radius:5px;font-size:0.82rem;margin-top:0.2rem;" />
          </div>
          <div style="margin-bottom:0.5rem;">
            <label style="font-size:0.82rem;font-weight:600;color:#555;">Description</label>
            <input type="text" bind:value={agent.description} onblur={async () => {
              try { await updateAgent(agentId, { description: agent.description }); await load(); editedAgentData = { ...agents[agentId], id: agentId }; }
              catch (err) { error = err.message; }
            }} style="width:100%;padding:0.35rem;border:1px solid #cbd5e0;border-radius:5px;font-size:0.82rem;margin-top:0.2rem;" />
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
            <span class="status-dot" class:online={agent.online} style="display:inline-block;width:10px;height:10px;border-radius:50%;flex-shrink:0;"></span>
            <span style="font-size:0.85rem;">{agent.online ? 'Online' : 'Offline'}</span>
            {#if agent.last_seen}
              <span style="font-size:0.75rem;color:#888;">last seen: {fmtTime(agent.last_seen)}</span>
            {/if}
          </div>
          <button class="btn-install" style="width:auto;padding:0.35rem 0.8rem;font-size:0.78rem;" onclick={() => navigator.clipboard.writeText(`curl -s '${window.location.origin}/api/agent/install.sh?agentid=${agentId}&apikey=${agent.apikey}' | sh`)}>
            📋 Copy install command
          </button>
        </div>
      {/if}

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button onclick={() => expandedAgentSettings = !expandedAgentSettings} class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedAgentSettings ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> Assigned groups
        </button>
        {#if expandedAgentSettings}
          <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
            <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
              {#each Object.entries(groups).sort(compareEntries).map(([gid]) => gid) as g}
                <label class="checkbox-row" style="cursor:pointer;font-size:0.8rem;">
                  <input type="checkbox" checked={agent.groups?.includes(g)} onchange={async () => { await toggleGroup(agentId, g); editedAgentData = { ...agents[agentId], id: agentId }; }} />
                  {groups[g]?.title || g}
                </label>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-default)">
        <button onclick={() => expandedAgentPlugins = !expandedAgentPlugins} class="flex items-center gap-1 w-full text-left text-xs font-semibold mb-2" style="color: var(--text-secondary); cursor: pointer; background: none; border: none; padding: 0;">
          <span style="display:inline-block; transition: transform 0.2s; transform: {expandedAgentPlugins ? 'rotate(90deg)' : 'rotate(0)'}">&#9656;</span> Plugins
        </button>
        {#if expandedAgentPlugins}
          <div style="padding-left:0.75rem;border-left:2px solid var(--border-default);margin-bottom:0.75rem;">
            <div class="plugin-grid">
              {#each agentPlugins as p}
                {@const schema = schemas[p]}
                {@const hasConfig = p in (agent.plugins || {})}
                <div class="plugin-card" class:active={selectedPlugin === p} class:configured={hasConfig}>
                  <div class="plugin-header">
                    <span class="plugin-name">{schema?.label || p}</span>
                    <button class="toggle-btn" class:active={hasConfig} onclick={async () => { await togglePlugin(agentId, p); editedAgentData = { ...agents[agentId], id: agentId }; selectedPlugin = null; editedPluginConfig = null; }}>{hasConfig ? 'On' : 'Off'}</button>
                  </div>
                  <div class="plugin-desc">{schema?.description || ''}</div>
                  {#if hasConfig}
                    <button class="edit-btn" onclick={() => selectPlugin(agentId, p)}>{selectedPlugin === p ? 'Editing...' : 'Configure'}</button>
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
                <PluginForm schema={schemas[selectedPlugin]} config={agents[agentId]?.plugins?.[selectedPlugin] || {}} onchange={(c) => editedPluginConfig = c} />
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn-cancel" onclick={closeAgentDialog}>Close</button>
      <button class="btn-save-rule" onclick={async () => {
        if (selectedPlugin && editedPluginConfig) {
          await savePluginConfig(agentId, selectedPlugin);
        }
        closeAgentDialog();
      }}>Save</button>
    </div>
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

<!-- Variable Dialog -->
{#if showVariableDialog && editedVariable}
  <div class="dialog-overlay" onclick={() => showVariableDialog = false}></div>
  <div class="dialog" style="max-width:520px">
    <div class="dialog-header">
      <h3>{editingVariable ? 'Edit Variable' : 'New Variable'}</h3>
      <button class="btn-close" onclick={() => showVariableDialog = false}>✕</button>
    </div>
    <div class="dialog-body">

      <div class="dialog-field">
        <label>Name</label>
        <input
          type="text"
          placeholder="$MY_THRESHOLD"
          value={editedVariable.name}
          oninput={(e) => {
            let v = e.target.value.toUpperCase().replace(/[^$A-Z0-9_]/g, '');
            if (!v.startsWith('$')) v = '$' + v.replace(/\$/g, '');
            editedVariable.name = v;
            e.target.value = v;
          }}
          style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;font-family:monospace;background:var(--bg-surface);color:var(--color-primary)"
        />
        <span class="text-[11px]" style="color:var(--text-secondary)">$UPPERCASE — letters and numbers only</span>
      </div>

      <div class="dialog-field">
        <label>Description</label>
        <input type="text" bind:value={editedVariable.description} style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)" />
      </div>

      <div class="dialog-field">
        <label>Default value</label>
        <input type="number" bind:value={editedVariable.value} step="any" style="width:100%;padding:0.35rem 0.5rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary)" />
      </div>

      <!-- Exceptions -->
      <div style="margin-top:0.75rem">
        <div class="flex items-center justify-between mb-1">
          <label style="font-size:0.78rem;font-weight:600;color:var(--text-secondary)">Exceptions</label>
          <button class="btn-edit" style="font-size:0.72rem;padding:0.2rem 0.5rem" onclick={addVarException}>+ Add</button>
        </div>
        {#if (editedVariable.exceptions || []).length === 0}
          <div class="text-[11px] py-2" style="color:var(--text-secondary)">No exceptions — all agents use the default value.</div>
        {/if}
        {#each (editedVariable.exceptions || []) as exc, i}
          <div class="flex items-center gap-1.5 mb-1.5">
            <select bind:value={exc.type} style="padding:0.3rem 0.4rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.78rem;background:var(--bg-surface);color:var(--text-primary);width:80px">
              <option value="agent">Agent</option>
              <option value="group">Group</option>
            </select>
            <select bind:value={exc.id} style="flex:1;padding:0.3rem 0.4rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.78rem;background:var(--bg-surface);color:var(--text-primary)">
              <option value="">— select —</option>
              {#if exc.type === 'agent'}
                {#each Object.entries(agents).sort(compareEntries) as [aid, ag]}
                  <option value={aid}>{ag.title || aid} ({aid})</option>
                {/each}
              {:else}
                {#each Object.entries(groups).sort(compareEntries) as [gid, g]}
                  <option value={gid}>{g?.title || gid} ({gid})</option>
                {/each}
              {/if}
            </select>
            <input type="number" bind:value={exc.value} step="any" style="width:80px;padding:0.3rem 0.4rem;border:1px solid var(--border-default);border-radius:5px;font-size:0.78rem;background:var(--bg-surface);color:var(--text-primary)" />
            <button onclick={() => removeVarException(i)} style="color:#ef4444;font-size:1rem;background:none;border:none;cursor:pointer;padding:0 0.2rem">×</button>
          </div>
        {/each}
      </div>

    </div>
    <div class="dialog-footer">
      <button class="btn-cancel" onclick={() => showVariableDialog = false}>Cancel</button>
      <button class="btn-save-rule" onclick={handleSaveVariable}>Save</button>
    </div>
  </div>
{/if}

<style>
  .dialog-overlay { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,0.5); touch-action: none; overscroll-behavior: none; }
  .dialog { position: fixed; top: max(1.5rem, env(safe-area-inset-top, 0px) + 1.5rem); left: 50%; transform: translateX(-50%); z-index: 51; background: #fff; border: 1px solid var(--border-default, #e2e8f0); border-radius: var(--radius-card); box-shadow: 0 16px 48px rgba(0,0,0,0.15); max-width: 500px; width: calc(100vw - 2rem); max-height: calc(100vh - max(3rem, env(safe-area-inset-top, 0px) + 3rem) - env(safe-area-inset-bottom, 0px)); overflow-y: auto; overscroll-behavior: contain; }
  :global(.dark) .dialog { background: #0f172a; box-shadow: 0 16px 48px rgba(0,0,0,0.5); }
  .dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-default); }
  .dialog-header h3 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-primary); }
  .dialog-body { padding: 1rem 1.25rem; }
  .dialog-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0.75rem 1.25rem; padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--border-default); }
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
  .btn-del { font-size: 0.7rem; color: #ef4444; cursor: pointer; background: none; border: none; padding: 0.1rem 0.3rem; margin-left: auto; }
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

  /* ── Tab bar with chevron scroll ── */
  .tab-nav-wrapper {
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid var(--border-default);
  }
  .tab-nav-scroll {
    display: flex;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;       /* Firefox */
    -ms-overflow-style: none;    /* IE/Edge */
  }
  .tab-nav-scroll::-webkit-scrollbar { display: none; } /* Chrome/Safari */
  .tab-nav-chevron {
    flex-shrink: 0;
    width: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    line-height: 1;
    color: var(--text-secondary);
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.15s, opacity 0.15s;
    opacity: 0.6;
  }
  .tab-nav-chevron:hover { opacity: 1; color: var(--color-primary); }
</style>
