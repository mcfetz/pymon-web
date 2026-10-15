<script>
  import ShieldCheck from 'lucide-svelte/icons/shield-check';
  import BellOff from 'lucide-svelte/icons/bell-off';
  import Search from 'lucide-svelte/icons/search';
  import X from 'lucide-svelte/icons/x';
  import FilterPills from './FilterPills.svelte';
  import AlarmCard from './AlarmCard.svelte';
  import DaySeparator from './DaySeparator.svelte';
  import EmptyState from './EmptyState.svelte';
  import { SEVERITY_ICONS, SEVERITY_COLORS } from '../severity.js';
  import { dayKey, daySectionLabel } from '../metricsUtils.js';
  import { fly } from 'svelte/transition';

  let {
    stacks = [],
    singles = [],
    merged = null,
    onAck = () => {},
    onAckAll = () => {},
    onAckRule = () => {},
    onRule = () => {},
    onHistory = () => {},
    onSnooze = () => {},
    onDetail = () => {},
    ruleTitleMap = {},
    agentTitleMap = {},
    pluginLabelMap = {},
    snoozedSet = new Set(),
    acking = new Set(),
    expandedStacks = new Set(),
    onexpand = () => {},
    severityFilter = new Set(['warning', 'critical', 'info']),
    severityCounts = {},
    onseveritychange = () => {},
    history = false,
    truncated = false,
    filterable = false,
  } = $props();

  let sevOptions = $derived(history ? ['critical', 'warning', 'info'] : ['critical', 'warning', 'info', 'snoozed']);
  let sevIcons = {
    critical: { icon: SEVERITY_ICONS.critical, color: SEVERITY_COLORS.critical },
    warning: { icon: SEVERITY_ICONS.warning, color: SEVERITY_COLORS.warning },
    info: { icon: SEVERITY_ICONS.info, color: SEVERITY_COLORS.info },
    snoozed: { icon: BellOff, color: '#eab308' },
  };

  // ── Live text filter over the open list ──
  // Matches the human-readable rule/agent/plugin names (falling back to their
  // ids) plus the metric, so "cpu docker12" narrows to that agent's cpu alarms.
  // Every whitespace-separated term must match somewhere (AND).
  let query = $state('');
  let terms = $derived(query.trim().toLowerCase().split(/\s+/).filter(Boolean));
  let filterActive = $derived(terms.length > 0);

  function alarmHaystack(g) {
    return [
      ruleTitleMap[g?.rule_id] || '', g?.rule_id || '',
      agentTitleMap[g?.agentid] || '', g?.agentid || '',
      pluginLabelMap[g?.pluginid] || '', g?.pluginid || '',
      g?.metric || '',
    ].join(' ').toLowerCase();
  }

  function matchesQuery(g) {
    if (terms.length === 0) return true;
    const haystack = alarmHaystack(g);
    return terms.every((term) => haystack.includes(term));
  }

  let matchedMerged = $derived.by(() => (merged ? merged.filter(matchesQuery) : null));
  let matchedStacks = $derived.by(() => (merged ? [] : stacks.filter(matchesQuery)));
  let matchedSingles = $derived.by(() => (merged ? [] : singles.filter(matchesQuery)));

  let totalGroups = $derived(merged ? merged.length : stacks.length + singles.length);
  let visibleGroups = $derived(merged ? matchedMerged.length : matchedStacks.length + matchedSingles.length);

  // Interleave day separators into the sorted group list (history view only).
  // A group is filed under the day of its newest alarm — the timestamp the card
  // shows — and a day yields exactly one separator even with severity gaps.
  let mergedItems = $derived.by(() => {
    const items = [];
    let lastDay = null;
    for (const g of matchedMerged || []) {
      if (history) {
        const ts = g.alarms?.[0]?.created_at;
        const key = dayKey(ts);
        if (key && key !== lastDay) {
          lastDay = key;
          items.push({ type: 'day', key: `day_${key}`, label: daySectionLabel(ts) });
        }
      }
      items.push({ type: 'group', key: g.key, group: g });
    }
    return items;
  });
</script>

