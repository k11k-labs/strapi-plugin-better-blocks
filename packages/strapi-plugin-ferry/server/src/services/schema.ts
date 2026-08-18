import type { Core } from '@strapi/strapi';

import type {
  ComponentField,
  DynamicZoneField,
  MediaField,
  Plan,
  RelationField,
  ScalarField,
} from '../types';
import { PLUGIN_ID, UPLOAD_FILE } from '../uids';

/**
 * Attributes Strapi maintains, which an import must never set.
 *
 * `documentId` is missing from this list on purpose - it is the one piece of
 * bookkeeping Ferry does carry, because it is the identity the whole import
 * turns on. The rest are either Strapi's own record of what happened
 * (`createdAt`, `updatedBy`) or a different feature's business (`localizations`
 * belongs to i18n and is derived from the locale you import into). Copying them
 * across environments would overwrite true local facts with foreign ones.
 */
const MANAGED = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'createdBy',
  'updatedBy',
  'locale',
  'localizations',
  'strapi_stage',
  'strapi_assignee',
]);

/**
 * Types that are stored but must not travel.
 *
 * A `password` attribute is hashed, and a hash is still a credential. Writing
 * one into a file that people mail around and commit is the kind of default
 * nobody notices until it matters, so this is not configurable.
 */
const NEVER_EXPORT = new Set(['password']);

export interface RawAttribute {
  type: string;
  relation?: string;
  target?: string;
  component?: string;
  components?: string[];
  repeatable?: boolean;
  multiple?: boolean;
  required?: boolean;
  private?: boolean;
  mappedBy?: string;
  inversedBy?: string;
  pluginOptions?: Record<string, any>;
}

export interface RawModel {
  uid: string;
  kind?: string;
  modelType?: string;
  options?: { draftAndPublish?: boolean };
  info?: { displayName?: string; singularName?: string };
  attributes?: Record<string, RawAttribute>;
  pluginOptions?: {
    'content-type-builder'?: { visible?: boolean };
    i18n?: { localized?: boolean };
  };
}

const labelOf = (model: RawModel): string =>
  model.info?.displayName ?? model.info?.singularName ?? model.uid;

/**
 * A media attribute is `type: 'media'`, but a plain relation pointing at
 * `plugin::upload.file` is the same thing wearing different clothes - some
 * older schemas and a few plugins declare it that way. Both have to land in the
 * media bucket, or one of them gets treated as ordinary content and exports a
 * file row's primary key as if it were a document.
 */
const isMedia = (attribute: RawAttribute): boolean =>
  attribute.type === 'media' || (attribute.type === 'relation' && attribute.target === UPLOAD_FILE);

/**
 * The sorting itself, over nothing but a bag of attributes.
 *
 * Kept free of Strapi so that a content type and a component - which are the
 * same thing where fields are concerned, and different things everywhere else -
 * can share it without either pretending to be the other.
 */
const sortAttributes = (
  attributes: Record<string, RawAttribute>
): Pick<Plan, 'scalars' | 'relations' | 'components' | 'dynamicZones' | 'media' | 'skipped'> => {
  const scalars: ScalarField[] = [];
  const relations: RelationField[] = [];
  const components: ComponentField[] = [];
  const dynamicZones: DynamicZoneField[] = [];
  const media: MediaField[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];

  for (const [name, attribute] of Object.entries(attributes)) {
    if (MANAGED.has(name)) {
      skipped.push({ name, reason: 'managed by Strapi' });
      continue;
    }

    if (NEVER_EXPORT.has(attribute.type)) {
      skipped.push({ name, reason: `${attribute.type} fields are never exported` });
      continue;
    }

    if (isMedia(attribute)) {
      media.push({
        name,
        many: attribute.multiple === true || (attribute.relation ?? '').endsWith('Many'),
      });
      continue;
    }

    if (attribute.type === 'relation') {
      if (!attribute.target) {
        skipped.push({ name, reason: 'relation without a target' });
        continue;
      }
      relations.push({
        name,
        target: attribute.target,
        many: (attribute.relation ?? '').endsWith('Many'),
      });
      continue;
    }

    if (attribute.type === 'component') {
      if (!attribute.component) {
        skipped.push({ name, reason: 'component without a target' });
        continue;
      }
      components.push({
        name,
        component: attribute.component,
        repeatable: attribute.repeatable === true,
      });
      continue;
    }

    if (attribute.type === 'dynamiczone') {
      dynamicZones.push({ name, components: attribute.components ?? [] });
      continue;
    }

    scalars.push({ name, type: attribute.type });
  }

  return { scalars, relations, components, dynamicZones, media, skipped };
};

const schema = ({ strapi }: { strapi: Core.Strapi }) => {
  const self = {
    model(uid: string): RawModel | undefined {
      return (strapi.contentTypes as unknown as Record<string, RawModel>)[uid];
    },

    component(uid: string): RawModel | undefined {
      return (strapi.components as unknown as Record<string, RawModel>)?.[uid];
    },

    /**
     * Sort one content type's attributes into how each has to be carried.
     *
     * Everything downstream - the populate call, the CSV header, the two import
     * passes - reads this and nothing else, so there is exactly one place that
     * decides what a field is.
     */
    plan(uid: string): Plan {
      const model = self.model(uid);
      if (!model) throw new Error(`[ferry] unknown content type: ${uid}`);

      return {
        uid,
        kind: model.kind === 'singleType' ? 'singleType' : 'collectionType',
        draftAndPublish: model.options?.draftAndPublish === true,
        localized: model.pluginOptions?.i18n?.localized === true,
        ...sortAttributes(model.attributes ?? {}),
      };
    },

    /**
     * The same sorting for a component, which needs it too: components nest,
     * and a component three levels down still has relations to resolve.
     */
    componentPlan(uid: string): Plan {
      const model = self.component(uid);
      if (!model) throw new Error(`[ferry] unknown component: ${uid}`);

      return {
        uid,
        kind: 'collectionType',
        draftAndPublish: false,
        localized: false,
        ...sortAttributes(model.attributes ?? {}),
      };
    },

    /** Uids the project has put out of bounds in its plugin config. */
    excluded(): Set<string> {
      const configured = strapi.plugin(PLUGIN_ID)?.config('exclude');
      return new Set(Array.isArray(configured) ? configured : []);
    },

    /**
     * Whether Ferry may touch this content type at all.
     *
     * Checked by the endpoints as well as the picker. A hidden thing that can
     * still be fetched by typing its uid is not hidden, and the reason someone
     * excludes a content type is usually that its contents must not leave.
     */
    allowed(uid: string): boolean {
      return uid.startsWith('api::') && !self.excluded().has(uid);
    },

    /**
     * What Ferry will carry, for the picker in the admin panel.
     *
     * Only the project's own types. Strapi's internal tables are real content
     * types, but exporting the admin user table or the upload file index moves
     * infrastructure rather than content, and importing it into another
     * environment breaks that environment.
     */
    catalogue(): Array<{ uid: string; label: string; kind: string; count?: number }> {
      return Object.values(strapi.contentTypes as unknown as Record<string, RawModel>)
        .filter((model) => self.allowed(model.uid))
        .map((model) => ({
          uid: model.uid,
          label: labelOf(model),
          kind: model.kind === 'singleType' ? 'singleType' : 'collectionType',
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
  };

  return self;
};

export default schema;
