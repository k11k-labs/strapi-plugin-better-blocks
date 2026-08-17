import { getFetchClient } from '@strapi/admin/strapi-admin';

import { routes } from './api';
import type { Stage, Workflow } from './api';

const STORAGE_KEY = 'greenlight:coverage';

/**
 * Which content types are under review, and with which stages.
 *
 * Both list-view extensions have to decide *synchronously* whether to exist -
 * they are plain functions inside a `useMemo`, they cannot await, and nothing
 * re-runs them when a fetch lands. The answer they need lives in the database,
 * because which content types are covered is configured in the admin panel
 * rather than in the schemas. That is the whole point of the design, and it is
 * also why this cache exists.
 *
 * `sessionStorage` carries it across reloads. The one case it is wrong is the
 * very first list view opened in a brand-new session before the priming fetch
 * returns, where the column and filter are missing until the next navigation.
 * Wrong for one render beats an empty "Review stage" column on every collection
 * that has nothing to do with reviews.
 */
let coverage: Map<string, Stage[]> | null = readCache();
let priming: Promise<void> | null = null;

function readCache(): Map<string, Stage[]> | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? new Map(JSON.parse(raw) as Array<[string, Stage[]]>) : null;
  } catch {
    // Private mode, or someone put junk in the key. Neither is worth a crash.
    return null;
  }
}

function writeCache(next: Map<string, Stage[]>): void {
  coverage = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    /* The in-memory copy still works for this tab. */
  }
}

/** The stages of the workflow covering this content type, or null if none does. */
export const stagesFor = (uid: string): Stage[] | null => coverage?.get(uid) ?? null;

/**
 * How long a successful answer is trusted before another list view will ask
 * again.
 *
 * Both hooks call this on every render of a list view, so without a floor a
 * single page load asks two or three times for something that changes when
 * somebody edits a workflow. Coverage edits are not left to expire: the
 * settings page calls this with `force` the moment one is saved.
 */
const MIN_REFRESH_MS = 30_000;

let lastPrimed = 0;

/**
 * Refresh the cache. Safe to call often - concurrent calls share one request,
 * and a failure (a 401 before login, most likely) is swallowed so that the next
 * call can try again.
 */
export const primeCoverage = ({ force = false } = {}): Promise<void> => {
  if (priming) return priming;
  if (!force && coverage && Date.now() - lastPrimed < MIN_REFRESH_MS) {
    return Promise.resolve();
  }

  priming = getFetchClient()
    .get<{ workflows: Workflow[] }>(routes.workflows)
    .then(({ data }) => {
      const next = new Map<string, Stage[]>();
      for (const workflow of data.workflows ?? []) {
        for (const uid of workflow.contentTypes ?? []) {
          next.set(
            uid,
            [...(workflow.stages ?? [])].sort((a, b) => a.order - b.order)
          );
        }
      }
      writeCache(next);
      lastPrimed = Date.now();
    })
    .catch(() => {
      /* Not signed in yet, or no permission. Try again next time. */
    })
    .finally(() => {
      priming = null;
    });

  return priming;
};

/**
 * Which content type a Content Manager list view is showing.
 *
 * Not available from either hook's payload - they carry the list layout, which
 * is fields, settings and metadata, and nothing that names the content type.
 * The route does: `/content-manager/collection-types/:uid` is where the page's
 * own `model` comes from, and the hooks only ever run while it is rendering.
 * Not anchored at the start, because the admin can be mounted under a base path.
 */
export const modelFromPath = (): string | null => {
  const match = window.location.pathname.match(/\/content-manager\/collection-types\/([^/?#]+)/);

  return match ? decodeURIComponent(match[1]) : null;
};
