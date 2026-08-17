/**
 * Turning a stored document into a version, and back.
 *
 * Written for this plugin rather than lifted from Strapi's own history module.
 * Where the shapes here resemble theirs it is because Strapi's populate API
 * dictates them - a relation can only be populated by naming its fields, a
 * dynamic zone only through `on` fragments - not because the code was copied.
 * Their implementation is MIT and was read while working out what the problem
 * actually is; two facts learned that way are worth stating outright, since
 * both cost a day if you meet them the hard way:
 *
 *   - a component's `id` must not be stored, or restoring into a component row
 *     that has since been recreated throws;
 *   - the fields in FIELDS_TO_IGNORE change on every write, so a version that
 *     keeps them can never be compared against another one.
 *
 * `buildSchemaSnapshot` goes further than theirs on purpose: Strapi's descends a
 * single level and carries an open TODO about nested components, which leaves a
 * component inside a component indistinguishable from a field that never
 * existed.
 */
import type { Core } from '@strapi/strapi';

/**
 * Identity, not content. `id` is the dangerous one: it is what a restore would
 * try to write back into a row that has since been recreated. The rest live in
 * their own columns on the version.
 */
const IDENTITY_FIELDS = ['id', 'documentId', 'locale'];

/**
 * Fields Strapi manages, which a version has no business storing or restoring.
 *
 * The timestamps and author columns change on every write, so a version that
 * keeps them can never be compared with another. `locale` and `localizations`
 * are injected by i18n and describe how the document is wired up rather than
 * what it says - restoring them would try to rewrite the translation graph.
 */
export const FIELDS_TO_IGNORE = [
  'createdAt',
  'updatedAt',
  'publishedAt',
  'createdBy',
  'updatedBy',
  'strapi_stage',
  'strapi_assignee',
  'locale',
  'localizations',
];

export interface RelationRef {
  documentId?: string;
  /** Media lives in `plugin::upload.file` and is addressed by numeric id. */
  id?: number;
  locale?: string | null;
  targetUid: string;
}

export interface SplitDocument {
  data: Record<string, unknown>;
  relations: Record<string, RelationRef[]>;
  schemaSnapshot: Record<string, unknown>;
}

type Attribute = Record<string, any>;

/**
 * `strapi.getModel` is typed for literal uids, and every uid here arrives as a
 * runtime string. One cast, in one place, rather than a scattering of them.
 */
const getModel = (strapi: Core.Strapi, uid: string): { attributes: Record<string, Attribute> } =>
  strapi.getModel(uid as never) as unknown as {
    attributes: Record<string, Attribute>;
  };

const isRelationLike = (attribute: Attribute): boolean =>
  attribute?.type === 'relation' || attribute?.type === 'media';

/** Morph relations are skipped: Strapi's own populate builder skips them too. */
export const isMorphRelation = (attribute: Attribute): boolean =>
  attribute?.type === 'relation' &&
  String(attribute.relation ?? '')
    .toLowerCase()
    .startsWith('morph');

/**
 * Every scalar field of a component except its id.
 *
 * The id is the point: a component row is deleted and recreated on write, so a
 * snapshot that remembers the old id restores into a row that no longer exists.
 */
const componentFields = (strapi: Core.Strapi, componentUid: string): string[] =>
  Object.entries(getModel(strapi, componentUid).attributes)
    .filter(
      ([, attribute]: [string, Attribute]) =>
        !['relation', 'media', 'component', 'dynamiczone'].includes(attribute.type)
    )
    .map(([name]) => name);

/** Populate object covering everything a snapshot needs, and nothing more. */
export const buildDeepPopulate = (
  strapi: Core.Strapi,
  uid: string,
  useDatabaseSyntax = true
): Record<string, unknown> => {
  const model = getModel(strapi, uid);
  const fieldSelector = useDatabaseSyntax ? 'select' : 'fields';

  return Object.entries(model.attributes).reduce(
    (acc: Record<string, unknown>, [name, attribute]: [string, Attribute]) => {
      switch (attribute.type) {
        case 'relation': {
          if (isMorphRelation(attribute)) break;
          // Only what identifies the target - never the target itself.
          acc[name] = { [fieldSelector]: ['documentId', 'locale', 'publishedAt'] };
          break;
        }
        case 'media': {
          acc[name] = { [fieldSelector]: ['id'] };
          break;
        }
        case 'component': {
          acc[name] = {
            populate: buildDeepPopulate(strapi, attribute.component, useDatabaseSyntax),
            [fieldSelector]: componentFields(strapi, attribute.component),
          };
          break;
        }
        case 'dynamiczone': {
          acc[name] = {
            on: (attribute.components ?? []).reduce(
              (fragments: Record<string, unknown>, componentUid: string) => {
                fragments[componentUid] = {
                  populate: buildDeepPopulate(strapi, componentUid, useDatabaseSyntax),
                  [fieldSelector]: componentFields(strapi, componentUid),
                };
                return fragments;
              },
              {}
            ),
          };
          break;
        }
        default:
          break;
      }
      return acc;
    },
    {}
  );
};

