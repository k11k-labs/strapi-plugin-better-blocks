import type { Core } from '@strapi/strapi';

import type { ExportedDocument, Plan } from '../types';

/**
 * A document, from what Strapi returns to what belongs in a file.
 *
 * Two rules drive all of it. Nothing that only means something in *this*
 * database may travel - primary keys, component row ids, timestamps - because
 * on the far side they are at best noise and at worst a collision. And what
 * does travel must come out in the same order every time, so the file can be
 * committed to a repository and read as a diff.
 */

const keyOf = (related: unknown): string | null => {
  if (related === null || related === undefined) return null;
  if (typeof related === 'string') return related;
  if (typeof related === 'object' && 'documentId' in (related as any)) {
    return String((related as any).documentId);
  }
  return null;
};

interface Options {
  relations: boolean;
  media: boolean;
}

export const makeSerialiser = (strapi: Core.Strapi) => {
  const schema = () => strapi.plugin('ferry').service('schema');

  /**
   * A component instance. Its `id` is dropped: a component row belongs to
   * exactly one document, so its key means nothing in another database, and
   * Strapi assigns a fresh one on import regardless. Keeping it would put a
   * changed number on every line of every diff and buy nothing.
   */
  const componentValue = (value: any, plan: Plan, options: Options): unknown => {
    if (value === null || value === undefined) return null;

    const out: Record<string, unknown> = {};

    for (const field of plan.scalars) {
      if (field.name in value) out[field.name] = value[field.name];
    }

    for (const nested of plan.components) {
      if (!(nested.name in value)) continue;
      const nestedPlan = schema().componentPlan(nested.component);
      out[nested.name] = nested.repeatable
        ? (value[nested.name] ?? []).map((item: unknown) =>
            componentValue(item, nestedPlan, options)
          )
        : componentValue(value[nested.name], nestedPlan, options);
    }

    for (const zone of plan.dynamicZones) {
      if (!(zone.name in value)) continue;
      out[zone.name] = zoneValue(value[zone.name], options);
    }

    if (options.relations) {
      for (const relation of plan.relations) {
        if (!(relation.name in value)) continue;
        out[relation.name] = relationValue(value[relation.name], relation.many);
      }
    }

    if (options.media) {
      for (const field of plan.media) {
        if (!(field.name in value)) continue;
        out[field.name] = mediaValue(value[field.name], field.many);
      }
    }

    return out;
  };

  /**
   * A dynamic zone. Order is content here, not presentation - the second
   * paragraph is second - so this is the one list that is never sorted.
   */
  const zoneValue = (value: any, options: Options): unknown[] => {
    if (!Array.isArray(value)) return [];

    return value.map((entry) => {
      const uid = entry?.__component;
      if (!uid) return {};
      const plan = schema().componentPlan(uid);
      return { __component: uid, ...(componentValue(entry, plan, options) as object) };
    });
  };

  /**
   * A relation, as the key that identifies the same document anywhere.
   *
   * Sorted, because a to-many relation has no inherent order and the database
   * is free to return it differently on two identical machines. An unsorted
   * list here is a file that shows a spurious change on every export.
   */
  const relationValue = (value: any, many: boolean): unknown => {
    if (many) {
      const list = Array.isArray(value) ? value : value ? [value] : [];
      return list
        .map(keyOf)
        .filter((key): key is string => key !== null)
        .sort();
    }

    return keyOf(Array.isArray(value) ? value[0] : value);
  };

  /**
   * A media field, as a description of a file rather than the file.
   *
   * Ferry moves content, not binaries. What travels is enough to find the same
   * upload on the far side - the hash first, which is content-addressed and so
   * survives a different filename - and enough for a person reading the file to
   * see what was meant if it is not found.
   */
  const mediaValue = (value: any, many: boolean): unknown => {
    const one = (file: any) =>
      file
        ? {
            name: file.name ?? null,
            url: file.url ?? null,
            hash: file.hash ?? null,
            ext: file.ext ?? null,
            mime: file.mime ?? null,
            size: file.size ?? null,
          }
        : null;

    if (many) {
      const list = Array.isArray(value) ? value : value ? [value] : [];
      return list.map(one);
    }

    return one(Array.isArray(value) ? value[0] : value);
  };

  /**
   * The whole document.
   *
   * Field order follows the schema, and the schema is the same file on both
   * machines, so two exports of the same content are byte-identical.
   */
  const document = (raw: any, plan: Plan, options: Options): ExportedDocument => {
    const out: Record<string, unknown> = { documentId: raw.documentId };

    for (const field of plan.scalars) {
      if (field.name in raw) out[field.name] = raw[field.name];
    }

    for (const component of plan.components) {
      if (!(component.name in raw)) continue;
      const componentSchema = schema().componentPlan(component.component);
      out[component.name] = component.repeatable
        ? (raw[component.name] ?? []).map((item: unknown) =>
            componentValue(item, componentSchema, options)
          )
        : componentValue(raw[component.name], componentSchema, options);
    }

    for (const zone of plan.dynamicZones) {
      if (!(zone.name in raw)) continue;
      out[zone.name] = zoneValue(raw[zone.name], options);
    }

    if (options.relations) {
      for (const relation of plan.relations) {
        if (!(relation.name in raw)) continue;
        out[relation.name] = relationValue(raw[relation.name], relation.many);
      }
    }

    if (options.media) {
      for (const field of plan.media) {
        if (!(field.name in raw)) continue;
        out[field.name] = mediaValue(raw[field.name], field.many);
      }
    }

    if (plan.localized && raw.locale) out.locale = raw.locale;

    return out as ExportedDocument;
  };

  return { document, componentValue, zoneValue, relationValue, mediaValue };
};
