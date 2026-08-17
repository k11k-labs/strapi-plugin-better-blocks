import * as React from 'react';

import { useFetchClient } from '@strapi/admin/strapi-admin';

import { routes } from '../api';
import type { AssignmentState } from '../api';

/**
 * Whether this document is allowed to be published, according to the server.
 *
 * `undefined` while unknown, so a caller can tell "not loaded yet" from "no",
 * and never disables a button on a guess.
 */
const usePublishable = (
  model?: string,
  documentId?: string,
  locale?: string | null
): { known: boolean; publishable: boolean; stageName?: string } => {
  const { get } = useFetchClient();
  const [state, setState] = React.useState<AssignmentState | null>(null);
  const [known, setKnown] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!model || !documentId) {
      setKnown(true);
      return;
    }

    get<AssignmentState>(routes.assignment(model, documentId), {
      params: locale ? { locale } : {},
    })
      .then(({ data }) => {
        if (cancelled) return;
        setState(data);
        setKnown(true);
      })
      .catch(() => {
        // Never disable the button because a request failed — the server-side
        // gate is the real enforcement, and a broken panel must not also break
        // publishing for content that is not under review at all.
        if (!cancelled) setKnown(true);
      });

    return () => {
      cancelled = true;
    };
  }, [get, model, documentId, locale]);

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
 * This is a courtesy, not the enforcement. The gate lives in a document-service
 * middleware on the server and applies to every route in — the edit view, the
 * list view, the REST admin API, and anyone's own code. Disabling the button
 * only saves the editor from a click that was always going to fail, which is
 * the same reason the panel hides stages a role may not move into.
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

    // The Content Manager reads these off the component itself.
    Object.assign(wrapped, action);
    return wrapped;
  });
