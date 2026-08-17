import { METRICS, rowsOf } from './layout';
import type { Layout, Placed, RoutedEdge } from '../types';

/**
 * Every string that reaches the output goes through here.
 *
 * Content-type names come from developers rather than from the public, so this
 * is not the front line of anything - but the SVG is injected into the admin
 * panel's DOM and also handed to people to commit into a repository, and a
 * display name containing `</text><script>` must not become script in either
 * place. Escaping at the boundary is the only version of this that stays true
 * as the renderer grows.
 */
export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Cuts a label to what fits, with an ellipsis, so text never leaves its box. */
const fit = (text: string, pixels: number): string => {
  const max = Math.floor(pixels / METRICS.charWidth);
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`;
};

/**
 * The palette, as CSS custom properties.
 *
 * Declared once at the top of the document so the same file works on a light
 * page and a dark one: the admin panel injects it into whichever theme is
 * running, and a downloaded copy opens on a white background. Hard-coding the
 * fills would make one of those two unreadable.
 */
const STYLES = `
  .bp-surface { fill: var(--bp-surface, #ffffff); }
  .bp-box { fill: var(--bp-box, #ffffff); stroke: var(--bp-border, #dcdce4); }
  .bp-box-component { fill: var(--bp-box-component, #f6f6f9); stroke: var(--bp-border, #dcdce4); }
  /* A saturated stripe rather than a pale filled header: the 100-tones that
     look right on a white page are almost black in a dark theme, and the three
     kinds of box stop being told apart. These read on either. */
  .bp-accent-collectionType { fill: var(--bp-accent, #4945ff); }
  .bp-accent-component { fill: var(--bp-accent-component, #2f6846); }
  .bp-accent-singleType { fill: var(--bp-accent-single, #d9822f); }
  .bp-divider { stroke: var(--bp-border, #dcdce4); }
  .bp-title { fill: var(--bp-title, #32324d); font-weight: 600; }
  .bp-field { fill: var(--bp-field, #32324d); }
  .bp-type { fill: var(--bp-type, #8e8ea9); }
  .bp-edge { stroke: var(--bp-edge, #8e8ea9); fill: none; }
  .bp-edge-component { stroke-dasharray: 5 3; }
  .bp-edge-dynamiczone { stroke-dasharray: 2 3; }
  text { font-family: var(--bp-font, ui-sans-serif, system-ui, sans-serif); font-size: 11px; }
  .bp-title-text { font-size: 12px; }
  /* Every box is a link to its content type, so it says so on hover. Written
     into the drawing rather than added by the admin panel because the hit area
     is the box, and only the drawing knows where that is. Harmless in a
     downloaded file, where nothing is hovering anything. */
  /* Only boxes that lead somewhere invite a click. A plugin's internal tables
     are on the diagram because they are part of the schema, but the Content-Type
     Builder has no page for them, so they get no pointer and no highlight. */
  .bp-nodes > g[data-navigable="true"] { cursor: pointer; }
  .bp-nodes > g[data-navigable="true"]:hover .bp-box,
  .bp-nodes > g[data-navigable="true"]:hover .bp-box-component { fill: var(--bp-hover, #f0f0ff); }
  /* The outline picks up the box's own stripe colour, so hovering a component
     does not turn it the colour of a content type. */
  .bp-nodes > g[data-navigable="true"][data-kind="collectionType"]:hover .bp-box { stroke: var(--bp-accent, #4945ff); }
  .bp-nodes > g[data-navigable="true"][data-kind="singleType"]:hover .bp-box { stroke: var(--bp-accent-single, #d9822f); }
  .bp-nodes > g[data-navigable="true"][data-kind="component"]:hover .bp-box-component { stroke: var(--bp-accent-component, #2f6846); }
`;

/** The stripe along the top of a box, which is how its kind is read. */
const accent = (node: Placed): string => `bp-accent-${node.kind}`;

const box = (node: Placed): string => {
  const { fields, hidden } = rowsOf(node);

  const more =
    hidden > 0
      ? [
          `<text class="bp-type" x="${node.x + METRICS.paddingX}" `,
          `y="${node.y + METRICS.headerHeight + fields.length * METRICS.rowHeight + 13}">`,
          `+${hidden} more`,
          '</text>',
        ].join('')
      : '';

  const rows = fields
    .map((field, index) => {
      const y = node.y + METRICS.headerHeight + index * METRICS.rowHeight + 13;
      const nameWidth = node.width - METRICS.paddingX * 2 - METRICS.typeGutter;
      const type = field.relation ?? field.type;

      return [
        `<text class="bp-field" x="${node.x + METRICS.paddingX}" y="${y}">`,
        escapeXml(fit(field.name, nameWidth)),
        field.required ? '<tspan class="bp-type"> *</tspan>' : '',
        '</text>',
        `<text class="bp-type" x="${node.x + node.width - METRICS.paddingX}" y="${y}" text-anchor="end">`,
        escapeXml(fit(type, METRICS.typeGutter)),
        '</text>',
      ].join('');
    })
    .join('');

  // The uid rides along as a data attribute: it is what the admin panel reads
  // on click to open the right content type, and it is inert in a saved file.
  return [
    `<g data-uid="${escapeXml(node.uid)}" data-kind="${node.kind}" data-navigable="${node.navigable}">`,
    `<rect class="${node.kind === 'component' ? 'bp-box-component' : 'bp-box'}" `,
    `x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="4" />`,
    `<path class="${accent(node)}" d="M${node.x},${node.y + 4} a4,4 0 0 1 4,-4 h${node.width - 8} a4,4 0 0 1 4,4 v2 h-${node.width} z" />`,
    `<line class="bp-divider" x1="${node.x}" y1="${node.y + METRICS.headerHeight}" x2="${node.x + node.width}" y2="${node.y + METRICS.headerHeight}" />`,
    `<text class="bp-title bp-title-text" x="${node.x + METRICS.paddingX}" y="${node.y + 21}">`,
    escapeXml(fit(node.label, node.width - METRICS.paddingX * 2)),
    '</text>',
    rows,
    more,
    '</g>',
  ].join('');
};

/**
 * A smooth line through dagre's control points.
 *
 * dagre hands back a polyline, and drawn literally it is a chain of visible
 * kinks - the thing that makes a generated diagram look generated. Curving
 * through the midpoints costs nothing and is what the eye expects of a wire.
 */
const path = (points: Array<{ x: number; y: number }>): string => {
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  }

  const parts = [`M${points[0].x},${points[0].y}`];

  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = Math.round((current.x + next.x) / 2);
    const midY = Math.round((current.y + next.y) / 2);
    parts.push(`Q${current.x},${current.y} ${midX},${midY}`);
  }

  const last = points[points.length - 1];
  parts.push(`L${last.x},${last.y}`);

  return parts.join(' ');
};

const edge = (routed: RoutedEdge): string => {
  if (routed.points.length === 0) return '';

  const d = path(routed.points);

  return [
    `<path class="bp-edge bp-edge-${routed.kind}" d="${d}" `,
    `marker-end="url(#bp-arrow)" data-field="${escapeXml(routed.field)}" />`,
  ].join('');
};

/**
 * The diagram, as a standalone SVG document.
 *
 * Standalone on purpose - styles and marker inline, no external references - so
 * the same bytes work in the admin panel, in a README, and opened straight from
 * a downloads folder. An `<img>` tag will not fetch anything an SVG refers to,
 * which is what makes the usual "export" of this category a raster screenshot
 * rather than a drawing you can scale.
 */
export const render = (placed: Layout): string => {
  const width = Math.max(placed.width, 1);
  const height = Math.max(placed.height, 1);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" `,
    `viewBox="0 0 ${width} ${height}" role="img" aria-label="Content type diagram">`,
    `<style>${STYLES}</style>`,
    '<defs>',
    '<marker id="bp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">',
    '<path d="M0,0 L10,5 L0,10 z" fill="var(--bp-edge, #8e8ea9)" />',
    '</marker>',
    '</defs>',
    `<rect class="bp-surface" x="0" y="0" width="${width}" height="${height}" />`,
    // Edges first so a line never crosses over the box it points at.
    `<g class="bp-edges">${placed.edges.map(edge).join('')}</g>`,
    `<g class="bp-nodes">${placed.nodes.map(box).join('')}</g>`,
    '</svg>',
  ].join('');
};

export default render;
