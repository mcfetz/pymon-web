<script>
  import { onMount } from 'svelte';
  import PluginForm from './PluginForm.svelte';
  import {
    fetchPluginSchemas, fetchAdminAgents, fetchAdminGroups,
    createAgent, deleteAgent, setAgentGroups, setAgentPluginConfig,
    removeAgentPlugin, setGroupPlugins, deleteGroup,
  } from './api.js';

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
  let newGroupName = $state('');

  async function load() {
    loading = true; error = null;
    try {
      const [s, a, g] = await Promise.all([
        fetchPluginSchemas(), fetchAdminAgents(), fetchAdminGroups(),
      ]);
      schemas = s; agents = a; groups = g;
    } catch (e) { error = e.message; }
    finally { loading = false; }
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
    if (!confirm(`Agent ${id} wirklich löschen?`)) return;
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

<div class="config-layout">
  {#if error}
    <div class="error-banner">{error}</div>
  {/if}

  {#if loading}
    <div class="loading">Lade Konfiguration...</div>
  {:else}
    <!-- Left: Agent List -->
    <aside class="agent-panel">
      <h3>Agenten</h3>
      <div class="agent-list">
        {#each Object.keys(agents).sort() as id}
          <button
            class="agent-item"
            class:active={selectedAgent === id}
            onclick={() => { selectedAgent = id; selectedPlugin = null; }}
          >
            <span class="agent-name">{id}</span>
            <span class="agent-groups">{agents[id].groups.join(', ')}</span>
          </button>
        {/each}
      </div>
      <div class="add-agent">
        <input type="text" placeholder="Neuer Agent..." bind:value={newAgentId} />
        <button onclick={handleCreateAgent}>+</button>
      </div>
    </aside>

    <!-- Center: Agent Details -->
    <main class="detail-panel">
      {#if selectedAgent && agents[selectedAgent]}
        {@const agent = agents[selectedAgent]}

        <div class="detail-header">
          <h3>{selectedAgent}</h3>
          <button class="btn-danger" onclick={() => handleDeleteAgent(selectedAgent)}>Löschen</button>
        </div>

        <!-- Install Command -->
        <section class="config-section">
          <h4>Installation</h4>
          <div class="install-box">
            <code class="install-cmd" id="install-cmd">curl -s '{window.location.origin}/api/agent/install.sh?agentid={selectedAgent}&amp;apikey={agent.apikey}' | sh</code>
            <button class="btn-copy" onclick={() => navigator.clipboard.writeText(`curl -s '${window.location.origin}/api/agent/install.sh?agentid=${selectedAgent}&apikey=${agent.apikey}' | sh`)}>
              Kopieren
            </button>
          </div>
        </section>

        <!-- Groups -->
        <section class="config-section">
          <h4>Gruppen</h4>
          <div class="chip-list">
            {#each Object.keys(groups).sort() as g}
              <button
                class="chip"
                class:active={agent.groups.includes(g)}
                onclick={() => toggleGroup(selectedAgent, g)}
              >{g}</button>
            {/each}
          </div>
        </section>

        <!-- Plugins -->
        <section class="config-section">
          <h4>Plugins</h4>
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
                    onclick={() => togglePlugin(selectedAgent, p)}
                  >{hasConfig ? 'An' : 'Aus'}</button>
                </div>
                <div class="plugin-desc">{schema?.description || ''}</div>
                {#if hasConfig}
                  <button class="edit-btn" onclick={() => selectPlugin(selectedAgent, p)}>
                    {selectedPlugin === p ? 'Bearbeiten...' : 'Konfigurieren'}
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {:else}
        <div class="empty">Wähle einen Agenten aus</div>
      {/if}
    </main>

    <!-- Right: Plugin Config Editor -->
    {#if selectedPlugin && selectedAgent}
      <aside class="config-editor">
        <div class="editor-header">
          <h4>{schemas[selectedPlugin]?.label || selectedPlugin}</h4>
          <button class="btn-close" onclick={() => { selectedPlugin = null; editedPluginConfig = null; }}>✕</button>
        </div>
        <PluginForm
          schema={schemas[selectedPlugin]}
          config={agents[selectedAgent]?.plugins?.[selectedPlugin] || {}}
          onchange={(c) => editedPluginConfig = c}
        />
        <button class="btn-save" onclick={() => savePluginConfig(selectedAgent, selectedPlugin)} disabled={saving}>
          {saving ? 'Speichere...' : 'Speichern'}
        </button>
      </aside>
    {/if}
  {/if}
</div>

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
  .agent-name { font-weight: 600; }
  .agent-groups { font-size: 0.7rem; color: #888; }
  .agent-item.active .agent-groups { color: #ddd; }

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

  .install-box {
    background: #1a1a2e; border-radius: 6px; padding: 0.6rem;
    display: flex; gap: 0.4rem; align-items: center;
  }
  .install-cmd {
    flex: 1; font-size: 0.72rem; color: #a0f0a0; font-family: monospace;
    white-space: nowrap; overflow-x: auto; user-select: all;
  }
  .btn-copy {
    background: #4361ee; color: #fff; border: none; border-radius: 4px;
    padding: 0.3rem 0.6rem; cursor: pointer; font-size: 0.72rem; white-space: nowrap;
  }

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
</style>