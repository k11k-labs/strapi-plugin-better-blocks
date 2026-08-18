import type { Plan } from '../types';

/**
 * Relations do not only live at the top of a document.
 *
 * A component can hold one, and a component inside a component inside a dynamic
 * zone can hold one too. Strapi refuses the entire write when any of them
 * points at something absent, so an importer that only looks at the document's
 * own fields will fail on rows it never inspected and blame the row.
 *
 * These three walks are the same walk with different jobs: find the keys, take
 * the relations out, put the resolvable ones back.
 */

export interface FoundRelation {
  /** Where it was, for a message a person can act on: `seo.author`. */
  path: string;
  target: string;
  keys: string[];
}

type PlanFor = (componentUid: string) => Plan;

const asKeys = (value: unknown): string[] => {
  if (value === null || value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((entry) =>
      typeof entry === 'string'
        ? entry
        : entry && typeof entry === 'object' && 'documentId' in (entry as any)
          ? String((entry as any).documentId)
          : null
    )
    .filter((key): key is string => Boolean(key));
};

const eachComponent = (
  value: unknown,
  plan: Plan,
  planFor: PlanFor,
  path: string,
  visit: (value: Record<string, unknown>, plan: Plan, path: string) => void
): void => {
  for (const component of plan.components) {
    const nested = (value as any)?.[component.name];
    if (!nested) continue;

    const items = component.repeatable ? (Array.isArray(nested) ? nested : []) : [nested];
    const componentPlan = planFor(component.component);

    items.forEach((item: unknown, index: number) => {
      if (!item || typeof item !== 'object') return;
      const here = component.repeatable
        ? `${path}${component.name}[${index}].`
        : `${path}${component.name}.`;
      visit(item as Record<string, unknown>, componentPlan, here);
      eachComponent(item, componentPlan, planFor, here, visit);
    });
  }

  for (const zone of plan.dynamicZones) {
    const entries = (value as any)?.[zone.name];
    if (!Array.isArray(entries)) continue;

    entries.forEach((entry: any, index: number) => {
      if (!entry?.__component) return;
      const zonePlan = planFor(entry.__component);
      const here = `${path}${zone.name}[${index}].`;
      visit(entry, zonePlan, here);
      eachComponent(entry, zonePlan, planFor, here, visit);
    });
  }
};

/** Every relation key in the document, however deep, with where it came from. */
export const collectRelations = (
  document: Record<string, unknown>,
  plan: Plan,
  planFor: PlanFor
): FoundRelation[] => {
  const found: FoundRelation[] = [];

  const take = (value: Record<string, unknown>, at: Plan, path: string) => {
    for (const relation of at.relations) {
      if (!(relation.name in value)) continue;
      const keys = asKeys(value[relation.name]);
      if (keys.length === 0) continue;
      found.push({ path: `${path}${relation.name}`, target: relation.target, keys });
    }
  };

  take(document, plan, '');
  eachComponent(document, plan, planFor, '', take);

  return found;
};

/**
 * A copy with every relation removed, at every depth.
 *
 * What the first pass writes. Every document in the file has to exist before
 * any of them can point at another, so the first pass carries the content and
 * the second pass carries the wiring.
 */
export const stripRelations = (
  value: Record<string, unknown>,
  plan: Plan,
  planFor: PlanFor
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (plan.relations.some((relation) => relation.name === key)) continue;
    out[key] = entry;
  }

  for (const component of plan.components) {
    if (!(component.name in out)) continue;
    const componentPlan = planFor(component.component);
    const nested = out[component.name];

    out[component.name] = component.repeatable
      ? (Array.isArray(nested) ? nested : []).map((item) =>
          item && typeof item === 'object'
            ? stripRelations(item as Record<string, unknown>, componentPlan, planFor)
            : item
        )
      : nested && typeof nested === 'object'
        ? stripRelations(nested as Record<string, unknown>, componentPlan, planFor)
        : nested;
  }

  for (const zone of plan.dynamicZones) {
    if (!(zone.name in out)) continue;
    const entries = out[zone.name];
    out[zone.name] = (Array.isArray(entries) ? entries : []).map((entry: any) =>
      entry?.__component
        ? {
            __component: entry.__component,
            ...stripRelations(entry, planFor(entry.__component), planFor),
          }
        : entry
    );
  }

  return out;
};

/**
 * A copy with the relations kept, minus the keys that lead nowhere.
 *
 * What the second pass writes. Dropping an unresolvable key rather than passing
 * it on is the difference between a row that lands with one link missing and a
 * row that Strapi refuses outright, taking the content with it.
 */
export const filterRelations = (
  value: Record<string, unknown>,
  plan: Plan,
  planFor: PlanFor,
  exists: (target: string, key: string) => boolean
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...value };

  for (const relation of plan.relations) {
    if (!(relation.name in out)) continue;

    const keys = asKeys(out[relation.name]).filter((key) => exists(relation.target, key));

    if (relation.many) {
      out[relation.name] = keys;
    } else {
      // A single relation with no surviving key is set to null rather than left
      // out: the file said what it should be, and it is not that.
      out[relation.name] = keys[0] ?? null;
    }
  }

  for (const component of plan.components) {
    if (!(component.name in out)) continue;
    const componentPlan = planFor(component.component);
    const nested = out[component.name];

    out[component.name] = component.repeatable
      ? (Array.isArray(nested) ? nested : []).map((item) =>
          item && typeof item === 'object'
            ? filterRelations(item as Record<string, unknown>, componentPlan, planFor, exists)
            : item
        )
      : nested && typeof nested === 'object'
        ? filterRelations(nested as Record<string, unknown>, componentPlan, planFor, exists)
        : nested;
  }

  for (const zone of plan.dynamicZones) {
    if (!(zone.name in out)) continue;
    const entries = out[zone.name];
    out[zone.name] = (Array.isArray(entries) ? entries : []).map((entry: any) =>
      entry?.__component
        ? {
            __component: entry.__component,
            ...filterRelations(entry, planFor(entry.__component), planFor, exists),
          }
        : entry
    );
  }

  return out;
};
