import type { Core } from '@strapi/strapi';

import { layout } from '../services/layout';
import { render } from '../services/svg';
import { PLUGIN_ID } from '../uids';
import type { Direction } from '../services/layout';
import type { Graph, GraphOptions } from '../types';

const service = (strapi: Core.Strapi) => strapi.plugin(PLUGIN_ID).service('graph');

/** Query strings carry strings; `?components=false` has to mean false. */
const flag = (value: unknown, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return value !== 'false' && value !== '0' && value !== false;
};

const list = (value: unknown): string[] => {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))];
};

/**
 * The configured exclusions are added to whatever the caller asked to hide,
 * never replaced by it: `exclude` in `plugins.ts` is the answer to "this never
 * belongs on the picture", so a URL must not be able to turn it off.
 */
const optionsFrom = (
  strapi: Core.Strapi,
  query: Record<string, unknown> = {}
): Partial<GraphOptions> => ({
  includeForeign: flag(query.foreign, false),
  includeComponents: flag(query.components, true),
  includeDefaultFields: flag(query.defaultFields, false),
  exclude: [
    ...list(query.exclude),
    ...list(strapi.config.get(`plugin::${PLUGIN_ID}.exclude`, []) as string[]),
  ],
});

const directionFrom = (query: Record<string, unknown> = {}): Direction =>
  query.direction === 'LR' ? 'LR' : 'TB';

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * The diagram, already drawn.
   *
   * The admin panel receives finished SVG rather than a graph to render itself.
   * That is the design: one renderer, on the server, so what you see in the
   * panel and what you download are the same bytes, and so the diagram can be
   * produced by anything that can make an HTTP request - a docs build, CI - and
   * not only by a browser running the admin panel.
   */
  async svg(ctx: any) {
    const built = service(strapi).build(optionsFrom(strapi, ctx.query)) as Graph;
    const placed = layout(built, directionFrom(ctx.query));

    ctx.body = {
      svg: render(placed),
      width: placed.width,
      height: placed.height,
      counts: {
        nodes: built.nodes.length,
        edges: built.edges.length,
        components: built.nodes.filter((node) => node.kind === 'component').length,
      },
    };
  },

  /**
   * The same drawing as a file.
   *
   * Separate from `svg` because a download wants `image/svg+xml` and a
   * filename, not JSON with a string in it.
   */
  async download(ctx: any) {
    const built = service(strapi).build(optionsFrom(strapi, ctx.query)) as Graph;
    const placed = layout(built, directionFrom(ctx.query));

    ctx.set('Content-Type', 'image/svg+xml; charset=utf-8');
    ctx.set('Content-Disposition', 'attachment; filename="blueprint.svg"');
    ctx.body = render(placed);
  },

  /** The graph itself, for anyone who would rather draw it their own way. */
  async graph(ctx: any) {
    ctx.body = service(strapi).build(optionsFrom(strapi, ctx.query));
  },

  /** Everything that could be hidden, so the UI can offer a list. */
  async catalogue(ctx: any) {
    ctx.body = { contentTypes: service(strapi).catalogue() };
  },
});

export default controller;
