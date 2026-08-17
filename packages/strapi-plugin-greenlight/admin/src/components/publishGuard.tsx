import * as React from 'react';

import { useFetchClient } from '@strapi/admin/strapi-admin';

import { REVIEW_CHANGED, routes } from '../api';
import type { AssignmentState } from '../api';

type Fetcher = ReturnType<typeof useFetchClient>['get'];

/**
 * One in-flight request per document, shared by every caller.
 *
 * The Content Manager renders document actions once per row in the list view as
 * well as once in the edit view, and re-renders them freely. Without this cache a
 * ten-row page produced two hundred requests for the same handful of documents —
 * measured, not theorised.
 *
 * Cleared wholesale on a stage change rather than surgically: the entries are
 * cheap to refetch and a stale "approved" is the one state worth never showing.
 */
const cache = new Map<string, Promise<AssignmentState | null>>();

const keyOf = (uid: string, documentId: string, locale?: string | null) =>
  `${uid}|${documentId}|${locale ?? ''}`;

const fetchState = (
  get: Fetcher,
  uid: string,
  documentId: string,
  locale?: string | null
): Promise<AssignmentState | null> => {
  const key = keyOf(uid, documentId, locale);
  const hit = cache.get(key);
  if (hit) return hit;

  const request = get<AssignmentState>(routes.assignment(uid, documentId), {
    params: locale ? { locale } : {},
  })
    .then(({ data }) => data)
    // Never disable the button because a request failed. The server-side gate is
    // the real enforcement, and a broken panel must not also break publishing
    // for content that is not under review at all.
    .catch(() => null);

  cache.set(key, request);
  return request;
};

if (typeof window !== 'undefined') {
  window.addEventListener(REVIEW_CHANGED, () => cache.clear());
}

const usePublishable = (
  model?: string,
  documentId?: string,
  locale?: string | null
): { known: boolean; publishable: boolean; stageName?: string } => {
  const { get } = useFetchClient();
  const [state, setState] = React.useState<AssignmentState | null>(null);
  const [known, setKnown] = React.useState(false);
  /** Bumped on a stage change, to re-read after the cache is cleared. */
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    const onChanged = () => setNonce((value) => value + 1);
    window.addEventListener(REVIEW_CHANGED, onChanged);
    return () => window.removeEventListener(REVIEW_CHANGED, onChanged);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    if (!model || !documentId) {
      setKnown(true);
      return;
    }

    fetchState(get, model, documentId, locale).then((data) => {
      if (cancelled) return;
      setState(data);
      setKnown(true);
    });

    return () => {
      cancelled = true;
    };
  }, [get, model, documentId, locale, nonce]);

  if (!state?.workflow) return { known, publishable: true };

  return {
    known,
    publishable: state.isPublishable,
    stageName: state.currentStage?.name,
  };
};

/**
 * Disables the Publish button when the document has not been approved.
 *
 * A courtesy, not the enforcement. The gate is a document-service middleware on
 * the server and applies to every route in — the edit view, the list view, the
 * REST admin API and anyone's own code. Disabling the button only saves the
 * editor a click that was always going to fail, which is the same reason the
 * panel hides stages their role cannot move into.
 */
export const withPublishGuard = (actions: any[]): any[] =>
  actions.map((action) => {
    const wrapped = (props: any) => {
      const description = action(props);
      const { known, publishable, stageName } = usePublishable(
        props?.model,
        props?.documentId,
        props?.document?.locale
      );

      if (!description || description.type !== 'publish') return description;
      if (!known || publishable) return description;

      return {
        ...description,
        disabled: true,
        label: stageName ? `Publish (needs approval: ${stageName})` : 'Publish (needs approval)',
      };
    };

    // The Content Manager reads type/position off the component itself.
    Object.assign(wrapped, action);
    return wrapped;
  });
