<script>
  /**
   * Topology page: the integrated graph of everything the pymon plugins know.
   *
   * The server merges the nodes by generic identifiers (MAC, IP, FQDN, address
   * plus port), so one device shows up once even when several plugins describe
   * it. This view only lays that out and lets the user explore it.
   */
  import GlassCard from './GlassCard.svelte';
  import EmptyState from './EmptyState.svelte';
  import TopologyGraph from './TopologyGraph.svelte';
  import { fetchTopology } from '../api.js';
  import Network from 'lucide-svelte/icons/network';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import Search from 'lucide-svelte/icons/search';
  import X from 'lucide-svelte/icons/x';

  let graph = $state({ nodes: [], edges: [] });
  let loading = $state(true);
  let error = $state('');
  let updatedAt = $state(null);
  let selectedId = $state(null);
  let kindFilter = $state(new Set());
  let search = $state('');
  let autoRefresh = $state(false);
  let grouped = $state(true);
  let graphEl = $state(null);

  const KIND_LABEL = {
    'pve-node': 'Proxmox-Knoten',
    'pve-guest': 'VM / LXC',
    'docker-host': 'Docker-Host',
    service: 'Dienst',
    container: 'Container',
    'public-name': 'öffentlicher Name',
    wan: 'WAN',
  };

  const EDGE_LABEL = {
    guest: 'läuft als Gast',
    runs: 'führt aus',
    proxies: 'proxyt',
    'routes-to': 'leitet ins',
  };

  async function load() {
    loading = true;
    error = '';
    try {
      const data = await fetchTopology();
      graph = { nodes: data.nodes || [], edges: data.edges || [] };
      updatedAt = new Date();
    } catch (e) {
      error = e?.message || 'Topologie konnte nicht geladen werden';
    } finally {
      loading = false;
    }
  }

  load();

  $effect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  });

  let kinds = $derived.by(() => {
    const counts = new Map();
    for (const n of graph.nodes) counts.set(n.kind, (counts.get(n.kind) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  });

  let edgeKinds = $derived.by(() => {
    const counts = new Map();
    for (const e of graph.edges) counts.set(e.kind, (counts.get(e.kind) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  });

  let staleCount = $derived(graph.nodes.filter((n) => n.stale).length);

  let visibleNodes = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return graph.nodes.filter((n) => {
      if (kindFilter.size && !kindFilter.has(n.kind)) return false;
      if (!q) return true;
      const hay = [n.label, n.id, ...(n.ids || []), n.kind].join(' ').toLowerCase();
      return hay.includes(q);
    });
  });

  let visibleEdges = $derived.by(() => {
    const ids = new Set(visibleNodes.map((n) => n.id));
    return graph.edges.filter((e) => ids.has(e.src) && ids.has(e.dst));
  });

  let selected = $derived(graph.nodes.find((n) => n.id === selectedId) || null);

  let selectedEdges = $derived.by(() => {
    if (!selected) return [];
    return graph.edges.filter((e) => e.src === selected.id || e.dst === selected.id);
  });

  function nodeName(id) {
    const n = graph.nodes.find((x) => x.id === id);
    return n ? n.label : id;
  }

  function toggleKind(kind) {
    const next = new Set(kindFilter);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    kindFilter = next;
  }

  function attrsText(attrs) {
    if (!attrs || typeof attrs !== 'object') return '';
    return Object.entries(attrs)
      .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(' · ');
  }
</script>

<div class="topology-page">
  <div class="toolbar">
    <div class="stats">
      <strong>{graph.nodes.length}</strong> Knoten ·
      <strong>{graph.edges.length}</strong> Kanten
      {#if staleCount}
        · <span class="stale-note">{staleCount} veraltet</span>
      {/if}
      {#if updatedAt}
        · <span class="muted">Stand {updatedAt.toLocaleTimeString()}</span>
      {/if}
    </div>

    <div class="actions">
      <label class="search">
        <Search size={14} />
        <input type="search" placeholder="Knoten suchen" bind:value={search} />
        {#if search}
          <button type="button" class="icon-btn" onclick={() => (search = '')} aria-label="Suche leeren">
            <X size={13} />
          </button>
        {/if}
      </label>
      <label class="toggle">
        <input type="checkbox" bind:checked={grouped} />
        <span>Gruppen</span>
      </label>
      <label class="toggle">
        <input type="checkbox" bind:checked={autoRefresh} />
        <span>live</span>
      </label>
      <button type="button" class="refresh" onclick={load} disabled={loading}>
        <RefreshCw size={14} class={loading ? 'spin' : ''} />
        <span>Aktualisieren</span>
      </button>
    </div>
  </div>

  {#if kinds.length > 0}
    <div class="filters">
      {#each kinds as [kind, count] (kind)}
        <button
          type="button"
          class="pill"
          class:active={kindFilter.has(kind)}
          onclick={() => toggleKind(kind)}
        >
          <span class="dot" data-kind={kind}></span>
          {KIND_LABEL[kind] || kind} <span class="count">{count}</span>
        </button>
      {/each}
      {#if kindFilter.size}
        <button type="button" class="pill clear" onclick={() => (kindFilter = new Set())}>Filter aus</button>
      {/if}
    </div>
  {/if}

  {#if error}
    <GlassCard>
      <EmptyState icon={Network} message="Topologie nicht verfügbar" sub={error} />
    </GlassCard>
  {:else if loading && !graph.nodes.length}
    <GlassCard><p class="muted pad">Lade Topologie …</p></GlassCard>
  {:else if !graph.nodes.length}
    <GlassCard>
      <EmptyState
        icon={Network}
        message="Noch keine Topologie-Daten"
        sub="Sobald proxmox, docker_host oder ein anderes Plugin Knoten meldet, erscheint der Graph hier."
      />
    </GlassCard>
  {:else}
    <div class="layout" class:with-panel={!!selected}>
      <TopologyGraph
        nodes={visibleNodes}
        edges={visibleEdges}
        selectedId={selectedId}
        {grouped}
        onselect={(id) => (selectedId = id)}
        height={640}
      />

      {#if selected}
        <GlassCard className="detail">
          <div class="detail-head">
            <div>
              <p class="detail-kind">{KIND_LABEL[selected.kind] || selected.kind}</p>
              <h3>{selected.label}</h3>
            </div>
            <button type="button" class="icon-btn" onclick={() => (selectedId = null)} aria-label="Schließen">
              <X size={14} />
            </button>
          </div>

          {#if selected.stale}
            <p class="stale-note">Dieser Knoten hat sich länger nicht gemeldet.</p>
          {/if}

          <p class="sources">
            Gemeldet von: {(selected.sources || []).join(', ') || 'unbekannt'}
          </p>

          {#if selected.ids?.length}
            <h4>Identifier</h4>
            <ul class="ids">
              {#each selected.ids as id (id)}
                <li><code>{id}</code></li>
              {/each}
            </ul>
          {/if}

          {#if attrsText(selected.attrs)}
            <h4>Attribute</h4>
            <p class="attrs">{attrsText(selected.attrs)}</p>
          {/if}

          <h4>Verbindungen ({selectedEdges.length})</h4>
          <ul class="links">
            {#each selectedEdges as e (e.src + e.dst + e.kind)}
              <li>
                <span class="edge-kind" data-kind={e.kind}>{EDGE_LABEL[e.kind] || e.kind}</span>
                {#if e.src === selected.id}
                  → {nodeName(e.dst)}
                {:else}
                  ← {nodeName(e.src)}
                {/if}
                {#if e.label}<span class="muted">({e.label})</span>{/if}
              </li>
            {/each}
          </ul>
        </GlassCard>
      {/if}
    </div>

    <div class="legend">
      {#each edgeKinds as [kind, count] (kind)}
        <span class="legend-item">
          <span class="line" data-kind={kind}></span>
          {EDGE_LABEL[kind] || kind} <span class="count">{count}</span>
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .topology-page {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
  }

  .stats {
    font-size: 0.85rem;
    color: rgb(203, 213, 225);
  }

  .muted {
    color: rgba(148, 163, 184, 0.85);
  }

  .stale-note {
    color: rgb(251, 191, 36);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.5rem;
    border-radius: 0.6rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(15, 23, 42, 0.5);
    color: rgba(148, 163, 184, 0.9);
  }

  .search input {
    border: none;
    background: transparent;
    color: rgb(226, 232, 240);
    font-size: 0.85rem;
    outline: none;
    width: 11rem;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    color: rgb(203, 213, 225);
  }

  .refresh {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.7rem;
    border-radius: 0.6rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(30, 41, 59, 0.7);
    color: rgb(226, 232, 240);
    font-size: 0.82rem;
    cursor: pointer;
  }

  .refresh:disabled {
    opacity: 0.6;
    cursor: default;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .icon-btn {
    border: none;
    background: transparent;
    color: rgba(148, 163, 184, 0.9);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.28rem 0.6rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.22);
    background: rgba(15, 23, 42, 0.45);
    color: rgb(203, 213, 225);
    font-size: 0.78rem;
    cursor: pointer;
  }

  .pill.active {
    border-color: rgba(56, 189, 248, 0.65);
    background: rgba(56, 189, 248, 0.14);
    color: rgb(224, 242, 254);
  }

  .pill.clear {
    border-style: dashed;
  }

  .count {
    color: rgba(148, 163, 184, 0.85);
    font-variant-numeric: tabular-nums;
  }

  .dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 999px;
    background: #94a3b8;
  }

  .dot[data-kind='pve-node'] { background: #a78bfa; }
  .dot[data-kind='pve-guest'] { background: #60a5fa; }
  .dot[data-kind='docker-host'] { background: #34d399; }
  .dot[data-kind='service'] { background: #fbbf24; }
  .dot[data-kind='container'] { background: #f472b6; }
  .dot[data-kind='public-name'] { background: #22d3ee; }
  .dot[data-kind='wan'] { background: #fb7185; }

  .layout {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: 1fr;
    /* Anchor for the floating detail panel. */
    position: relative;
  }

  .pad {
    padding: 1rem;
  }

  /* The detail panel glides over the graph instead of shrinking it: the graph is
     the point of the page, so it keeps its full width. A click beside it lands on
     the canvas and clears the selection.

     :global, weil das Panel eine GlassCard ist - fremdes Markup, das den
     Scoping-Hash dieser Komponente nicht traegt. Ohne :global ist die Regel
     wirkungslos (so kam das Panel vorher nie an seine max-height). */
  :global(.detail) {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 5;
    width: min(21rem, calc(100% - 1.5rem));
    max-height: calc(100% - 1.5rem);
    overflow-y: auto;
    box-shadow: 0 12px 32px rgba(2, 6, 23, 0.55);
  }

  /* Ist der Graph auf den Viewport gepinnt, gehoert das Panel zu dieser Flaeche -
     sonst behaelt es seine alte Geometrie und verschwindet hinter dem Graphen.
     Beide Teile brauchen :global: die GlassCard traegt den Scoping-Hash nicht,
     und .layout wird hier ebenfalls ungescoped adressiert. */
  :global(.layout:has(.graph-host.fullscreen)) :global(.detail) {
    position: fixed;
    z-index: 60;
    top: 0.75rem;
    right: 0.75rem;
    max-height: calc(100dvh - 1.5rem);
  }

  .detail-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .detail-head h3 {
    margin: 0.1rem 0 0;
    font-size: 1.05rem;
    color: rgb(241, 245, 249);
  }

  .detail-kind {
    margin: 0;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(148, 163, 184, 0.9);
  }

  .sources {
    margin: 0.35rem 0 0.6rem;
    font-size: 0.8rem;
    color: rgba(203, 213, 225, 0.9);
  }

  .detail h4 {
    margin: 0.75rem 0 0.3rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: rgba(148, 163, 184, 0.9);
  }

  .ids,
  .links {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    color: rgb(203, 213, 225);
  }

  .ids code {
    font-size: 0.75rem;
    color: rgb(224, 242, 254);
    background: rgba(15, 23, 42, 0.6);
    padding: 0.1rem 0.35rem;
    border-radius: 0.35rem;
  }

  .attrs {
    margin: 0;
    font-size: 0.8rem;
    color: rgb(203, 213, 225);
    word-break: break-word;
  }

  .edge-kind {
    display: inline-block;
    font-size: 0.68rem;
    padding: 0.05rem 0.35rem;
    border-radius: 0.35rem;
    background: rgba(71, 85, 105, 0.4);
    color: rgb(226, 232, 240);
    margin-right: 0.25rem;
  }

  .edge-kind[data-kind='guest'] { background: rgba(100, 116, 139, 0.45); }
  .edge-kind[data-kind='runs'] { background: rgba(51, 65, 85, 0.6); }
  .edge-kind[data-kind='proxies'] { background: rgba(34, 211, 238, 0.18); color: rgb(207, 250, 254); }
  .edge-kind[data-kind='routes-to'] { background: rgba(251, 113, 133, 0.18); color: rgb(255, 228, 230); }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: rgba(148, 163, 184, 0.9);
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .line {
    width: 1.4rem;
    height: 2px;
    border-radius: 2px;
    background: #475569;
  }

  .line[data-kind='guest'] { background: #64748b; }
  .line[data-kind='runs'] { background: #475569; }
  .line[data-kind='proxies'] { background: #22d3ee; }
  .line[data-kind='routes-to'] { background: #fb7185; }
</style>
