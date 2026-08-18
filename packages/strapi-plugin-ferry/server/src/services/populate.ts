import type { Core } from '@strapi/strapi';

import type { Plan } from '../types';

/**
 * Components can nest, and a schema that nests them wrongly would spin here.
 * The Content-Type Builder refuses to create a cycle, but a schema written by
 * hand is not obliged to be sensible and a stack overflow is a bad way to find
 * out.
 */
const MAX_DEPTH = 10;

/** Enough of a file to identify it on the far side without carrying the bytes. */
export const MEDIA_FIELDS = ['name', 'url', 'hash', 'ext', 'mime', 'size'];

interface Options {
  relations: boolean;
  media: boolean;
}

/**
 * The populate argument, built from the schema rather than guessed.
 *
 * This is the difference between an export that contains a document's
 * components and one that contains `[object Object]`, and it is where a naive
 * implementation reaches for `populate: '*'` - which goes exactly one level
 * deep. One level is enough for a component and not enough for a component
 * inside a component, so half of a real schema comes out empty and nobody
 * notices until the import is missing content.
 */
export const buildPopulate = (
  strapi: Core.Strapi,
  plan: Plan,
  options: Options,
  depth = 0
): Record<string, unknown> => {
  const populate: Record<string, unknown> = {};
  if (depth > MAX_DEPTH) return populate;

  const schema = strapi.plugin('ferry').service('schema');

  if (options.relations) {
    for (const relation of plan.relations) {
      // Only the key travels. The related document exports itself, in its own
      // file, on its own terms.
      populate[relation.name] = { fields: ['documentId'] };
    }
  }

  if (options.media) {
    for (const field of plan.media) {
      populate[field.name] = { fields: MEDIA_FIELDS };
    }
  }

  for (const component of plan.components) {
    const nested = buildPopulate(
      strapi,
      schema.componentPlan(component.component),
      options,
      depth + 1
    );
    populate[component.name] =
      Object.keys(nested).length > 0 ? { populate: nested } : { populate: {} };
  }

  for (const zone of plan.dynamicZones) {
    // A dynamic zone holds different shapes in one field, so Strapi wants the
    // populate spelled out per member rather than shared.
    const on: Record<string, unknown> = {};
    for (const member of zone.components) {
      const nested = buildPopulate(strapi, schema.componentPlan(member), options, depth + 1);
      on[member] = Object.keys(nested).length > 0 ? { populate: nested } : {};
    }
    populate[zone.name] = { on };
  }

  return populate;
};
