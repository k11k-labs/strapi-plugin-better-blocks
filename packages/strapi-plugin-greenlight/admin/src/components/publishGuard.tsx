import * as React from 'react';

import { useFetchClient } from '@strapi/admin/strapi-admin';

import { REVIEW_CHANGED } from '../api';
import { loadReviewState } from '../reviewBatch';
import type { ReviewEntry } from '../reviewBatch';

/**
 * Whether the gate will let this document be published, and what is holding it.
 *
 * The answer comes from the server rather than from re-reading the workflow's
 * rules here: `onMissingAssignment` alone means a document with no stage at all
 * can be perfectly publishable, and any second implementation of that gets it
 * wrong eventually. See `gate.publishable`.
 *
 * Requests are batched and cached in `reviewBatch` - shared with the list
 * view's stage column, so a page of rows asks once in total rather than once
 * per row per feature.
 */
const usePublishable = (
  model?: string,
  documentId?: string,
  locale?: string | null
): { known: boolean; publishable: boolean; stageName?: string } => {
  const { get } = useFetchClient();
  const [entry, setEntry] = React.useState<ReviewEntry | null>(null);
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

    loadReviewState(get, model, documentId, locale).then((data) => {
      if (cancelled) return;
      setEntry(data);
      setKnown(true);
    });

    return () => {
      cancelled = true;
    };
  }, [get, model, documentId, locale, nonce]);

  // No workflow, or a request that failed: no opinion, and the button stays as
  // the Content Manager drew it. The server-side gate is the real enforcement.
  if (!entry?.workflow || !entry.state) return { known, publishable: true };

  return {
    known,
    publishable: entry.state.publishable,
    stageName: entry.state.stageName ?? undefined,
  };
};

/**
 * Disables the Publish button when the document has not been approved.
 *
 * A courtesy, not the enforcement. The gate is a document-service middleware on
 * the server and applies to every route in - the edit view, the list view, the
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
