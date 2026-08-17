import type { useFetchClient } from '@strapi/admin/strapi-admin';

import { REVIEW_CHANGED, routes } from './api';
import type { AssignmentsPage, DocumentReviewState } from './api';

type Fetcher = ReturnType<typeof useFetchClient>['get'];

export interface ReviewEntry {
  /** Null when this content type is not under any workflow. */
  workflow: AssignmentsPage['workflow'];
  /** Null only when the request failed. */
  state: DocumentReviewState | null;
}

const NO_OPINION: ReviewEntry = { workflow: null, state: null };

/**
 * One resolved answer per document, shared by every caller.
 *
 * The list view asks about the same documents from two places at once - the
 * stage column once per row, and the Publish action once per row on top of that
 * - and the Content Manager re-renders both freely. Without this a ten-row page
 * produced hundreds of requests for ten documents.
 *
 * Cleared wholesale on a stage change rather than surgically: the entries are
 * cheap to refetch, and a stale "approved" is the one state worth never showing.
 */
const answers = new Map<string, Promise<ReviewEntry>>();

interface Batch {
  ids: Set<string>;
  promise: Promise<AssignmentsPage>;
  dispatched: boolean;
}

const batches = new Map<string, Batch>();

const pageKey = (uid: string, locale?: string | null) => `${uid}|${locale ?? ''}`;

/**
 * Collect every document asked about in this tick, then ask once.
 *
 * The Content Manager hands each cell and each row action only its own row, so
 * the batching has to happen here. `setTimeout(0)` is what defines "this tick"
 * - a microtask would fire between React's own render passes and split one page
 * into several requests.
 */
const openBatch = (get: Fetcher, uid: string, locale: string | null | undefined): Batch => {
  const key = pageKey(uid, locale);
  const open = batches.get(key);
  if (open && !open.dispatched) return open;

  const batch: Batch = { ids: new Set(), dispatched: false, promise: null as never };

  batch.promise = new Promise<AssignmentsPage>((resolve, reject) => {
    setTimeout(() => {
      batch.dispatched = true;
      // Leave the map only if we are still the open batch, so a page that
      // started rendering while this one was in flight keeps its own.
      if (batches.get(key) === batch) batches.delete(key);

      get<AssignmentsPage>(routes.assignments(uid), {
        params: {
          documentIds: [...batch.ids].join(','),
          ...(locale ? { locale } : {}),
        },
      })
        .then(({ data }) => resolve(data))
        .catch(reject);
    }, 0);
  });

  batches.set(key, batch);
  return batch;
};

export const loadReviewState = (
  get: Fetcher,
  uid: string,
  documentId: string,
  locale?: string | null
): Promise<ReviewEntry> => {
  const key = `${pageKey(uid, locale)}|${documentId}`;
  const hit = answers.get(key);
  if (hit) return hit;

  const batch = openBatch(get, uid, locale);
  batch.ids.add(documentId);

  const entry = batch.promise
    .then((page) => ({ workflow: page.workflow, state: page.documents?.[documentId] ?? null }))
    .catch(() => {
      // Not remembered, so the next render can try again. A failure must read as
      // "no opinion" rather than "not publishable" - the server-side gate is the
      // real enforcement, and a broken request must not also stop publishing for
      // content that is not under review at all.
      answers.delete(key);
      return NO_OPINION;
    });

  answers.set(key, entry);
  return entry;
};

if (typeof window !== 'undefined') {
  window.addEventListener(REVIEW_CHANGED, () => answers.clear());
}
