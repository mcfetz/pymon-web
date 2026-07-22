<script>
  import { ShieldCheck } from 'lucide-svelte';
  import FilterPills from './FilterPills.svelte';
  import AlarmCard from './AlarmCard.svelte';
  import EmptyState from './EmptyState.svelte';
  import { fly } from 'svelte/transition';

  let {
    stacks = [],
    singles = [],
    onAck = () => {},
    onAckAll = () => {},
    onAckRule = () => {},
    onRule = () => {},
    onHistory = () => {},
    onSnooze = () => {},
    snoozedSet = new Set(),
    acking = new Set(),
    expandedStacks = new Set(),
    onexpand = () => {},
    severityFilter = new Set(['warning', 'critical', 'info']),
    severityCounts = {},
    onseveritychange = () => {},
    history = false,
  } = $props();

  let sevOptions = ['critical', 'warning', 'info'];
  let sevColors = { critical: '#fecaca', warning: '#fef08a', info: '#bfdbfe' };
</script>

<div class="space-y-3">
  <FilterPills
    options={sevOptions}
    selected={severityFilter}
    counts={severityCounts}
    colors={sevColors}
    onchange={onseveritychange}
  />

  {#each stacks as g (g.key)}
    <div transition:fly|local={{ y: 12, duration: 200 }}>
      <AlarmCard
        group={g}
        {onAck}
        onAckAll={onAckRule}
        {onRule}
        {onHistory}
        {onSnooze}
        snoozed={snoozedSet.has(g.key)}
        {acking}
        expanded={expandedStacks.has(g.key)}
        onexpand={() => onexpand(g.key)}
        {history}
      />
    </div>
  {/each}

  {#each singles as alarm (alarm.id)}
    <div transition:fly|local={{ y: 12, duration: 200 }}>
      <AlarmCard
        group={{ alarms: [alarm], rule_id: alarm.rule_id, agentid: alarm.agentid, pluginid: alarm.pluginid, metric: alarm.metric, key: `${alarm.rule_id}|${alarm.agentid}|${alarm.pluginid}|${alarm.metric}`, severity: alarm.severity }}
        {onAck}
        onAckAll={onAckRule}
        {onRule}
        {onHistory}
        {onSnooze}
        snoozed={snoozedSet.has(`${alarm.rule_id}|${alarm.agentid}|${alarm.pluginid}|${alarm.metric}`)}
        {acking}
        {history}
      />
    </div>
  {/each}

  {#if stacks.length === 0 && singles.length === 0}
    <EmptyState icon={ShieldCheck} message="no alarms" sub="all clear" />
  {/if}
</div>