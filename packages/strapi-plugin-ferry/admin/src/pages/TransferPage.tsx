import * as React from 'react';

import { Layouts, Page, useFetchClient } from '@strapi/admin/strapi-admin';
import { Box, Flex, Loader, Typography } from '@strapi/design-system';

import { ExportPanel } from '../components/ExportPanel';
import { ImportPanel } from '../components/ImportPanel';
import { routes } from '../api';
import type { CatalogueEntry } from '../api';

const Panel = ({ children }: { children: React.ReactNode }) => (
  <Box
    padding={6}
    hasRadius
    background="neutral0"
    borderColor="neutral200"
    borderWidth="1px"
    borderStyle="solid"
    flex="1"
    minWidth="380px"
  >
    {children}
  </Box>
);

/**
 * Both directions on one page.
 *
 * Not tabs: taking a copy out of one environment and putting it into another is
 * one job done twice, and hiding half of it behind a tab makes the second half
 * feel like a different tool.
 */
export const TransferPage = () => {
  const { get } = useFetchClient();

  const [contentTypes, setContentTypes] = React.useState<CatalogueEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    get<{ contentTypes: CatalogueEntry[] }>(routes.contentTypes)
      .then(({ data }) => alive && setContentTypes(data.contentTypes))
      .catch(() => alive && setError('Could not read the list of content types.'))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [get]);

  return (
    <Page.Main>
      <Layouts.Header
        title="Ferry"
        subtitle="Move content in and out as JSON or CSV, with relations and components intact"
      />

      <Layouts.Content>
        {loading ? (
          <Flex justifyContent="center" padding={10}>
            <Loader small>Reading the schema</Loader>
          </Flex>
        ) : error ? (
          <Typography textColor="danger600">{error}</Typography>
        ) : contentTypes.length === 0 ? (
          <Flex direction="column" gap={2} padding={10} alignItems="center">
            <Typography variant="delta">Nothing to carry yet</Typography>
            <Typography textColor="neutral600">
              Create a content type, and it will show up here.
            </Typography>
          </Flex>
        ) : (
          <Flex gap={6} alignItems="flex-start" wrap="wrap">
            <Panel>
              <ExportPanel contentTypes={contentTypes} />
            </Panel>
            <Panel>
              <ImportPanel contentTypes={contentTypes} />
            </Panel>
          </Flex>
        )}
      </Layouts.Content>
    </Page.Main>
  );
};

export default TransferPage;
