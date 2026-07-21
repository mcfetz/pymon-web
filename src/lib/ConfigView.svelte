<script>
  import { onMount } from 'svelte';
  import PluginForm from './PluginForm.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import {
    fetchPluginSchemas, fetchAdminAgents, fetchAdminGroups,
    createAgent, deleteAgent, setAgentGroups, setAgentPluginConfig,
    removeAgentPlugin, setGroupPlugins, deleteGroup,
    fetchRuleSchema, fetchRules, saveRule, deleteRule,
    fetchExecutors, saveExecutor, deleteExecutor,
    fetchNotifications, saveNotification, deleteNotification, fetchNotifySchema,
    fetchAdminPlugins, fetchPluginSource, savePluginSource, deletePlugin, togglePluginEnabled,
  } from './api.js';

  let { pendingRule = null } = $props();

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

  let view = $state('agents'); // 'agents' | 'rules'
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

  // Plugin management state
  let pluginList = $state([]);
  let selPluginName = $state(null);
  let pluginSource = $state('');
  let pluginSourceDirty = $state(false);
  let checkResult = $state(null);
  let checking = $state(false);
  let showPluginDialog = $state(false);
  let editedPlugin = $state(null);

  async function load() {
    loading = true; error = null;
    try {
      const [s, a, g, rs, rsc, ex, nt, ns, pl] = await Promise.all([
        fetchPluginSchemas(), fetchAdminAgents(), fetchAdminGroups(),
        fetchRules(), fetchRuleSchema(), fetchExecutors(),
        fetchNotifications(), fetchNotifySchema(),
        fetchAdminPlugins(),
      ]);
      schemas = s; agents = a; groups = g; rules = rs; ruleSchema = rsc;
      executors = ex; notifications = nt; notifySchema = ns; pluginList = pl;
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
    def.id = 'new_' + Date.now();
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

  onMount(load);
</script>

{#if error}
    <div class="error-banner">{error}</div>
  {/if}

  {#if loading}
    <div class="loading">Loading configuration...</div>
  {:else}
    <div class="view-tabs">
      <button class="view-tab" class:active={view === 'agents'} onclick={() => view = 'agents'}>Agents</button>
      <button class="view-tab" class:active={view === 'rules'} onclick={() => view = 'rules'}>Rules</button>
      <button class="view-tab" class:active={view === 'executors'} onclick={() => view = 'executors'}>Executors</button>
      <button class="view-tab" class:active={view === 'notify'} onclick={() => view = 'notify'}>Notifications</button>
      <button class="view-tab" class:active={view === 'plugins'} onclick={() => view = 'plugins'}>Plugins</button>
    </div>

    {#if view === 'agents'}
  <div class="rules-view">
    <div class="rules-header">
      <h3>Agents</h3>
      <button class="btn-add-rule" onclick={async () => {
        const id = prompt('New agent ID:');
        if (!id?.trim()) return;
        try { await createAgent(id.trim()); await load(); }
        catch (e) { error = e.message; }
      }}>+ New Agent</button>
    </div>
    {#if Object.keys(agents).length === 0}
      <div class="empty">No agents</div>
    {:else}
      {#each Object.keys(agents).sort() as id}
        {@const a = agents[id]}
        <div class="rule-card">
          <div class="rule-head">
            <span class="status-dot" class:online={a.online} style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#e53e3e;flex-shrink:0;margin-right:0.3rem;"></span>
            <span class="rule-id">{id}</span>
            <span class="rule-badge">{a.groups?.join(', ') || '—'}</span>
            <span style="margin-left:auto;font-size:0.75rem;color:#888;">
              {#if a.last_seen}{fmtTime(a.last_seen)}{:else}never{/if}
            </span>
          </div>
          <div class="rule-actions">
            <span class="rule-status" class:active={a.online}>{a.online ? 'Online' : 'Offline'}</span>
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
      <button class="btn-add-rule" onclick={openNewRule}>+ New Rule</button>
    </div>

    {#each Object.values(rules) as rule (rule.id)}
      <div class="rule-card">
        <div class="rule-head">
          <span class="rule-id">{rule.id}</span>
          <span class="rule-sev {rule.severity}">{rule.severity}</span>
          <span class="rule-badge">{rule.pluginid}/{rule.metric} {rule.condition} {rule.threshold}</span>
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
      <button class="btn-add-rule" onclick={openNewExec}>+ New Executor</button>
    </div>
    {#each Object.values(executors) as exec (exec.id)}
      <div class="rule-card">
        <div class="rule-head">
          <span class="rule-id">{exec.title || exec.id}</span>
        </div>
        <div class="rule-desc" style="font-family:monospace;font-size:0.8rem;">{exec.command || '—'}</div>
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
      <button class="btn-add-rule" onclick={openNewNotify}>+ New Notification</button>
    </div>
    {#each Object.values(notifications) as n (n.id)}
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
{#if view === 'plugins'}
  <div class="rules-view">
    <div class="rules-header">
      <h3>Plugins</h3>
      <label class="btn-add-rule" style="cursor:pointer;">
        + Upload .py
        <input type="file" accept=".py" style="display:none" onchange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return;
          const name = file.name.replace(/\.py$/, '');
          const text = await file.text();
          try {
            await fetch(`/api/admin/plugins/${name}/source`, { method: 'PUT', headers: { 'agentid': 'admin', 'X-API-Key': '333', 'Content-Type': 'text/plain' }, body: text });
            pluginList = await fetchAdminPlugins();
          } catch (err) { error = err.message; }
          e.target.value = '';
        }} />
      </label>
    </div>
    {#each pluginList as p}
      <div class="rule-card" style="cursor:pointer;" class:active={selPluginName === p.name}>
        <div class="rule-head">
          <span class="rule-id">{p.label} ({p.name})</span>
          <span class="rule-badge">{p.size} B</span>
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
        <CodeEditor value={pluginSource} onchange={(v) => { pluginSource = v; pluginSourceDirty = true; }} />
      {/key}
      {#if checkResult}
        <div class="check-result" class:ok={checkResult.ok}>
          {#if checkResult.ok}✅ No errors{:else}<strong>⚠ {checkResult.errors.length} Errors:</strong>{#each checkResult.errors as err}<div class="check-error">Line {err.line || '?'}: {err.msg}</div>{/each}{/if}
        </div>
      {/if}
    </div>
  {/if}
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
      {#each ruleSchema.fields as field}
        <div class="dialog-field">
          <label>{field.label}</label>
          {#if field.key === 'pluginid'}
            <select bind:value={editedRule[field.key]}>
              <option value="">—</option>
              {#each pluginList as p}
                <option value={p.name}>{p.label} ({p.name})</option>
              {/each}
            </select>
          {:else if field.key === 'notifications'}
            <div class="dialog-array" style="max-height:150px;overflow-y:auto;">
              {#each Object.values(notifications) as n (n.id)}
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
              {#each Object.values(executors) as ex (ex.id)}
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
      {/each}
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
  <div class="dialog">
    <div class="dialog-header">
      <h3>Notification {editedNotify.id?.includes('new_') ? 'create' : 'edit'}</h3>
      <button class="btn-close" onclick={() => showNotifyDialog = false}>✕</button>
    </div>
    <div class="dialog-body">
      {#each notifySchema.fields as field}
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
      {/each}
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
    <div class="dialog-body" style="overflow:visible;">
      <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:0.75rem;">
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
        <span style="flex:1;"></span>
        <span style="font-size:0.78rem;color:#888;align-self:center;">{pluginSourceDirty ? '(unsaved)' : ''}</span>
      </div>
      {#key editedPlugin.name}
        <div style="height:350px;border:1px solid #cbd5e0;border-radius:6px;overflow:hidden;">
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

<!-- Source editor when opened inline from plugin dialog -->
{#if selPluginName && !showPluginDialog}
  <div style="margin-top:1rem;border-top:1px solid #e2e8f0;padding-top:1rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
      <h4 style="margin:0;font-size:0.9rem;">{selPluginName}.py</h4>
      <button class="btn-cancel" onclick={() => { selPluginName = null; pluginSource = ''; checkResult = null; }}>Close</button>
    </div>
    {#key selPluginName}
      <CodeEditor value={pluginSource} onchange={(v) => { pluginSource = v; pluginSourceDirty = true; }} />
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
        <span class="status-dot" class:online={agent.online} style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#e53e3e;flex-shrink:0;"></span>
        <span style="font-size:0.85rem;">{agent.online ? 'Online' : 'Offline'}</span>
        {#if agent.last_seen}
          <span style="font-size:0.75rem;color:#888;">last seen: {fmtTime(agent.last_seen)}</span>
        {/if}
        <span style="flex:1;"></span>
        <button class="btn-install" style="width:auto;padding:0.35rem 0.8rem;font-size:0.78rem;" onclick={() => navigator.clipboard.writeText(`curl -s '${window.location.origin}/api/agent/install.sh?agentid=${agentId}&apikey=${agent.apikey}' | sh`)}>
          📋 Copy install command
        </button>
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
      </section>
    </div>
    <div class="dialog-footer">
      <button class="btn-cancel" onclick={closeAgentDialog}>Cancel</button>
      <button class="btn-save-rule" onclick={closeAgentDialog}>Save</button>
    </div>
  </div>
{/if}

<style>
  .config-layout {
    display: grid;
    grid-template-columns: 220px 1fr 300px;
    gap: 1rem;
    min-height: 60vh;
  }

  .error-banner {
    background: #fde8e8; color: #c53030; border: 1px solid #f5c6c6;
    border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 1rem;
    grid-column: 1 / -1;
  }

  .loading { text-align: center; padding: 3rem; color: #888; grid-column: 1 / -1; }
  .empty { text-align: center; padding: 3rem; color: #aaa; font-style: italic; }

  /* Agent Panel */
  .agent-panel { border-right: 1px solid #e2e8f0; padding-right: 0.75rem; }
  .agent-panel h3 { margin: 0 0 0.5rem; font-size: 0.95rem; }
  .agent-list { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.75rem; }
  .agent-item {
    display: flex; flex-direction: column; align-items: flex-start;
    padding: 0.5rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 6px;
    background: #fff; cursor: pointer; text-align: left; width: 100%;
    font-size: 0.85rem;
  }
  .agent-item.active { background: #4361ee; color: #fff; border-color: #4361ee; }
  .agent-line { display: flex; align-items: center; gap: 0.35rem; width: 100%; }
  .agent-name { font-weight: 600; }
  .agent-meta { display: flex; flex-direction: column; gap: 0.1rem; width: 100%; }
  .agent-groups { font-size: 0.7rem; color: #888; }
  .agent-item.active .agent-groups { color: #ddd; }
  .agent-last { font-size: 0.65rem; color: #aaa; }
  .agent-item.active .agent-last { color: #ccc; }
  .status-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    background: #e53e3e; flex-shrink: 0;
  }
  .status-dot.online { background: #38a169; }

  .add-agent { display: flex; gap: 0.3rem; }
  .add-agent input {
    flex: 1; padding: 0.4rem; border: 1px solid #cbd5e0; border-radius: 5px;
    font-size: 0.8rem;
  }
  .add-agent button {
    background: #4361ee; color: #fff; border: none; border-radius: 5px;
    padding: 0.3rem 0.7rem; cursor: pointer;
  }

  /* Detail Panel */
  .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
  .detail-header h3 { margin: 0; font-size: 1.1rem; }
  .btn-danger {
    background: #fed7d7; color: #c53030; border: 1px solid #f5c6c6;
    border-radius: 5px; padding: 0.3rem 0.7rem; cursor: pointer; font-size: 0.8rem;
  }

  .config-section { margin-bottom: 1.25rem; }
  .config-section h4 { margin: 0 0 0.5rem; font-size: 0.9rem; color: #555; }

  .btn-install {
    background: #1a1a2e; color: #a0f0a0; border: none; border-radius: 6px;
    padding: 0.5rem 1rem; cursor: pointer; font-size: 0.82rem; font-family: monospace;
    width: 100%; text-align: center;
  }
  .btn-install:hover { background: #2d2d4e; }

  .chip-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .chip {
    background: #fff; border: 1px solid #cbd5e0; border-radius: 12px;
    padding: 0.25rem 0.7rem; cursor: pointer; font-size: 0.78rem; color: #555;
  }
  .chip.active { background: #4361ee; color: #fff; border-color: #4361ee; }

  .plugin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.5rem; }
  .plugin-card {
    border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.6rem;
    background: #fff; display: flex; flex-direction: column; gap: 0.3rem;
  }
  .plugin-card.active { border-color: #4361ee; }
  .plugin-card.configured { background: #f0fff4; border-color: #c6f6d5; }
  .plugin-header { display: flex; justify-content: space-between; align-items: center; }
  .plugin-name { font-weight: 600; font-size: 0.85rem; }
  .plugin-desc { font-size: 0.72rem; color: #888; }
  .toggle-btn {
    font-size: 0.7rem; padding: 0.15rem 0.45rem; border-radius: 4px;
    border: 1px solid #cbd5e0; background: #fff; cursor: pointer;
  }
  .toggle-btn.active { background: #38a169; color: #fff; border-color: #38a169; }
  .edit-btn {
    background: none; border: none; color: #4361ee; cursor: pointer;
    font-size: 0.78rem; padding: 0; text-align: left;
  }

  /* Config Editor */
  .config-editor {
    border-left: 1px solid #e2e8f0; padding-left: 0.75rem;
    display: flex; flex-direction: column; gap: 0.75rem;
  }
  .editor-header { display: flex; justify-content: space-between; align-items: center; }
  .editor-header h4 { margin: 0; font-size: 0.95rem; }
  .btn-close { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: #888; }
  .btn-save {
    background: #4361ee; color: #fff; border: none; border-radius: 5px;
    padding: 0.5rem; cursor: pointer; font-size: 0.85rem; width: 100%;
  }
  .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

  /* ── View Tabs ── */
  .view-tabs { display: flex; gap: 0; margin-bottom: 1rem; grid-column: 1 / -1; }
  .view-tab {
    background: transparent; border: 1px solid #cbd5e0; padding: 0.4rem 1rem;
    cursor: pointer; font-size: 0.85rem; color: #555;
  }
  .view-tab:first-child { border-radius: 6px 0 0 6px; }
  .view-tab:last-child  { border-radius: 0 6px 6px 0; }
  .view-tab.active { background: #4361ee; color: #fff; border-color: #4361ee; }

  /* ── Rules View ── */
  .rules-view { grid-column: 1 / -1; }
  .rules-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
  .rules-header h3 { margin: 0; font-size: 1.1rem; }
  .btn-add-rule {
    background: #38a169; color: #fff; border: none; border-radius: 5px;
    padding: 0.35rem 0.8rem; cursor: pointer; font-size: 0.82rem;
  }

  .rule-card {
    border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.6rem 0.8rem;
    background: #fff; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.3rem;
  }
  .rule-head { display: flex; align-items: center; gap: 0.5rem; }
  .rule-id { font-weight: 600; font-size: 0.85rem; }
  .rule-sev {
    font-size: 0.65rem; font-weight: 600; text-transform: uppercase;
    padding: 0.1rem 0.35rem; border-radius: 3px;
  }
  .rule-sev.warning { background: #feebc8; color: #c05621; }
  .rule-sev.critical { background: #fed7d7; color: #c53030; }
  .rule-badge { font-size: 0.75rem; color: #666; }
  .rule-desc { font-size: 0.78rem; color: #888; }
  .rule-actions { display: flex; align-items: center; gap: 0.5rem; }
  .rule-status { font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 3px; background: #fed7d7; color: #c53030; }
  .rule-status.active { background: #c6f6d5; color: #276749; }
  .btn-edit { background: none; border: none; color: #4361ee; cursor: pointer; font-size: 0.78rem; }
  .btn-dup { background: none; border: none; color: #805ad5; cursor: pointer; font-size: 0.78rem; }
  .btn-del { background: none; border: none; color: #e53e3e; cursor: pointer; font-size: 0.78rem; }

  /* ── Rule Dialog ── */
  .dialog-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100;
  }
  .dialog {
    position: fixed; top: 10%; left: 50%; transform: translateX(-50%);
    background: #fff; border-radius: 10px; z-index: 101;
    width: 520px; max-width: 95vw; max-height: 80vh; overflow-y: auto;
    display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  }
  .dialog-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0;
  }
  .dialog-header h3 { margin: 0; font-size: 1rem; }
  .dialog-body { padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; flex: 1; overflow-y: auto; }
  .dialog-footer {
    display: flex; justify-content: flex-end; gap: 0.5rem;
    padding: 0.75rem 1rem; border-top: 1px solid #e2e8f0;
  }
  .dialog-field { display: flex; flex-direction: column; gap: 0.2rem; }
  .dialog-field label { font-size: 0.78rem; font-weight: 600; color: #555; }
  .dialog-field select, .dialog-field input[type="text"], .dialog-field input[type="number"] {
    padding: 0.35rem 0.5rem; border: 1px solid #cbd5e0; border-radius: 5px; font-size: 0.82rem;
  }
  .dialog-field input[type="checkbox"] { width: 1.1rem; height: 1.1rem; }
  .btn-cancel { background: #edf2f7; border: 1px solid #cbd5e0; border-radius: 5px; padding: 0.35rem 0.8rem; cursor: pointer; font-size: 0.8rem; }
  .btn-save-rule { background: #4361ee; color: #fff; border: none; border-radius: 5px; padding: 0.35rem 0.8rem; cursor: pointer; font-size: 0.8rem; }
  .btn-save-rule:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-sm { background: none; border: 1px solid #cbd5e0; border-radius: 3px; cursor: pointer; font-size: 0.7rem; padding: 0.1rem 0.35rem; }
  .dialog-array { display: flex; flex-direction: column; gap: 0.25rem; }
  .array-row { display: flex; gap: 0.3rem; align-items: center; }
  .array-row input { flex: 1; }
  .check-result {
    margin-top: 0.5rem; padding: 0.5rem 0.75rem; border-radius: 6px;
    font-size: 0.82rem; background: #fed7d7; color: #c53030;
  }
  .check-result.ok { background: #c6f6d5; color: #276749; }
  .check-error { font-family: monospace; font-size: 0.78rem; margin-top: 0.2rem; padding-left: 0.5rem; }
</style>