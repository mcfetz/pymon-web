<script>
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import 'chartjs-adapter-date-fns';

  Chart.register(...registerables);

  let { data = [] } = $props();
  let canvas = $state(null);
  let chart = $state(null);
  let hidden = $state(new Set());

  const COLORS = [
    '#4361ee', '#e53e3e', '#38a169', '#dd6b20', '#805ad5',
    '#3182ce', '#d69e2e', '#e53e3e', '#00b5d8', '#6b46c1',
  ];

  // Group data by series key (agent + plugin + metric)
  function buildSeries(raw) {
    const map = {};
    for (const row of raw) {
      if (typeof row.value !== 'number') continue;
      const key = `${row.agentid} › ${row.pluginid} › ${row.metric}`;
      if (!map[key]) map[key] = [];
      map[key].push({ x: new Date(row.timestamp), y: row.value, meta: row });
    }
    // Sort each series by time
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.x - b.x);
    }
    return map;
  }

  function createChart() {
    if (!canvas || data.length === 0) return;

    const series = buildSeries(data);
    const colorIdx = {};

    const datasets = Object.entries(series).map(([label, points], i) => {
      const ci = i % COLORS.length;
      colorIdx[label] = ci;
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

    chart = new Chart(canvas, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 14,
              padding: 12,
              font: { size: 11 },
              filter: (item) => !item.hidden,
            },
            onClick: (e, legendItem, legend) => {
              const idx = legendItem.datasetIndex;
              const meta = legend.chart.getDatasetMeta(idx);
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
                const d = items[0].raw.x;
                return d.toLocaleString();
              },
              label(ctx) {
                const raw = ctx.raw.meta;
                if (!raw) return ctx.parsed.y.toString();
                const lines = [
                  `Wert: ${raw.value}`,
                  `Agent: ${raw.agentid}`,
                  `Plugin: ${raw.pluginid}`,
                  `Metrik: ${raw.metric}`,
                ];
                return lines;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                minute: 'HH:mm',
                hour: 'HH:mm',
                day: 'dd.MM',
              },
            },
            title: { display: true, text: 'Zeit' },
          },
          y: {
            beginAtZero: false,
            title: { display: true, text: 'Wert' },
          },
        },
      },
    });
  }

  function destroyChart() {
    if (chart) { chart.destroy(); chart = null; }
  }

  $effect(() => {
    // React to data changes
    data;
    destroyChart();
    if (canvas && data.length > 0) {
      setTimeout(() => createChart(), 50);
    }
  });

  onDestroy(destroyChart);
</script>

<div class="chart-wrap">
  {#if data.length === 0}
    <div class="chart-empty">Keine numerischen Metriken für das Diagramm</div>
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
    min-height: 300px;
    position: relative;
  }
  .chart-empty {
    text-align: center;
    padding: 3rem;
    color: #aaa;
    font-style: italic;
  }
</style>
