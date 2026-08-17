import type { Core } from '@strapi/strapi';

import type { Edge, Field, Graph, GraphOptions, Node } from '../types';

/**
 * Attributes Strapi adds to every content type.
 *
 * Drawn by default they trade the shape of the schema for four rows of
 * `createdAt` on every single box, so they are off unless asked for.
 */
const DEFAULT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'publishedAt',
  'createdBy',
  'updatedBy',
  'locale',
  'localizations',
]);

export const DEFAULTS: GraphOptions = {
  includeForeign: false,
  includeComponents: true,
  includeDefaultFields: false,
  exclude: [],
};

export interface RawAttribute {
  type: string;
  relation?: string;
  target?: string;
  component?: string;
  components?: string[];
  repeatable?: boolean;
  required?: boolean;
  /** Present on the *non-owning* side of a two-sided relation. */
  mappedBy?: string;
  inversedBy?: string;
}

export interface RawModel {
  uid: string;
  kind?: string;
  modelType?: string;
  category?: string;
  info?: { displayName?: string; singularName?: string };
  attributes?: Record<string, RawAttribute>;
  pluginOptions?: { 'content-type-builder'?: { visible?: boolean } };
}

/**
 * Whether the Content-Type Builder has a page for this.
 *
 * `pluginOptions['content-type-builder'].visible === false` is how Strapi and
 * every plugin mark their own tables as not yours to edit - upload's files and
 * folders, i18n's locales, all of `admin::`, and a plugin's internal bookkeeping.
 * The Builder hides exactly those, so it is also the honest test for whether
 * clicking a box can go anywhere. Components are always editable there.
 */
const isNavigable = (model: RawModel): boolean =>
  model.modelType === 'component' ||
  model.pluginOptions?.['content-type-builder']?.visible !== false;

/** `api::article.article` → `api`, `plugin::i18n.locale` → `plugin::i18n`. */
const groupOf = (uid: string): string => {
  if (uid.startsWith('api::')) return 'api';
  const [scope] = uid.split('.');
  return scope ?? uid;
};

const isOwn = (uid: string): boolean => uid.startsWith('api::');

const labelOf = (model: RawModel): string =>
  model.info?.displayName ?? model.info?.singularName ?? model.uid;

const graph = ({ strapi }: { strapi: Core.Strapi }) => {
  const self = {
    /**
     * The whole schema as a graph.
     *
     * Reads Strapi's own loaded models rather than the files on disk, so a
     * content type a plugin adds at runtime is on the diagram too, and nothing
     * has to be parsed.
     */
    build(options: Partial<GraphOptions> = {}): Graph {
      const opts = { ...DEFAULTS, ...options };
      const excluded = new Set(opts.exclude);

      const contentTypes = Object.values(
        strapi.contentTypes as unknown as Record<string, RawModel>
      );
      const components = Object.values(
        (strapi.components ?? {}) as unknown as Record<string, RawModel>
      );

      const wanted = new Map<string, RawModel>();

      for (const model of contentTypes) {
        if (excluded.has(model.uid)) continue;
        if (!opts.includeForeign && !isOwn(model.uid)) continue;
        wanted.set(model.uid, model);
      }

      if (opts.includeComponents) {
        for (const model of components) {
          if (excluded.has(model.uid)) continue;
          wanted.set(model.uid, model);
        }
      }

      const nodes: Node[] = [...wanted.values()].map((model) => ({
        uid: model.uid,
        kind:
          model.modelType === 'component'
            ? ('component' as const)
            : model.kind === 'singleType'
              ? ('singleType' as const)
              : ('collectionType' as const),
        label: labelOf(model),
        group:
          model.modelType === 'component' ? (model.category ?? 'components') : groupOf(model.uid),
        foreign: model.modelType === 'component' ? false : !isOwn(model.uid),
        navigable: isNavigable(model),
        fields: self.fieldsOf(model, opts),
      }));

      return { nodes, edges: self.edgesOf(wanted, opts) };
    },

    fieldsOf(model: RawModel, opts: GraphOptions): Field[] {
      const fields: Field[] = [];

      for (const [name, attribute] of Object.entries(model.attributes ?? {})) {
        if (!opts.includeDefaultFields && DEFAULT_FIELDS.has(name)) continue;

        fields.push({
          name,
          type: attribute.type,
          ...(attribute.relation ? { relation: attribute.relation } : {}),
          ...(attribute.required ? { required: true } : {}),
        });
      }

      return fields;
    },

    /**
     * Edges, one per reason two boxes are joined.
     *
     * Both ends of a two-sided relation describe the same line. Strapi marks
     * the non-owning end with `mappedBy`, so skipping those leaves exactly one
     * edge - deduplicating by node pair instead would silently merge two
     * genuinely different relations between the same two types.
     *
     * Edges to something not on the diagram are dropped rather than drawn into
     * nothing: with `includeComponents` off, every component attribute would
     * otherwise become a line to a box that is not there.
     *
     * A field that is not drawn does not get a line either, and that is not a
     * detail. i18n adds a `localizations` relation **to every content type,
     * pointing at itself**, so skipping it in the field list but not here put a
     * self-loop on every single box on the diagram.
     */
    edgesOf(present: Map<string, RawModel>, opts: GraphOptions): Edge[] {
      const edges: Edge[] = [];

      const add = (edge: Edge) => {
        if (!present.has(edge.to)) return;
        edges.push(edge);
      };

      for (const model of present.values()) {
        for (const [name, attribute] of Object.entries(model.attributes ?? {})) {
          if (!opts.includeDefaultFields && DEFAULT_FIELDS.has(name)) continue;
          if (attribute.type === 'relation' && attribute.target) {
            if (attribute.mappedBy) continue;
            add({
              from: model.uid,
              to: attribute.target,
              kind: 'relation',
              field: name,
              cardinality: attribute.relation,
              many: (attribute.relation ?? '').endsWith('Many'),
            });
            continue;
          }

          if (attribute.type === 'component' && attribute.component) {
            add({
              from: model.uid,
              to: attribute.component,
              kind: 'component',
              field: name,
              many: attribute.repeatable === true,
            });
            continue;
          }

          if (attribute.type === 'dynamiczone') {
            for (const target of attribute.components ?? []) {
              add({
                from: model.uid,
                to: target,
                kind: 'dynamiczone',
                field: name,
                many: true,
              });
            }
          }
        }
      }

      return edges;
    },

    /** Everything that could be excluded, for the settings UI. */
    catalogue(): Array<{ uid: string; label: string; kind: string }> {
      const contentTypes = Object.values(
        strapi.contentTypes as unknown as Record<string, RawModel>
      );
      const components = Object.values(
        (strapi.components ?? {}) as unknown as Record<string, RawModel>
      );

      return [...contentTypes, ...components].map((model) => ({
        uid: model.uid,
        label: labelOf(model),
        kind: model.modelType === 'component' ? 'component' : (model.kind ?? 'collectionType'),
      }));
    },
  };

  return self;
};

export default graph;
