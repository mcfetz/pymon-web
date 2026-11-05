<script>
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import 'chartjs-adapter-date-fns';
  import annotationPlugin from 'chartjs-plugin-annotation';

  Chart.register(...registerables, annotationPlugin);

  let { data = [], height = 350, onPointClick = () => {} } = $props();
  let canvas = $state(null);
  let chart = null;
  let hidden = new Set();

  // A 200px card cannot carry the stroke weight of a full height chart: five
  // series at 3px points is ~600 dots on a thumbnail, and the dots drown the
  // lines. Height is the signal because the full screen view passes "100%",
  // a string, and therefore stays at full weight automatically.
  const compact = typeof height === 'number' && height <= 260;

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
      const key = `${row.agent_title || row.agentid} › ${row.plugin_title || row.pluginid} › ${row.metric}`;
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
    const annotations = {};
    [...new Set(data.filter(r => r.alarm_id != null && typeof r.value === 'number').map(r => r.timestamp))]
      .forEach((ts, i) => {
        annotations[`alarm_${i}`] = {
          type: 'line',
          xMin: parseTimestamp(ts),
          xMax: parseTimestamp(ts),
          borderColor: '#e53e3e',
          borderWidth: 1.5,
          borderDash: [6, 4],
          label: { display: true, content: '⚠', position: 'start', yAdjust: -8, font: { size: 11 } },
        };
      });
    data
      .filter(r => r.note_id != null && typeof r.value === 'number')
      .forEach((row) => {
        const timestamp = parseTimestamp(row.timestamp);
        annotations[`note_line_${row.note_id}`] = {
          type: 'line',
          xMin: timestamp,
          xMax: timestamp,
          borderColor: 'rgba(245,158,11,0.5)',
          borderWidth: 1,
          borderDash: [3, 3],
        };
        annotations[`note_point_${row.note_id}`] = {
          type: 'point',
          xValue: timestamp,
          yValue: row.value,
          radius: compact ? 3.5 : 4.5,
          backgroundColor: '#f59e0b',
          borderColor: '#fff',
          borderWidth: 1.5,
          label: {
            display: true,
            content: '📝',
            position: 'top',
            yAdjust: compact ? -7 : -11,
            color: '#b45309',
            font: { size: compact ? 9 : 11 },
          },
        };
      });

    const datasets = Object.entries(series).map(([label, points], i) => {
      const ci = i % COLORS.length;
      return {
        label,
        data: points,
        borderColor: COLORS[ci],
        backgroundColor: COLORS[ci] + '33',
        fill: false,
        borderWidth: compact ? 1 : 1.75,
        // No static points when compact: the line is the signal, the dots are
        // only noise. They come back on hover via pointHitRadius.
        pointRadius: compact ? 0 : 2.5,
        pointHoverRadius: compact ? 3.5 : 5,
        pointBorderWidth: 0,
        pointHitRadius: compact ? 8 : 10,
        tension: compact ? 0 : 0.1,
        borderCapStyle: 'round',
        borderJoinStyle: 'round',
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
          // With pointRadius 0 an intersect-based hover has nothing to hit, so
          // the compact variant picks the nearest point by proximity instead.
          interaction: { mode: 'nearest', intersect: !compact },
          onClick: (event, _elements, chartInstance) => {
            const area = chartInstance.chartArea;
            if (
              area &&
              (event.x < area.left || event.x > area.right ||
               event.y < area.top || event.y > area.bottom)
            ) return;
            const points = chartInstance.getElementsAtEventForMode(
              event, 'nearest', { intersect: !compact }, true
            );
            if (!points.length) return;
            const point = points[0];
            const element = point.element;
            if (!element) return;
            const distance = Math.hypot(event.x - element.x, event.y - element.y);
            if (distance > (compact ? 24 : 18)) return;
            const dataset = chartInstance.data.datasets[point.datasetIndex];
            const raw = dataset?.data?.[point.index]?.meta;
            if (raw) onPointClick(raw);
          },
          onHover: (event, elements) => {
            if (canvas) canvas.style.cursor = elements.length ? 'pointer' : 'default';
          },
          plugins: {
            annotation: {
              annotations,
            },
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: compact ? 10 : 14,
                boxHeight: compact ? 8 : 10,
                padding: compact ? 8 : 12,
                font: { size: compact ? 10 : 11 },
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
                  const lines = [
                    `Value: ${raw.value}`,
                    `Agent: ${raw.agent_title || raw.agentid}`,
                    `Plugin: ${raw.plugin_title || raw.pluginid}`,
                    `Metric: ${raw.metric}`,
                  ];
                  if (raw.note) {
                    const text = raw.note.length > 120 ? `${raw.note.slice(0, 120)}…` : raw.note;
                    lines.push(`Note: ${text}`);
                    if (raw.note_by) lines.push(`Note by: ${raw.note_by}`);
                  }
                  return lines;
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
              grid: { display: !compact },
              ticks: { font: { size: compact ? 9 : 11 }, maxRotation: 0, autoSkipPadding: 12 },
              // Axis titles cost vertical space a 200px chart cannot spare.
              title: { display: !compact, text: 'Time' },
            },
            y: {
              beginAtZero: false,
              grid: { display: !compact },
              ticks: { font: { size: compact ? 9 : 11 }, maxTicksLimit: compact ? 4 : 8 },
              title: { display: !compact, text: 'Value' },
            },
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

<div class="chart-wrap" style="height: {typeof height === 'number' ? `${height}px` : height};">
  {#if data.length === 0}
    <div class="chart-empty">No numeric metrics for chart</div>
  {:else}
    <canvas bind:this={canvas}></canvas>
  {/if}
</div>

<style>
  .chart-wrap { position: relative; }
  .chart-empty { text-align: center; padding: 3rem; font-style: italic; }
</style>