<script>
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import 'chartjs-adapter-date-fns';
  import annotationPlugin from 'chartjs-plugin-annotation';
  import { fmtVal, fmtTime } from './metricsUtils.js';

  Chart.register(...registerables, annotationPlugin);

  let { data = [], height = 350, onNoteRequest = null } = $props();
  let canvas = $state(null);
  let wrap = $state(null);
  let chart = null;
  let hidden = new Set();
  let tooltipVisible = $state(false);
  let tooltipRow = $state(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let tooltipBelow = $state(false);
  let tooltipPinned = $state(false);

  function hideTooltip() {
    tooltipVisible = false;
    tooltipPinned = false;
    tooltipRow = null;
  }

  function showTooltip(row, x, y, pinned = false) {
    if (!row) return;
    const width = Math.min(240, wrap?.clientWidth || 240);
    const left = Math.max(width / 2 + 4, Math.min((wrap?.clientWidth || width) - width / 2 - 4, x));
    tooltipRow = row;
    tooltipX = left;
    tooltipY = y;
    tooltipBelow = y < (wrap?.clientHeight || 350) / 2;
    tooltipPinned = pinned;
    tooltipVisible = true;
  }

  function externalTooltipHandler({ tooltip }) {
    if (tooltipPinned) return;
    if (tooltip.opacity === 0) {
      hideTooltip();
      return;
    }
    const raw = tooltip.dataPoints?.[0]?.raw?.meta;
    if (!raw) {
      hideTooltip();
      return;
    }
    showTooltip(raw, tooltip.caretX, tooltip.caretY, false);
  }

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
            ) {
              hideTooltip();
              return;
            }
            const points = chartInstance.getElementsAtEventForMode(
              event, 'nearest', { intersect: !compact }, true
            );
            if (!points.length) {
              hideTooltip();
              return;
            }
            const point = points[0];
            const element = point.element;
            if (!element) {
              hideTooltip();
              return;
            }
            const distance = Math.hypot(event.x - element.x, event.y - element.y);
            if (distance > (compact ? 24 : 18)) {
              hideTooltip();
              return;
            }
            const dataset = chartInstance.data.datasets[point.datasetIndex];
            const raw = dataset?.data?.[point.index]?.meta;
            if (raw) showTooltip(raw, element.x, element.y, true);
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
              external: externalTooltipHandler,
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
    hideTooltip();
  }

  onMount(() => {
    if (canvas && data.length > 0) render();
    const onWindowClick = (event) => {
      if (tooltipPinned && wrap && !wrap.contains(event.target)) hideTooltip();
    };
    window.addEventListener('click', onWindowClick);
    return () => window.removeEventListener('click', onWindowClick);
  });

  $effect(() => {
    if (data.length > 0 && canvas) render();
    else destroyChart();
  });

  onDestroy(destroyChart);
</script>

<div bind:this={wrap} class="chart-wrap" style="height: {typeof height === 'number' ? `${height}px` : height};">
  {#if data.length === 0}
    <div class="chart-empty">No numeric metrics for chart</div>
  {:else}
    <canvas bind:this={canvas}></canvas>
  {/if}

  {#if tooltipVisible && tooltipRow}
    <div
      class="chart-tooltip"
      class:below={tooltipBelow}
      class:pinned={tooltipPinned}
      style="left:{tooltipX}px;top:{tooltipY}px"
      role="dialog"
      aria-label="metric value"
    >
      <div class="tt-head">
        <span class="tt-value">{fmtVal(tooltipRow.value)}</span>
        <button
          type="button"
          class="tt-close"
          aria-label="close value tooltip"
          onclick={hideTooltip}
        >×</button>
      </div>
      <div class="tt-meta">
        <div class="truncate">{tooltipRow.agent_title || tooltipRow.agentid} › {tooltipRow.plugin_title || tooltipRow.pluginid}</div>
        <div class="truncate">{tooltipRow.metric}</div>
        <div>{fmtTime(tooltipRow.timestamp)}</div>
        {#if tooltipRow.note}
          <div class="tt-note">📝 {tooltipRow.note}</div>
        {/if}
      </div>
      {#if onNoteRequest}
        <button
          type="button"
          class="tt-note-btn"
          onclick={() => { const row = tooltipRow; hideTooltip(); onNoteRequest(row); }}
        >{tooltipRow.note ? 'Edit note' : 'Add note'}</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .chart-wrap { position: relative; }
  .chart-empty { text-align: center; padding: 3rem; font-style: italic; }

  .chart-tooltip {
    position: absolute;
    z-index: 5;
    width: min(240px, calc(100% - 8px));
    transform: translate(-50%, calc(-100% - 10px));
    background: rgba(15, 23, 42, 0.94);
    color: #f8fafc;
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 10px;
    padding: 8px 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
    pointer-events: auto;
    font-size: 11px;
    line-height: 1.35;
  }
  .chart-tooltip:not(.pinned) { pointer-events: none; }
  .chart-tooltip.below { transform: translate(-50%, 10px); }
  .chart-tooltip.pinned { border-color: rgba(245, 158, 11, 0.65); }
  .tt-head { display: flex; align-items: flex-start; gap: 8px; }
  .tt-value { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 700; color: #fbbf24; }
  .tt-close {
    margin-left: auto;
    flex-shrink: 0;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    padding: 0 2px;
  }
  .tt-close:hover { color: #f8fafc; }
  .tt-meta { margin-top: 3px; color: #cbd5e1; display: flex; flex-direction: column; gap: 1px; }
  .tt-note { margin-top: 5px; padding-top: 5px; border-top: 1px solid rgba(148, 163, 184, 0.25); color: #fde68a; white-space: pre-wrap; max-height: 4.5em; overflow: hidden; }
  .tt-note-btn {
    margin-top: 7px;
    width: 100%;
    border: 1px solid rgba(245, 158, 11, 0.45);
    border-radius: 7px;
    background: rgba(245, 158, 11, 0.14);
    color: #fbbf24;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 8px;
    cursor: pointer;
  }
  .tt-note-btn:hover { background: rgba(245, 158, 11, 0.24); }
</style>