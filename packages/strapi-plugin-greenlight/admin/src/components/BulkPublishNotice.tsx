import * as React from 'react';

import { useFetchClient } from '@strapi/admin/strapi-admin';
import { Flex, Typography } from '@strapi/design-system';

import { routes } from '../api';
import type { AssignmentState } from '../api';

/**
 * Injected into the Content Manager's bulk-publish confirmation dialog.
 *
 * This is the one place the editor can be told the truth *before* it costs them
 * anything. A refused document makes the whole call fail, and they find out
 * through a single error naming one entry out of however many they ticked —
 * which is a poor way to learn that three of them were never going to go out.
 */
export const BulkPublishNotice = ({ documents, model }: { documents?: any[]; model?: string }) => {
  const { get } = useFetchClient();
  const [blocked, setBlocked] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const rows = documents ?? [];
    if (!model || rows.length === 0) return;

    Promise.all(
      rows.map(async (row: any) => {
        try {
          const { data } = await get<AssignmentState>(routes.assignment(model, row.documentId), {
            params: row.locale ? { locale: row.locale } : {},
          });
          if (!data.workflow || data.isPublishable) return null;
          return String(row.documentId);
        } catch {
          // Unknown is not the same as blocked; the server still decides.
          return null;
        }
      })
    ).then((results) => {
      if (!cancelled) setBlocked(results.filter(Boolean) as string[]);
    });

    return () => {
      cancelled = true;
    };
  }, [get, documents, model]);

  if (!blocked || blocked.length === 0) return null;

  const total = documents?.length ?? 0;

  return (
    <Flex direction="column" alignItems="center" paddingTop={3} gap={1}>
      <Typography textColor="danger600" fontWeight="bold">
        {blocked.length} of {total} selected {total === 1 ? 'entry has' : 'entries have'} not been
        approved.
      </Typography>
      <Typography variant="pi" textColor="neutral600">
        Publishing will be refused. Approve them first, or narrow your selection.
      </Typography>
    </Flex>
  );
};
