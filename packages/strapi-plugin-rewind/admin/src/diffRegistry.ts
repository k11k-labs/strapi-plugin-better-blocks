import type * as React from 'react';

export type DiffOp = 'equal' | 'added' | 'removed';

export interface DiffSpan {
  op: DiffOp;
  value: string;
}

export interface FieldChange {
  field: string;
  type: string;
  /** Set when the attribute is a custom field; more specific than `type`. */
  customField?: string;
  kind: 'added' | 'removed' | 'changed';
  before?: unknown;
  after?: unknown;
  spans?: DiffSpan[];
  linked?: { documentId?: string; id?: number; targetUid: string }[];
  unlinked?: { documentId?: string; id?: number; targetUid: string }[];
}

export type DiffRenderer = React.ComponentType<{ change: FieldChange }>;

const renderers = new Map<string, DiffRenderer>();

/**
 * Lets another package render the diff for its own field type.
 *
 * Rewind compares a rich-text field by pulling the readable words out of the
 * JSON, which tells an editor *that* a paragraph changed but nothing about
 * blocks moving, an image being swapped, or a table gaining a row. The package
 * that owns the field format is the only one that can show that properly, so
 * the type-to-component mapping is a registry rather than a switch:
 *
 *   import { registerDiffRenderer } from '@qkix/strapi-plugin-rewind/strapi-admin';
 *   registerDiffRenderer('plugin::better-blocks.better-blocks', BlocksDiff);
 *
 * Keyed by the attribute's `type`, or by a custom field's uid.
 */
export const registerDiffRenderer = (type: string, renderer: DiffRenderer): void => {
  renderers.set(type, renderer);
};

export const getDiffRenderer = (type: string): DiffRenderer | undefined => renderers.get(type);
