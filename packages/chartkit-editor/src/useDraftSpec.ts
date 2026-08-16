/**
 * The draft a dialog edits, and the one rule about when it is thrown away.
 *
 * Its own module because that rule is logic, not markup, and getting it wrong
 * destroys an author's work rather than merely looking wrong — which is worth
 * being able to test without standing up a modal.
 */

import * as React from 'react';

import type { ChartSpec } from '@qkix/chartkit-core';

/**
 * Holds an editable copy of `spec`, reset each time `open` goes from false to
 * true.
 *
 * **The opening edge, not every change to `spec`.** Reopening after a cancel
 * has to start from what is actually stored, so something must reset it. But
 * resetting whenever the `spec` prop changes identity would mean a host that
 * rebuilds its spec object on render — easy to do by accident, and something a
 * Strapi edit view provokes on every keystroke in any other field on the page —
 * wipes out a chart from under whoever is building it.
 */
export function useDraftSpec(spec: ChartSpec, open: boolean) {
  const [draft, setDraft] = React.useState(spec);
  const wasOpen = React.useRef(open);

  React.useEffect(() => {
    if (open && !wasOpen.current) setDraft(spec);
    wasOpen.current = open;
  }, [open, spec]);

  return [draft, setDraft] as const;
}