/**
 * The content type's attributes plus every component reachable from it, however
 * deeply nested.
 *
 * Without the nesting a restore cannot tell "this field was empty" from "this
 * field did not exist yet" for anything below the first level of components.
 */
export const buildSchemaSnapshot = (strapi: Core.Strapi, uid: string): Record<string, unknown> => {
  const components: Record<string, unknown> = {};

  const visit = (modelUid: string) => {
    if (components[modelUid]) return;
    const attributes = getModel(strapi, modelUid).attributes;
    components[modelUid] = omit(attributes, FIELDS_TO_IGNORE);

    for (const attribute of Object.values(attributes)) {
      if (attribute.type === 'component') visit(attribute.component);
      if (attribute.type === 'dynamiczone') {
        for (const componentUid of attribute.components ?? []) visit(componentUid);
      }
    }
  };

  const attributes = getModel(strapi, uid).attributes;
  for (const attribute of Object.values(attributes)) {
    if (attribute.type === 'component') visit(attribute.component);
    if (attribute.type === 'dynamiczone') {
      for (const componentUid of attribute.components ?? []) visit(componentUid);
    }
  }

  return {
    attributes: omit(attributes, FIELDS_TO_IGNORE),
    components,
  };
};

const omit = <T extends Record<string, unknown>>(source: T, keys: string[]): T =>
  Object.fromEntries(Object.entries(source ?? {}).filter(([key]) => !keys.includes(key))) as T;

const toRefs = (value: unknown, targetUid: string, isMedia: boolean): RelationRef[] => {
  const entries = Array.isArray(value) ? value : [value];

  return entries
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) =>
      isMedia
        ? { id: entry.id as number, targetUid }
        : {
            documentId: entry.documentId as string,
            locale: (entry.locale as string | null) ?? null,
            targetUid,
          }
    );
};

/**
 * Splits a populated entry into the three things a version stores.
 *
 * Relations are kept apart from `data` so a diff can treat "the body changed"
 * and "the author changed" as different kinds of change, and so a restore can
 * check each target still exists before writing it back.
 */
export const split = (
  strapi: Core.Strapi,
  uid: string,
  entry: Record<string, unknown>
): SplitDocument => {
  const attributes = getModel(strapi, uid).attributes;
  const data: Record<string, unknown> = {};
  const relations: Record<string, RelationRef[]> = {};

  const content = omit(entry, [...FIELDS_TO_IGNORE, ...IDENTITY_FIELDS]);

  for (const [name, value] of Object.entries(content)) {
    const attribute = attributes[name];

    if (attribute && isRelationLike(attribute)) {
      if (isMorphRelation(attribute)) continue;
      const targetUid = attribute.type === 'media' ? 'plugin::upload.file' : attribute.target;
      relations[name] = toRefs(value, targetUid, attribute.type === 'media');
      continue;
    }

    data[name] = attribute ? stripComponentIds(strapi, attribute, value) : value;
  }

  return { data, relations, schemaSnapshot: buildSchemaSnapshot(strapi, uid) };
};

/** Walks components and dynamic zones removing `id`, recursively. */
const stripComponentIds = (strapi: Core.Strapi, attribute: Attribute, value: unknown): unknown => {
  if (value == null) return value;

  if (attribute.type === 'component') {
    const clean = (entry: Record<string, unknown>) =>
      cleanComponent(strapi, attribute.component, entry);
    return Array.isArray(value)
      ? value.map((entry) => clean(entry as Record<string, unknown>))
      : clean(value as Record<string, unknown>);
  }

  if (attribute.type === 'dynamiczone' && Array.isArray(value)) {
    return value.map((entry) => {
      const record = entry as Record<string, unknown>;
      return cleanComponent(strapi, record.__component as string, record);
    });
  }

  return value;
};

const cleanComponent = (
  strapi: Core.Strapi,
  componentUid: string,
  entry: Record<string, unknown>
): Record<string, unknown> => {
  if (!entry || !componentUid) return entry;

  const attributes = getModel(strapi, componentUid).attributes;
  const result: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(entry)) {
    if (name === 'id') continue;
    const attribute = attributes[name];
    result[name] = attribute ? stripComponentIds(strapi, attribute, value) : value;
  }

  return result;
};
