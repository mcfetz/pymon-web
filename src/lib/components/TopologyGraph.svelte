<script>
  /**
   * Force-directed topology graph.
   *
   * The drawing is owned by d3 (it mutates the SVG directly); Svelte owns the
   * container, the controls and the props. Node positions survive a data
   * refresh: they are keyed by node id, so a poll updates the graph instead of
   * reshuffling it.
   *
   * Gestures come from d3-zoom: wheel and double-click to zoom, one finger to
   * pan, two fingers to pinch. That is why the SVG carries touch-action: none —
   * without it the browser would scroll the page instead of delivering the
   * gesture.
   */
  import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
  import { select } from 'd3-selection';
  import { zoom, zoomIdentity } from 'd3-zoom';
  import { drag } from 'd3-drag';

  let {
    nodes = [],
    edges = [],
    selectedId = null,
    height = 620,
    grouped = true,
    onselect = () => {},
  } = $props();

  let host = $state(null);
  let zoomLabel = $state('100%');
  let hoverId = $state(null);
  // Plain variable on purpose: it only guards a one-time action and must not
  // make the render effect depend on itself.
  let didFit = false;

  // One entry per node kind: radius and colour. Unknown kinds still render.
  const KIND_STYLE = {
    'pve-node': { color: '#a78bfa', r: 14 },
    'pve-guest': { color: '#60a5fa', r: 12 },
    'docker-host': { color: '#34d399', r: 13 },
    service: { color: '#fbbf24', r: 9 },
    container: { color: '#f472b6', r: 8 },
    'public-name': { color: '#22d3ee', r: 10 },
    wan: { color: '#fb7185', r: 12 },
  };
  const FALLBACK = { color: '#94a3b8', r: 8 };

  // ── Grouping ─────────────────────────────────────────────────────────────
  // d3-force has no container/compound node (Cytoscape has them natively). The
  // pattern instead: a custom force pulls each group towards its own centre,
  // and the box around a group is drawn by us from the node positions each
  // tick. So the group is a view concept, not a data structure.
  const GROUP_LABEL = { proxmox: 'Proxmox', docker: 'Docker', net: 'Netz', other: 'Sonstige' };
  const GROUP_COLOR = { proxmox: '#a78bfa', docker: '#34d399', net: '#22d3ee', other: '#94a3b8' };

  function groupOf(kind) {
    if (kind === 'pve-node' || kind === 'pve-guest') return 'proxmox';
    if (kind === 'docker-host' || kind === 'service' || kind === 'container') return 'docker';
    if (kind === 'public-name' || kind === 'wan') return 'net';
    return 'other';
  }

  function forceCluster(centers, strength = 0.14) {
    let simNodes = [];
    function force(alpha) {
      for (const n of simNodes) {
        const c = centers.get(n.group);
        if (!c) continue;
        n.vx += (c.x - n.x) * strength * alpha;
        n.vy += (c.y - n.y) * strength * alpha;
      }
    }
    force.initialize = (n) => {
      simNodes = n;
    };
    return force;
  }

  function styleFor(kind) {
    return KIND_STYLE[kind] || FALLBACK;
  }

  // Edge colours by relation, so a chain is readable at a glance.
  const EDGE_STYLE = {
    guest: '#64748b',
    runs: '#475569',
    proxies: '#22d3ee',
    'routes-to': '#fb7185',
  };

  function edgeColor(kind) {
    return EDGE_STYLE[kind] || '#475569';
  }

  function labelOf(n) {
    return n.label || n.id;
  }

  // ── d3 wiring ────────────────────────────────────────────────────────────
  let simulation = null;
  let svgSel = null;
  let viewport = null;
  let linkSel = null;
  let nodeSel = null;
  let zoomBehavior = null;
  const known = new Map(); // id -> {x, y, vx, vy} kept across data refreshes

  function nodeId(n) {
    return n.id;
  }

  function visible() {
    const showStale = nodes.some((n) => n.stale);
    return { showStale };
  }

  function buildSimData() {
    const simNodes = nodes.map((n) => {
      const prev = known.get(nodeId(n));
      return {
        id: nodeId(n),
        label: labelOf(n),
        kind: n.kind,
        group: groupOf(n.kind),
        stale: !!n.stale,
        attrs: n.attrs || {},
        ids: n.ids || [],
        x: prev ? prev.x : undefined,
        y: prev ? prev.y : undefined,
      };
    });
    const byId = new Map(simNodes.map((n) => [n.id, n]));
    const simEdges = edges
      .map((e) => ({
        source: byId.get(e.src) ? e.src : null,
        target: byId.get(e.dst) ? e.dst : null,
        kind: e.kind,
        label: e.label || '',
      }))
      .filter((e) => e.source && e.target);
    return { simNodes, simEdges };
  }

  function alphaTargetForRestart(d3, simulation) {
    simulation.alpha(0.9).restart();
  }

  function render() {
    if (!host) return;
    const d3 = { select };
    const { simNodes, simEdges } = buildSimData();
    if (!svgSel) {
      svgSel = select(host).select('svg');
      viewport = svgSel.select('g.viewport');
      // Boxes first, so the edges and nodes are drawn on top of them.
      viewport.append('g').attr('class', 'boxes');
      // Zoom lives on the SVG, so wheel/pinch work anywhere on the canvas.
      zoomBehavior = zoom()
        .scaleExtent([0.12, 6])
        .on('zoom', (event) => {
          const t = event.transform;
          viewport.attr('transform', t.toString());
          zoomLabel = `${Math.round(t.k * 100)}%`;
        });
      svgSel
        .call(zoomBehavior)
        .on('dblclick.zoom', null)
        // A double click on empty canvas should not zoom, it is a mis-click on
        // a dense graph. Buttons and wheel/pinch stay available.
        .on('click', (event) => {
          if (event.target.tagName === 'svg') onselect(null);
        });
    }

    const width = host.clientWidth || 800;
    const h = height;
    svgSel.attr('viewBox', `${-width / 2} ${-h / 2} ${width} ${h}`);

    for (const n of simNodes) {
      if (n.x === undefined) {
        // New node: place it on a circle so it does not fly in from nowhere.
        const i = simNodes.indexOf(n);
        const a = (i / Math.max(simNodes.length, 1)) * Math.PI * 2;
        n.x = Math.cos(a) * (width / 4);
        n.y = Math.sin(a) * (width / 4);
      }
    }

    // Group centres on a circle. A busier world gets a wider berth, otherwise
    // it squeezes the others out.
    const groups = new Map();
    for (const n of simNodes) {
      const key = n.group || 'other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(n);
    }
    const centers = new Map();
    const groupKeys = [...groups.keys()].sort();
    groupKeys.forEach((key, i) => {
      const angle = (i / Math.max(groupKeys.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = 170 + Math.min(groups.get(key).length, 20) * 6;
      centers.set(key, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    });

    if (simulation) simulation.stop();
    simulation = forceSimulation(simNodes)
      .force('link', forceLink(simEdges).id((d) => d.id).distance((d) => (d.kind === 'runs' ? 55 : 90)).strength(0.5))
      .force('charge', forceManyBody().strength(-320))
      .force('center', forceCenter(0, 0))
      .force('cluster', grouped ? forceCluster(centers) : null)
      .force('collide', forceCollide().radius((d) => styleFor(d.kind).r + 14));

    // ── edges ──
    linkSel = viewport.selectAll('line.edge').data(simEdges, (d) => `${d.source.id || d.source}|${d.target.id || d.target}|${d.kind}`);
    linkSel.exit().remove();
    linkSel = linkSel
      .enter()
      .append('line')
      .attr('class', 'edge')
      .attr('stroke', (d) => edgeColor(d.kind))
      .attr('stroke-width', 1.4)
      .attr('stroke-opacity', 0.75)
      .merge(linkSel);

    // ── nodes ──
    nodeSel = viewport.selectAll('g.node').data(simNodes, (d) => d.id);
    nodeSel.exit().remove();
    const enter = nodeSel.enter().append('g').attr('class', 'node');
    enter.append('circle').attr('class', 'node-circle');
    enter.append('text').attr('class', 'node-label').attr('text-anchor', 'middle');
    nodeSel = enter.merge(nodeSel);

    nodeSel
      .select('circle')
      .attr('r', (d) => styleFor(d.kind).r)
      .attr('fill', (d) => styleFor(d.kind).color)
      .attr('fill-opacity', (d) => (d.stale ? 0.35 : 0.95))
      .attr('stroke', (d) => (d.id === selectedId ? '#f8fafc' : 'rgba(15,23,42,0.65)'))
      .attr('stroke-width', (d) => (d.id === selectedId ? 2.5 : 1.2))
      .attr('class', (d) => `node-circle${d.id === selectedId ? ' selected' : ''}${d.stale ? ' stale' : ''}`);

    nodeSel
      .select('text')
      .attr('class', 'node-label')
      .attr('y', (d) => styleFor(d.kind).r + 13)
      .attr('fill', (d) => (d.stale ? 'rgba(226,232,240,0.45)' : 'rgba(226,232,240,0.9)'))
      .text((d) => d.label);

    nodeSel
      .on('click', (event, d) => {
        event.stopPropagation();
        onselect(d.id);
      })
      .on('mouseenter', (_event, d) => {
        hoverId = d.id;
      })
      .on('mouseleave', () => {
        hoverId = null;
      })
      .call(
        drag()
          .on('start', (event, d) => {
            event.sourceEvent.stopPropagation();
            if (!event.active) simulation.alphaTarget(0.25).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            // Keep the node where it was dropped: it stays pinned until the
            // next data refresh, which is what a user expects after dragging.
            d.fx = event.x;
            d.fy = event.y;
          }),
      );

    // ── group boxes ──
    // A padded bounding box per group, recomputed every tick. A convex hull
    // would look rounder, but a box is what the group is: a labelled frame.
    const boxSel = viewport
      .select('g.boxes')
      .selectAll('g.group-box')
      .data(grouped ? [...groups.entries()].map(([key, list]) => ({ key, list })) : [], (d) => d.key);
    boxSel.exit().remove();
    const boxEnter = boxSel.enter().append('g').attr('class', 'group-box');
    boxEnter.append('rect');
    boxEnter.append('text').attr('class', 'group-label');
    const boxes = boxEnter.merge(boxSel);
    boxes
      .select('rect')
      .attr('rx', 18)
      .attr('ry', 18)
      .attr('fill', (d) => GROUP_COLOR[d.key] || '#94a3b8')
      .attr('fill-opacity', 0.07)
      .attr('stroke', (d) => GROUP_COLOR[d.key] || '#94a3b8')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '6 5');
    boxes
      .select('text')
      .attr('fill', (d) => GROUP_COLOR[d.key] || '#94a3b8')
      .text((d) => GROUP_LABEL[d.key] || d.key);

    function layoutBoxes() {
      boxes.each(function (d) {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const n of d.list) {
          if (!Number.isFinite(n.x)) continue;
          const r = styleFor(n.kind).r + 12;
          x0 = Math.min(x0, n.x - r);
          y0 = Math.min(y0, n.y - r);
          x1 = Math.max(x1, n.x + r);
          y1 = Math.max(y1, n.y + r);
        }
        if (!Number.isFinite(x0)) return;
        const g = select(this);
        g.select('rect')
          .attr('x', x0 - 16)
          .attr('y', y0 - 34)
          .attr('width', Math.max(x1 - x0 + 32, 90))
          .attr('height', Math.max(y1 - y0 + 50, 60));
        g.select('text').attr('x', x0 - 6).attr('y', y0 - 20);
      });
    }

    simulation.on('tick', () => {
      linkSel
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);
      nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);
      layoutBoxes();
    });

    // Remember positions for the next refresh, and frame the graph once the
    // layout has actually settled. The cluster force keeps moving the groups
    // long after the first ticks, so a fixed delay is too early — the graph
    // then sits outside the fitted view.
    simulation.on('end', () => {
      for (const n of simNodes) known.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });
      if (!didFit && simNodes.length) {
        didFit = true;
        fitToView();
      }
    });

    // Fallback: if the simulation never reports 'end' (it can be kept alive by
    // interaction), frame it anyway.
    window.setTimeout(() => {
      if (!didFit && simNodes.length) {
        didFit = true;
        fitToView();
      }
    }, 2500);
  }

  // Re-render whenever the data or the selection changes.
  $effect(() => {
    void nodes;
    void edges;
    render();
  });

  $effect(() => {
    // Selection/hover styling without rebuilding the simulation.
    if (!nodeSel) return;
    nodeSel
      .select('circle')
      .attr('stroke', (d) => (d.id === selectedId ? '#f8fafc' : 'rgba(15,23,42,0.65)'))
      .attr('stroke-width', (d) => (d.id === selectedId ? 2.5 : 1.2));
  });

  // ── controls ──
  function zoomBy(factor) {
    if (!svgSel || !zoomBehavior) return;
    svgSel.transition().duration(180).call(zoomBehavior.scaleBy, factor);
  }

  function resetView() {
    if (!svgSel || !zoomBehavior) return;
    svgSel.transition().duration(220).call(zoomBehavior.transform, zoomIdentity);
    for (const n of known.values()) {
      n.vx = 0;
      n.vy = 0;
    }
    if (simulation) simulation.alpha(0.6).restart();
  }

  function fitToView() {
    if (!svgSel || !simulation || !host) return;
    const list = simulation.nodes().filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y));
    if (!list.length) return;
    const pad = 60;
    const xs = list.map((n) => n.x);
    const ys = list.map((n) => n.y);
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const w = host.clientWidth || 800;
    const h = height;
    const k = Math.min(6, Math.max(0.12, Math.min(w / (maxX - minX || 1), h / (maxY - minY || 1))));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    // Frame the nodes. The viewBox is already centred on 0,0, so the middle of
    // the viewport IS the origin in user coordinates — translating by w/2 would
    // push the graph half a screen off.
    svgSel
      .transition()
      .duration(260)
      .call(zoomBehavior.transform, zoomIdentity.translate(-cx * k, -cy * k).scale(k));
  }

  export function fit() {
    fitToView();
  }