<div class="space-y-3">
  <FilterPills
    options={sevOptions}
    selected={severityFilter}
    counts={severityCounts}
    icons={sevIcons}
    onchange={onseveritychange}
  />
  {#if filterable}
    <div class="relative">
      <Search
        size={12}
        strokeWidth={2}
        style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-secondary);pointer-events:none;"
      />
      <input
        type="text"
        placeholder="filter rules, agents, plugins, metrics…"
        bind:value={query}
        aria-label="filter alarms"
        class="w-full pl-7 pr-7 py-1.5 rounded-lg border text-xs bg-transparent outline-none"
        style="border-color: var(--border-default); color: var(--text-primary);"
      />
      {#if query}
        <button
          type="button"
          onclick={() => (query = '')}
          title="clear filter"
          aria-label="clear filter"
          class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded cursor-pointer hover:brightness-125 transition-all"
          style="color: var(--text-secondary);"
        >
          <X size={11} strokeWidth={2} />
        </button>
      {/if}
    </div>
    {#if filterActive}
      <div class="flex items-center gap-1.5 text-[10px] px-1" style="color: var(--text-secondary);">
        <span class="tabular-nums">{visibleGroups} of {totalGroups}</span>
        <span>alarm groups</span>
        <button
          type="button"
          onclick={() => (query = '')}
          class="ml-auto underline cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
        >reset</button>
      </div>
    {/if}
  {/if}
  {#if truncated}
    <div class="text-xs px-3 py-1.5 rounded-lg" style="background:rgba(var(--color-primary-rgb),0.08);color:var(--color-primary)">Showing 500 alarms — there may be more.</div>
  {/if}

  {#if merged}
    {#each mergedItems as item (item.key)}
      {#if item.type === 'day'}
        <DaySeparator label={item.label} />
      {:else}
      {@const g = item.group}
      <div transition:fly|local={{ y: 12, duration: 200 }}>
        {#if g.alarms?.length > 1}
          <AlarmCard
            group={g}
            {onAck}
            onAckAll={onAckRule}
            {onRule}
            {onHistory}
            {onSnooze}
            {onDetail}
            {ruleTitleMap}
            {agentTitleMap}
            {pluginLabelMap}
            snoozed={snoozedSet.has(g.key)}
            {acking}
            expanded={expandedStacks.has(g.key)}
            onexpand={() => onexpand(g.key)}
            {history}
          />
        {:else}
          {@const alarm = g.alarms[0]}
          <AlarmCard
            group={{ alarms: [alarm], rule_id: alarm.rule_id, agentid: alarm.agentid, pluginid: alarm.pluginid, metric: alarm.metric, key: `${alarm.rule_id}|${alarm.agentid}|${alarm.pluginid}|${alarm.metric}`, severity: alarm.severity }}
            {onAck}
            onAckAll={onAckRule}
            {onRule}
            {onHistory}
            {onSnooze}
            {onDetail}
            {ruleTitleMap}
            {agentTitleMap}
            {pluginLabelMap}
            snoozed={snoozedSet.has(`${alarm.rule_id}|${alarm.agentid}|${alarm.pluginid}|${alarm.metric}`)}
            {acking}
            {history}
          />
        {/if}
      </div>
      {/if}
    {/each}
    {#if matchedMerged.length === 0}
      <EmptyState
        icon={ShieldCheck}
        message={filterActive ? 'no matches' : 'no alarms'}
        sub={filterActive ? 'adjust the filter' : 'all clear'}
      />
    {/if}
  {:else}
  {#each matchedStacks as g (g.key)}
    <div transition:fly|local={{ y: 12, duration: 200 }}>
      <AlarmCard
        group={g}
        {onAck}
        onAckAll={onAckRule}
        {onRule}
        {onHistory}
        {onSnooze}
        {onDetail}
        {ruleTitleMap}
        {agentTitleMap}
        {pluginLabelMap}
        snoozed={snoozedSet.has(g.key)}
        {acking}
        expanded={expandedStacks.has(g.key)}
        onexpand={() => onexpand(g.key)}
        {history}
      />
    </div>
  {/each}

  {#each matchedSingles as alarm (alarm.id)}
    <div transition:fly|local={{ y: 12, duration: 200 }}>
      <AlarmCard
        group={{ alarms: [alarm], rule_id: alarm.rule_id, agentid: alarm.agentid, pluginid: alarm.pluginid, metric: alarm.metric, key: `${alarm.rule_id}|${alarm.agentid}|${alarm.pluginid}|${alarm.metric}`, severity: alarm.severity }}
        {onAck}
        onAckAll={onAckRule}
        {onRule}
        {onHistory}
        {onSnooze}
        {onDetail}
        {ruleTitleMap}
        {agentTitleMap}
        {pluginLabelMap}
        snoozed={snoozedSet.has(`${alarm.rule_id}|${alarm.agentid}|${alarm.pluginid}|${alarm.metric}`)}
        {acking}
        {history}
      />
    </div>
  {/each}

  {#if matchedStacks.length === 0 && matchedSingles.length === 0}
    <EmptyState
      icon={ShieldCheck}
      message={filterActive ? 'no matches' : 'no alarms'}
      sub={filterActive ? 'adjust the filter' : 'all clear'}
    />
  {/if}
  {/if}
</div>