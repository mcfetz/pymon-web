<script>
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import 'chartjs-adapter-date-fns';
  import annotationPlugin from 'chartjs-plugin-annotation';

  Chart.register(...registerables, annotationPlugin);

  let { data = [] } = $props();
  let canvas = $state(null);
  let chart = null;
  let hidden = new Set();

  const COLORS = [
    '#4361ee', '#e53e3e', '#38a169', '#dd6b20', '#805ad5',
    '#3182ce', '#d69e2e', '#00b5d8', '#6b46c1',
  ];

  function parseTimestamp(ts) {
    const s = /Z|[+-]\d{2}:\d{2}$/.test(ts) ? ts : ts + 'Z';
    return new Date(s);
  }

  function buildSeries(raw) {
    const map = {};
    for (const row of raw) {
      if (typeof row.value !== 'number') continue;
      const key = `${row.agentid} › ${row.pluginid} › ${row.metric}`;
      if (!map[key]) map[key] = [];
      map[key].push({ x: parseTimestamp(row.timestamp), y: row.value, meta: row });
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.x - b.x);
    }
    return map;
  }

  function render() {
    destroyChart();
    if (!canvas || data.length === 0) return;

    const series = buildSeries(data);
    const datasets = Object.entries(series).map(([label, points], i) => {
      const ci = i % COLORS.length;
      return {
        label,
        data: points,
        borderColor: COLORS[ci],
        backgroundColor: COLORS[ci] + '33',
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
        tension: 0.1,
        hidden: hidden.has(label),
      };
    });

    if (datasets.length === 0) return;

    try {
      chart = new Chart(canvas, {
        type: 'line',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          locale: navigator.language,
          interaction: { mode: 'nearest', axis: 'x', intersect: false },
          plugins: {
            annotation: {
              annotations: Object.fromEntries(
                [...new Set(data.filter(r => r.alarm_id != null && typeof r.value === 'number').map(r => r.timestamp))]
                  .map((ts, i) => [`alarm_${i}`, {
                    type: 'line',
                    xMin: ts,
                    xMax: ts,
                    borderColor: '#e53e3e',
                    borderWidth: 1.5,
                    borderDash: [6, 4],
                    label: { display: true, content: '⚠', position: 'start', yAdjust: -8, font: { size: 11 } },
                  }])
              ),
            },
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 14, padding: 12, font: { size: 11 },
                filter: (item) => !item.hidden,
              },
              onClick: (e, legendItem, legend) => {
                const meta = legend.chart.getDatasetMeta(legendItem.datasetIndex);
                meta.hidden = !meta.hidden;
                if (meta.hidden) hidden.add(legendItem.text);
                else hidden.delete(legendItem.text);
                legend.chart.update();
              },
            },
            tooltip: {
              callbacks: {
                title(items) {
                  if (!items.length) return '';
                  return items[0].raw.x.toLocaleString();
                },
                label(ctx) {
                  const raw = ctx.raw.meta;
                  if (!raw) return ctx.parsed.y.toString();
                  return [
                    `Value: ${raw.value}`,
                    `Agent: ${raw.agentid}`,
                    `Plugin: ${raw.pluginid}`,
                    `Metric: ${raw.metric}`,
                  ];
                },
              },
            },
          },
          scales: {
            x: {
              type: 'time',
              time: {
                displayFormats: { minute: 'HH:mm', hour: 'HH:mm', day: 'dd.MM' },
              },
              title: { display: true, text: 'Time' },
            },
            y: { beginAtZero: false, title: { display: true, text: 'Value' } },
          },
        },
      });
    } catch (e) {
      console.error('Chart error:', e);
    }
  }

  function destroyChart() {
    if (chart) { chart.destroy(); chart = null; }
  }

  onMount(() => {
    if (canvas && data.length > 0) render();
  });

  $effect(() => {
    if (data.length > 0 && canvas) render();
    else destroyChart();
  });

  onDestroy(destroyChart);
</script>

<div class="chart-wrap" style="height: 350px;">
  {#if data.length === 0}
    <div class="chart-empty">No numeric metrics for chart</div>
  {:else}
    <canvas bind:this={canvas}></canvas>
  {/if}
</div>

<style>
  .chart-wrap {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.75rem;
    margin-bottom: 1rem;
    position: relative;
  }
  .chart-empty {
    text-align: center; padding: 3rem; color: #aaa; font-style: italic;
  }
</style>