import dagre from '@dagrejs/dagre';

import type { Graph, Layout, Placed, RoutedEdge } from '../types';

/**
 * Box metrics. Kept here rather than in the renderer because the layout has to
 * agree with the drawing about how big a box is, and two copies of that drift.
 */
export const METRICS = {
  headerHeight: 30,
  rowHeight: 18,
  paddingX: 12,
  /** Rough width of one character at the font size the renderer uses. */
  charWidth: 6.6,
  minWidth: 150,
  maxWidth: 320,
  /** Room for the type, drawn right-aligned on the same row as the name. */
  typeGutter: 74,
};

export type Direction = 'TB' | 'LR';

/**
 * How many fields a box shows before it gives up and counts the rest.
 *
 * Strapi's own `File` has fifteen, and a diagram where one box is four times
 * the height of its neighbours reads as a wall rather than a shape. The whole
 * list is still a click away in the Content-Type Builder; the picture is for
 * seeing how things connect.
 */
export const MAX_ROWS = 12;

/** What a box actually draws, and how much it is leaving out. */
export const rowsOf = (node: Graph['nodes'][number]) => {
  if (node.fields.length <= MAX_ROWS) return { fields: node.fields, hidden: 0 };

  return {
    fields: node.fields.slice(0, MAX_ROWS),
    hidden: node.fields.length - MAX_ROWS,
  };
};

const sizeOf = (node: Graph['nodes'][number]) => {
  const { fields, hidden } = rowsOf(node);

  const longest = Math.max(
    node.label.length + 4,
    ...fields.map((field) => field.name.length + 2),
    0
  );

  const width = Math.min(
    METRICS.maxWidth,
    Math.max(
      METRICS.minWidth,
      longest * METRICS.charWidth + METRICS.paddingX * 2 + METRICS.typeGutter
    )
  );

  return {
    width: Math.round(width),
    height: METRICS.headerHeight + (fields.length + (hidden > 0 ? 1 : 0)) * METRICS.rowHeight + 8,
  };
};

/**
 * Positions every box and routes every line.
 *
 * dagre does the hard part. It runs on the server, which is the whole point:
 * the incumbents in this category all layout in the browser with a React graph
 * library, which is what tied them to React and styled-components versions and
 * is why both of them broke. A layered-graph algorithm has no opinion about the
 * UI framework, and the SVG it feeds can be produced with no browser at all.
 */
export const layout = (graph: Graph, direction: Direction = 'TB'): Layout => {
  const g = new dagre.graphlib.Graph({ multigraph: true });

  g.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 70,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const sizes = new Map<string, { width: number; height: number }>();

  for (const node of graph.nodes) {
    const size = sizeOf(node);
    sizes.set(node.uid, size);
    g.setNode(node.uid, { ...size });
  }

  graph.edges.forEach((edge, index) => {
    // Multigraph: two components on the same dynamic zone are two edges between
    // the same pair, and without a name dagre keeps only the last one.
    g.setEdge(edge.from, edge.to, {}, `e${index}`);
  });

  dagre.layout(g);

  const nodes: Placed[] = graph.nodes.map((node) => {
    const positioned = g.node(node.uid);
    const size = sizes.get(node.uid)!;

    return {
      ...node,
      // dagre reports centres; everything downstream wants a top-left corner.
      x: Math.round(positioned.x - size.width / 2),
      y: Math.round(positioned.y - size.height / 2),
      width: size.width,
      height: size.height,
    };
  });

  const edges: RoutedEdge[] = graph.edges.map((edge, index) => {
    const routed = g.edge(edge.from, edge.to, `e${index}`);

    return {
      ...edge,
      points: (routed?.points ?? []).map((point: { x: number; y: number }) => ({
        x: Math.round(point.x),
        y: Math.round(point.y),
      })),
    };
  });

  const graphSize = g.graph();

  return {
    nodes,
    edges,
    width: Math.ceil(graphSize.width ?? 0),
    height: Math.ceil(graphSize.height ?? 0),
  };
};

export default layout;