</script>

<div class="graph-host" bind:this={host} style="height:{height}px">
  <svg>
    <g class="viewport"></g>
  </svg>

  <div class="graph-controls">
    <button type="button" onclick={() => zoomBy(1.35)} aria-label="Zoom in" title="Zoom in">+</button>
    <button type="button" onclick={() => zoomBy(1 / 1.35)} aria-label="Zoom out" title="Zoom out">−</button>
    <button type="button" onclick={fitToView} aria-label="Fit" title="Alles einpassen">⤢</button>
    <button type="button" onclick={resetView} aria-label="Reset" title="Ansicht zurücksetzen">⟲</button>
    <span class="zoom-label">{zoomLabel}</span>
  </div>

  <p class="hint">Ziehen = verschieben · Rad oder zwei Finger = zoomen · Knoten ziehen = festhalten · Klick = Details</p>
</div>

<style>
  .graph-host {
    position: relative;
    width: 100%;
    border-radius: 1rem;
    overflow: hidden;
    background:
      radial-gradient(circle at 30% 20%, rgba(56, 189, 248, 0.08), transparent 55%),
      radial-gradient(circle at 70% 80%, rgba(167, 139, 250, 0.08), transparent 55%),
      rgba(15, 23, 42, 0.45);
    border: 1px solid rgba(148, 163, 184, 0.18);
  }

  svg {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    /* Required, or the browser scrolls the page instead of delivering the
       pan/pinch gesture to d3-zoom. */
    touch-action: none;
  }

  svg:active {
    cursor: grabbing;
  }

  :global(.graph-host .node) {
    cursor: pointer;
  }

  :global(.graph-host .node-label) {
    font-size: 10px;
    font-weight: 500;
    pointer-events: none;
    paint-order: stroke;
    stroke: rgba(15, 23, 42, 0.85);
    stroke-width: 3px;
  }

  :global(.graph-host .group-label) {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    pointer-events: none;
  }

  :global(.graph-host .node-circle) {
    transition: fill-opacity 120ms ease;
  }

  :global(.graph-host .node-circle:hover) {
    fill-opacity: 1;
  }

  .graph-controls {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-end;
  }

  .graph-controls button {
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(15, 23, 42, 0.7);
    color: rgb(226, 232, 240);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    backdrop-filter: blur(6px);
  }

  .graph-controls button:hover {
    background: rgba(30, 41, 59, 0.9);
  }

  .zoom-label {
    font-size: 0.7rem;
    color: rgba(148, 163, 184, 0.9);
    padding-right: 0.15rem;
  }

  .hint {
    position: absolute;
    left: 0.75rem;
    bottom: 0.5rem;
    margin: 0;
    font-size: 0.7rem;
    color: rgba(148, 163, 184, 0.75);
    pointer-events: none;
  }
</style>
