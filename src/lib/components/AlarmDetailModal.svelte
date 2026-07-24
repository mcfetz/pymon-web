<script>
  import { AlertTriangle, AlertCircle, Info, X, Copy, Check, ExternalLink } from 'lucide-svelte';
  import { fetchAlarm, acknowledgeAlarm } from '../api.js';

  let { alarmId = null, onClose = () => {}, onAcked = () => {} } = $props();

  let alarm   = $state(null);
  let loading = $state(false);
  let error   = $state(null);
  let acking  = $state(false);
  let copied  = $state(false);

  const SEV_COLOR = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
  const SEV_ICON  = { critical: AlertCircle, warning: AlertTriangle, info: Info };
  const COND_LABEL = { gt: '>', ge: '≥', lt: '<', le: '≤', eq: '=', ne: '≠' };

  $effect(() => {
    if (alarmId != null) load(alarmId);
  });

  async function load(id) {
    loading = true; error = null; alarm = null;
    try { alarm = await fetchAlarm(id); }
    catch (e) { error = e.message; }
    finally { loading = false; }
  }

  async function handleAck() {
    if (!alarm || alarm.acknowledged || acking) return;
    acking = true;
    try {
      await acknowledgeAlarm(alarm.id);
      alarm = { ...alarm, acknowledged: true };
      onAcked(alarm.id);
    } catch (e) { error = e.message; }
    finally { acking = false; }
  }

  function copyLink() {
    const url = `${window.location.origin}/#alarm/${alarmId}`;
    navigator.clipboard.writeText(url).then(() => {
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    }).catch(() => {});
  }

  function fmt(iso) {
    if (!iso) return '—';
    const s = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
    return new Date(s).toLocaleString();
  }

  function fmtRel(iso) {
    if (!iso) return '';
    const s = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
    const sec = (Date.now() - new Date(s).getTime()) / 1000;
    if (sec < 60)    return `${Math.round(sec)}s ago`;
    if (sec < 3600)  return `${Math.round(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
    return `${Math.round(sec / 86400)}d ago`;
  }

  function sparklinePath(data, w = 260, h = 44) {
    if (!data || data.length < 2) return { path: '', min: 0, max: 0 };
    const vals = data.map(d => d.value).filter(v => v != null && !isNaN(v));
    if (vals.length < 2) return { path: '', min: 0, max: 0 };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { path: `M${pts.join('L')}`, min, max };
  }

  let sparkline = $derived(sparklinePath(alarm?.metric_history));
  let sev = $derived(alarm?.severity || 'warning');

  function conditionSummary(rule) {
    if (!rule) return '';
    const cond = COND_LABEL[rule.condition] || rule.condition;
    return `${rule.metric} ${cond} ${rule.threshold}`;
  }

  function overlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<!-- Overlay -->
<div
  class="dialog-overlay"
  role="dialog"
  aria-modal="true"
  onclick={overlayClick}
  onkeydown={(e) => e.key === 'Escape' && onClose()}
  tabindex="-1"
>
  <div class="dialog" style="max-width:540px">
    <!-- Header -->
    <div class="dialog-header" style="border-bottom:1px solid var(--border-default);display:flex;align-items:center;gap:0.5rem;padding:0.85rem 1rem 0.75rem">
      {#if alarm}
        <svelte:component this={SEV_ICON[sev] || Info} size={16} strokeWidth={2} style="color:{SEV_COLOR[sev]};flex-shrink:0" />
        <span class="font-semibold text-sm" style="color:var(--text-primary)">Alarm #{alarm.id}</span>
        <span class="text-xs px-2 py-0.5 rounded-full font-medium" style="background:rgba({sev==='critical'?'239,68,68':sev==='warning'?'245,158,11':'59,130,246'},0.12);color:{SEV_COLOR[sev]}">
          {sev}
        </span>
        {#if alarm.acknowledged}
          <span class="text-xs px-2 py-0.5 rounded-full" style="background:rgba(34,197,94,0.1);color:#22c55e">acknowledged</span>
        {:else}
          <span class="text-xs px-2 py-0.5 rounded-full" style="background:rgba(245,158,11,0.1);color:#f59e0b">open</span>
        {/if}
      {:else}
        <span class="font-semibold text-sm" style="color:var(--text-primary)">Alarm #{alarmId}</span>
      {/if}
      <div style="margin-left:auto;display:flex;gap:0.4rem;align-items:center">
        <button
          onclick={copyLink}
          class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:brightness-110"
          style="background:rgba(var(--color-primary-rgb),0.1);color:var(--color-primary)"
          title="Copy direct link"
        >
          {#if copied}
            <Check size={12} /><span>Copied</span>
          {:else}
            <Copy size={12} /><span>Copy link</span>
          {/if}
        </button>
        <button onclick={onClose} class="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" title="Close">
          <X size={16} style="color:var(--text-secondary)" />
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="dialog-body" style="padding:1rem;overflow-y:auto;max-height:calc(100vh - 10rem - env(safe-area-inset-bottom,0px))">
      {#if loading}
        <div class="text-sm text-center py-8" style="color:var(--text-secondary)">Loading...</div>
      {:else if error}
        <div class="text-sm px-3 py-2 rounded-lg" style="background:rgba(239,68,68,0.08);color:#ef4444">{error}</div>
      {:else if alarm}

        <!-- Rule summary -->
        <div class="rounded-xl p-3 mb-3" style="background:rgba(var(--color-primary-rgb),0.06);border:1px solid rgba(var(--color-primary-rgb),0.12)">
          <div class="flex items-baseline gap-2 mb-1">
            <span class="text-xs font-semibold font-mono" style="color:var(--color-primary)">{alarm.rule_id}</span>
          </div>
          {#if alarm.rule?.description}
            <div class="text-xs mb-2" style="color:var(--text-secondary)">{alarm.rule.description}</div>
          {/if}
          <div class="flex flex-wrap gap-2 text-[11px]" style="color:var(--text-secondary)">
            <span class="px-1.5 py-0.5 rounded" style="background:var(--bg-app)">{conditionSummary(alarm.rule)}</span>
            {#if alarm.rule?.scope}<span class="px-1.5 py-0.5 rounded" style="background:var(--bg-app)">scope: {alarm.rule.scope}</span>{/if}
            {#if alarm.rule?.fire}<span class="px-1.5 py-0.5 rounded" style="background:var(--bg-app)">fire: {alarm.rule.fire}</span>{/if}
            {#if alarm.rule?.window_size}<span class="px-1.5 py-0.5 rounded" style="background:var(--bg-app)">window: {alarm.rule.window_size}</span>{/if}
          </div>
        </div>

        <!-- Key details grid -->
        <div class="rounded-xl overflow-hidden mb-3" style="border:1px solid var(--border-default)">
          {#each [
            ['Agent',   `${alarm.agent?.title || alarm.agentid}${alarm.agent?.title && alarm.agent.title !== alarm.agentid ? ' ('+alarm.agentid+')' : ''}`],
            ['Plugin',  alarm.pluginid],
            ['Metric',  alarm.metric],
            ['Value',   alarm.value != null ? String(alarm.value) : '—'],
            ['Fired',   `${fmt(alarm.created_at)}  ·  ${fmtRel(alarm.created_at)}`],
          ] as [label, val], i}
            <div class="flex text-[12px]" style="border-bottom:{i < 4 ? '1px solid var(--border-default)' : 'none'}">
              <div class="w-20 px-3 py-2 font-medium flex-shrink-0" style="color:var(--text-secondary);background:rgba(0,0,0,0.02)">{label}</div>
              <div class="px-3 py-2 font-mono" style="color:var(--text-primary);word-break:break-all">{val}</div>
            </div>
          {/each}
        </div>

        <!-- Metric sparkline -->
        {#if alarm.metric_history?.length >= 2}
          <div class="mb-3">
            <div class="text-[11px] font-medium mb-1.5" style="color:var(--text-secondary)">Metric history (last {alarm.metric_history.length} values)</div>
            <div class="rounded-xl px-3 py-2" style="background:rgba(0,0,0,0.03);border:1px solid var(--border-default)">
              <div class="flex justify-between text-[10px] mb-1" style="color:var(--text-secondary)">
                <span>{sparkline.max?.toFixed ? sparkline.max.toFixed(1) : sparkline.max}</span>
                <span>{sparkline.min?.toFixed ? sparkline.min.toFixed(1) : sparkline.min}</span>
              </div>
              <svg viewBox="0 0 260 44" width="100%" height="44" preserveAspectRatio="none">
                <!-- Alarm value line -->
                {#if alarm.value != null && sparkline.max !== sparkline.min}
                  {@const lineY = 44 - ((alarm.value - sparkline.min) / (sparkline.max - sparkline.min)) * (44 - 6) - 3}
                  <line x1="0" y1={lineY} x2="260" y2={lineY} stroke={SEV_COLOR[sev]} stroke-width="0.8" stroke-dasharray="4,3" opacity="0.5" />
                {/if}
                <!-- Sparkline path -->
                {#if sparkline.path}
                  <path d={sparkline.path} fill="none" stroke="var(--color-primary)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
                {/if}
              </svg>
              <div class="flex justify-between text-[10px] mt-1" style="color:var(--text-secondary)">
                <span>{fmt(alarm.metric_history[0]?.timestamp).split(',')[0]}</span>
                <span>now</span>
              </div>
            </div>
          </div>
        {/if}

        <!-- Surrounding alarms timeline -->
        {#if alarm.surrounding?.length > 0 || alarm.total_same_type > 1}
          <div class="mb-1">
            <div class="text-[11px] font-medium mb-1.5" style="color:var(--text-secondary)">
              Same alarm type · {alarm.total_same_type} total
            </div>
            <div class="rounded-xl overflow-hidden" style="border:1px solid var(--border-default)">
              {#each [...alarm.surrounding.filter(a => a.id < alarm.id).slice(-5), alarm, ...alarm.surrounding.filter(a => a.id > alarm.id).slice(0,5)] as a}
                {@const isCurrent = a.id === alarm.id}
                <div
                  class="flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors"
                  style="
                    background:{isCurrent ? 'rgba(var(--color-primary-rgb),0.08)' : 'transparent'};
                    border-bottom:1px solid var(--border-default);
                    cursor:{isCurrent ? 'default' : 'pointer'}
                  "
                  onclick={() => !isCurrent && (window.location.hash = `#alarm/${a.id}`)}
                  role={isCurrent ? 'none' : 'button'}
                  tabindex={isCurrent ? -1 : 0}
                  onkeydown={(e) => !isCurrent && e.key === 'Enter' && (window.location.hash = `#alarm/${a.id}`)}
                >
                  <span class="font-mono w-12 flex-shrink-0" style="color:{isCurrent ? 'var(--color-primary)' : 'var(--text-secondary)'}">#{ a.id}</span>
                  <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{a.acknowledged ? '#22c55e' : SEV_COLOR[a.severity]}"></span>
                  <span class="font-mono flex-1" style="color:var(--text-primary)">{a.value != null ? a.value : '—'}</span>
                  <span style="color:var(--text-secondary)">{fmt(a.created_at)}</span>
                  {#if a.acknowledged}
                    <span style="color:#22c55e">✓</span>
                  {/if}
                  {#if isCurrent}
                    <span class="text-[10px] font-semibold" style="color:var(--color-primary)">← this</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

      {/if}
    </div>

    <!-- Footer -->
    <div class="dialog-footer" style="padding:0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom,0px));border-top:1px solid var(--border-default);display:flex;justify-content:flex-end;gap:0.5rem">
      {#if alarm && !alarm.acknowledged}
        <button
          onclick={handleAck}
          disabled={acking}
          class="px-4 py-1.5 rounded-xl text-sm font-medium transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
          style="background:rgba(34,197,94,0.12);color:#22c55e"
        >{acking ? 'Acknowledging...' : 'Acknowledge'}</button>
      {/if}
      <button
        onclick={onClose}
        class="px-4 py-1.5 rounded-xl text-sm font-medium transition-all hover:brightness-110 active:scale-95"
        style="background:var(--bg-app);color:var(--text-secondary);border:1px solid var(--border-default)"
      >Close</button>
    </div>
  </div>
</div>

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.5);
    touch-action: none;
    overscroll-behavior: none;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: max(1.5rem, env(safe-area-inset-top, 0px) + 1.5rem);
  }
  .dialog {
    position: relative;
    z-index: 51;
    background: #fff;
    border: 1px solid var(--border-default, #e2e8f0);
    border-radius: var(--radius-card, 12px);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
    width: calc(100vw - 2rem);
    max-height: calc(100vh - max(3rem, env(safe-area-inset-top, 0px) + 2rem) - env(safe-area-inset-bottom, 0px));
    overflow: hidden;
    display: flex;
    flex-direction: column;
    overscroll-behavior: contain;
  }
  :global(.dark) .dialog {
    background: #0f172a;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  }
  .dialog-body {
    overflow-y: auto;
    overscroll-behavior: contain;
  }
</style>
