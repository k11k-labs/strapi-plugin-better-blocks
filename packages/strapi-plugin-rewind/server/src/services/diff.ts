import type { Core } from '@strapi/strapi';

import type { RelationRef } from './serializer';
import { VERSION_UID } from './snapshot';
import {
  collapseEqualSpans,
  diffWords,
  extractText,
  normaliseText,
  type DiffSpan,
} from '../utils/textDiff';

export type ChangeKind = 'added' | 'removed' | 'changed';

export interface FieldChange {
  field: string;
  /** The attribute's type in the live model, or 'unknown' if it is gone. */
  type: string;
  /**
   * A custom field's uid, when the attribute is one. Custom fields all report
   * their storage type - usually `json` - so this is the only thing specific
   * enough for the owning package to key a diff renderer on.
   */
  customField?: string;
  kind: ChangeKind;
  /** Scalars only - the values themselves, for a plain before/after. */
  before?: unknown;
  after?: unknown;
  /** Prose fields - a word-level diff of the readable text. */
  spans?: DiffSpan[];
  /** Relations and media - what was linked and unlinked. */
  linked?: RelationRef[];
  unlinked?: RelationRef[];
}

export interface VersionDiff {
  from: { id: number; label: string | null; createdAt: string; origin: string } | null;
  to: { id: number; label: string | null; createdAt: string; origin: string };
  changes: FieldChange[];
  /** True when the two versions hold identical content. */
  identical: boolean;
}

const SCALAR_TYPES = new Set([
  'string',
  'text',
  'integer',
  'biginteger',
  'float',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'time',
  'enumeration',
  'uid',
  'email',
  'password',
]);

/** Fields whose value is prose worth diffing word by word rather than showing whole. */
const isProse = (type: string, value: unknown): boolean =>
  type === 'text' ||
  type === 'richtext' ||
  type === 'blocks' ||
  type === 'json' ||
  type === 'customField' ||
  type === 'component' ||
  type === 'dynamiczone' ||
  (type === 'string' && typeof value === 'string' && value.length > 80);

const refKey = (ref: RelationRef): string => `${ref.targetUid}:${ref.documentId ?? ref.id}`;

const diff = ({ strapi }: { strapi: Core.Strapi }) => {
  const summarise = (version: any) =>
    version && {
      id: version.id,
      label: version.label ?? null,
      createdAt: version.createdAt,
      origin: version.origin,
    };

  const load = async (id: number) => {
    const version = await strapi.db.query(VERSION_UID).findOne({ where: { id } });
    if (!version) throw new Error(`No version with id ${id}`);
    return version;
  };

  /** The version immediately before this one, for the same document and locale. */
  const previousTo = async (version: any) => {
    const [earlier] = await strapi.db.query(VERSION_UID).findMany({
      where: {
        contentType: version.contentType,
        relatedDocumentId: version.relatedDocumentId,
        locale: version.locale,
        id: { $lt: version.id },
      },
      orderBy: { id: 'desc' },
      limit: 1,
    });
    return earlier ?? null;
  };

  return {
    /**
     * What changed between a version and the one before it.
     *
     * Comparing against the previous version - rather than against the document
     * as it stands - is what makes a history readable: each entry answers "what
     * did this edit do?". The other question, "what would restoring this
     * change?", is what `restore.preview()` already answers.
     */
    async between(versionId: number, againstId?: number): Promise<VersionDiff> {
      const to = await load(versionId);
      const from = againstId ? await load(againstId) : await previousTo(to);

      const attributes = (strapi.getModel(to.contentType as never) as any)?.attributes as Record<
        string,
        any
      >;

      const toData = (to.data ?? {}) as Record<string, unknown>;
      const fromData = (from?.data ?? {}) as Record<string, unknown>;
      const toRelations = (to.relations ?? {}) as Record<string, RelationRef[]>;
      const fromRelations = (from?.relations ?? {}) as Record<string, RelationRef[]>;

      const changes: FieldChange[] = [];

      for (const field of new Set([...Object.keys(fromData), ...Object.keys(toData)])) {
        const before = fromData[field];
        const after = toData[field];
        if (JSON.stringify(before) === JSON.stringify(after)) continue;

        const type: string = attributes?.[field]?.type ?? 'unknown';
        const customField: string | undefined = attributes?.[field]?.customField;
        const kind: ChangeKind =
          before === undefined ? 'added' : after === undefined ? 'removed' : 'changed';

        if (SCALAR_TYPES.has(type) && !isProse(type, before ?? after)) {
          changes.push({ field, type, customField, kind, before, after });
          continue;
        }

        const beforeText = normaliseText(extractText(before));
        const afterText = normaliseText(extractText(after));

        if (beforeText === afterText) {
          // The readable text is the same, so whatever moved was structure or
          // formatting. Saying so is more honest than showing an empty diff.
          changes.push({ field, type, customField, kind, before: undefined, after: undefined });
          continue;
        }

        changes.push({
          field,
          type,
          customField,
          kind,
          // Collapsed here rather than in the panel: sending an entire article
          // to highlight one word wastes the payload as well as the reader's
          // attention.
          spans: collapseEqualSpans(diffWords(beforeText, afterText)),
        });
      }

      for (const field of new Set([...Object.keys(fromRelations), ...Object.keys(toRelations)])) {
        const before = fromRelations[field] ?? [];
        const after = toRelations[field] ?? [];

        const beforeKeys = new Set(before.map(refKey));
        const afterKeys = new Set(after.map(refKey));

        const linked = after.filter((ref) => !beforeKeys.has(refKey(ref)));
        const unlinked = before.filter((ref) => !afterKeys.has(refKey(ref)));
        if (linked.length === 0 && unlinked.length === 0) continue;

        changes.push({
          field,
          type: attributes?.[field]?.type ?? 'relation',
          kind: 'changed',
          linked,
          unlinked,
        });
      }

      return {
        from: from ? summarise(from) : null,
        to: summarise(to),
        changes,
        identical: changes.length === 0,
      };
    },
  };
};

export default diff;
