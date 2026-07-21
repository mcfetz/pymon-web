<script>
  import { onMount } from 'svelte';
  import { fetchAlarms, acknowledgeAlarm } from './lib/api.js';

  let openAlarms = $state([]);
  let historyAlarms = $state([]);
  let loading = $state(true);
  let error = $state(null);
  let acking = $state(new Set());

  async function load() {
    loading = true;
    error = null;
    try {
      const [open, hist] = await Promise.all([
        fetchAlarms(false),
        fetchAlarms(true),
      ]);
      openAlarms = open;
      historyAlarms = hist;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function ack(id) {
    acking.add(id);
    try {
      await acknowledgeAlarm(id);
      await load();
    } catch (e) {
      error = e.message;
    } finally {
      acking.delete(id);
    }
  }

  function severityClass(s) {
    if (s === 'critical') return 'sev-critical';
    if (s === 'warning') return 'sev-warning';
    return 'sev-info';
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString();
  }

  onMount(load);
</script>

<main>
  <header>
    <h1>pymon</h1>
    <p class="subtitle">Monitoring Dashboard</p>
    <button class="refresh" onclick={load} disabled={loading}>
      {loading ? 'Laden...' : '⟳ Aktualisieren'}
    </button>
  </header>

  {#if error}
    <div class="error-banner">Fehler: {error}</div>
  {/if}

  {#if loading && openAlarms.length === 0}
    <section class="loading">Daten werden geladen...</section>
  {:else}
    <section class="alarms-section">
      <h2>Offene Alarme ({openAlarms.length})</h2>
      {#if openAlarms.length === 0}
        <div class="empty">Keine offenen Alarme</div>
      {:else}
        <div class="alarm-list">
          {#each openAlarms as alarm (alarm.id)}
            <div class="alarm-card {severityClass(alarm.severity)}">
              <div class="alarm-header">
                <span class="severity-badge">{alarm.severity}</span>
                <span class="rule-id">{alarm.rule_id}</span>
                <span class="timestamp">{fmtTime(alarm.created_at)}</span>
              </div>
              <div class="alarm-body">
                <span class="agent">Agent: {alarm.agentid}</span>
                <span class="plugin">Plugin: {alarm.pluginid}</span>
                <span class="metric">Metrik: {alarm.metric}</span>
                {#if alarm.value !== null}
                  <span class="value">Wert: {alarm.value}</span>
                {/if}
              </div>
              <div class="alarm-message">{alarm.message}</div>
              <button
                class="ack-btn"
                onclick={() => ack(alarm.id)}
                disabled={acking.has(alarm.id)}
              >
                {acking.has(alarm.id) ? 'Bestätige...' : '✓ Bestätigen'}
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="alarms-section">
      <h2>Verlauf ({historyAlarms.length})</h2>
      {#if historyAlarms.length === 0}
        <div class="empty">Keine historischen Alarme</div>
      {:else}
        <div class="alarm-list">
          {#each historyAlarms as alarm (alarm.id)}
            <div class="alarm-card {severityClass(alarm.severity)}">
              <div class="alarm-header">
                <span class="severity-badge">{alarm.severity}</span>
                <span class="rule-id">{alarm.rule_id}</span>
                <span class="timestamp">{fmtTime(alarm.created_at)}</span>
              </div>
              <div class="alarm-body">
                <span class="agent">Agent: {alarm.agentid}</span>
                <span class="plugin">Plugin: {alarm.pluginid}</span>
                <span class="metric">Metrik: {alarm.metric}</span>
                {#if alarm.value !== null}
                  <span class="value">Wert: {alarm.value}</span>
                {/if}
              </div>
              <div class="alarm-message">{alarm.message}</div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1a1a2e;
  }

  header {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  header h1 {
    margin: 0;
    font-size: 1.8rem;
    font-weight: 700;
  }

  .subtitle {
    margin: 0;
    color: #666;
    font-size: 0.95rem;
  }

  .refresh {
    margin-left: auto;
    background: #4361ee;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.4rem 1rem;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .refresh:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-banner {
    background: #fde8e8;
    color: #c53030;
    border: 1px solid #f5c6c6;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #888;
  }

  .alarms-section {
    margin-bottom: 2rem;
  }

  .alarms-section h2 {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0 0 0.75rem 0;
    padding-bottom: 0.4rem;
    border-bottom: 2px solid #e2e8f0;
  }

  .empty {
    text-align: center;
    padding: 2rem;
    color: #aaa;
    font-style: italic;
  }

  .alarm-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .alarm-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .alarm-card.sev-critical { border-left: 4px solid #e53e3e; }
  .alarm-card.sev-warning  { border-left: 4px solid #dd6b20; }
  .alarm-card.sev-info     { border-left: 4px solid #3182ce; }

  .alarm-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.3rem;
  }

  .severity-badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    background: #edf2f7;
  }

  .sev-critical .severity-badge { background: #fed7d7; color: #c53030; }
  .sev-warning .severity-badge  { background: #feebc8; color: #c05621; }
  .sev-info .severity-badge     { background: #bee3f8; color: #2b6cb0; }

  .rule-id {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .timestamp {
    margin-left: auto;
    font-size: 0.78rem;
    color: #888;
  }

  .alarm-body {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem;
    font-size: 0.82rem;
    color: #555;
    margin-bottom: 0.3rem;
  }

  .alarm-message {
    font-size: 0.8rem;
    color: #777;
    margin-bottom: 0.5rem;
    word-break: break-word;
  }

  .ack-btn {
    background: #38a169;
    color: #fff;
    border: none;
    border-radius: 5px;
    padding: 0.3rem 0.8rem;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .ack-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

</style>
