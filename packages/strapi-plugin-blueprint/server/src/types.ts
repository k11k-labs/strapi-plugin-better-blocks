/** What a node on the diagram is. The three kinds are drawn differently. */
export type NodeKind = 'collectionType' | 'singleType' | 'component';

export interface Field {
  name: string;
  /** The Strapi attribute type, shown verbatim: `string`, `media`, `relation`… */
  type: string;
  /** `oneToMany`, `manyToOne`… only on relations, and only when Strapi says so. */
  relation?: string;
  required?: boolean;
}

export interface Node {
  /** The content-type or component uid - unique, and what edges point at. */
  uid: string;
  kind: NodeKind;
  /** `Article`, `Shared / Seo` - what the admin panel calls it. */
  label: string;
  /** `api`, `plugin::users-permissions`, or the component category. */
  group: string;
  fields: Field[];
  /** True for anything Strapi or a plugin owns, rather than the user's own API. */
  foreign: boolean;
  /**
   * Whether this box has a page in the Content-Type Builder to open.
   *
   * A plugin's internal tables - Greenlight's transition log, upload's folders,
   * every `admin::` type - are real content types and belong on the diagram, but
   * there is nowhere to send someone who clicks one.
   */
  navigable: boolean;
}

/**
 * Why two nodes are joined.
 *
 * `relation` is the classic ERD edge. The other two are the reason this plugin
 * exists: every diagram in this category draws relations only, so a schema built
 * out of components - which is most of them - shows up as a handful of
 * disconnected boxes and tells you nothing.
 */
export type EdgeKind = 'relation' | 'component' | 'dynamiczone';

export interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
  /** The attribute on `from` that causes the edge. */
  field: string;
  /** `oneToMany` and friends, for relations. */
  cardinality?: string;
  /** A repeatable component, or a dynamic zone: many of the target, not one. */
  many?: boolean;
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
}

/** What the caller asked to see. Everything defaults to the useful answer. */
export interface GraphOptions {
  /** Content types owned by Strapi or by plugins - noise for most people. */
  includeForeign: boolean;
  /** Components and dynamic zones, and the edges into them. */
  includeComponents: boolean;
  /** `createdAt`, `updatedAt`, `publishedAt`, `locale` and friends. */
  includeDefaultFields: boolean;
  /** Uids to leave out entirely, whatever else is on. */
  exclude: string[];
}

export interface Placed extends Node {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoutedEdge extends Edge {
  points: Array<{ x: number; y: number }>;
}

export interface Layout {
  nodes: Placed[];
  edges: RoutedEdge[];
  width: number;
  height: number;
}
