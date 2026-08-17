import * as React from 'react';

import { Page, useFetchClient } from '@strapi/admin/strapi-admin';
import {
  Badge,
  Box,
  Field,
  Flex,
  Loader,
  Main,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from '@strapi/design-system';
import { useNavigate } from 'react-router-dom';

import { formatWhen, routes } from '../api';
import type { QueueItem, Workflow } from '../api';

/**
 * "My reviews".
 *
 * The list view has a stage column of its own, but it is per collection and per
 * page, and it cannot be filtered — a filter would have to be a query against
 * the user's content type, and a stage is not a field on it. This page is the
 * answer to the question a reviewer actually has: everything waiting on them,
 * across every content type, in one list.
 */
export const QueuePage = () => {
  const { get } = useFetchClient();
  const navigate = useNavigate();

  const [items, setItems] = React.useState<QueueItem[]>([]);
  const [workflows, setWorkflows] = React.useState<Workflow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [mine, setMine] = React.useState(true);
  const [stageId, setStageId] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    get<{ workflows: Workflow[] }>(routes.workflows)
      .then(({ data }) => setWorkflows(data.workflows))
      .catch(() => setWorkflows([]));
  }, [get]);

  React.useEffect(() => {
    setLoading(true);
    get<{ results: QueueItem[] }>(routes.queue, {
      params: {
        // The page opens on the reviewer's own queue, because that is the
        // question they came to answer.
        ...(mine ? {} : { assigneeId: 'all' }),
        ...(stageId ? { stageId } : {}),
      },
    })
      .then(({ data }) => setItems(data.results))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [get, mine, stageId]);

  const stages = workflows.flatMap((workflow) => workflow.stages);

  return (
    <Main>
      <Box padding={8}>
        <Typography variant="alpha" tag="h1">
          My reviews
        </Typography>
        <Box paddingTop={2} paddingBottom={6}>
          <Typography textColor="neutral600">
            Everything waiting on a decision, across every content type.
          </Typography>
        </Box>

        <Flex gap={4} paddingBottom={4} alignItems="flex-end">
          <Field.Root name="queue-reviewer">
            <Field.Label>Reviewer</Field.Label>
            <SingleSelect
              value={mine ? 'mine' : 'all'}
              onChange={(value: string | number) => setMine(value === 'mine')}
            >
              <SingleSelectOption value="mine">Assigned to me</SingleSelectOption>
              <SingleSelectOption value="all">Everyone</SingleSelectOption>
            </SingleSelect>
          </Field.Root>

          <Field.Root name="queue-stage">
            <Field.Label>Stage</Field.Label>
            <SingleSelect
              placeholder="Any stage"
              value={stageId}
              onClear={() => setStageId(undefined)}
              onChange={(value: string | number) => setStageId(String(value))}
            >
              {stages.map((stage) => (
                <SingleSelectOption key={stage.id} value={String(stage.id)}>
                  {stage.name}
                </SingleSelectOption>
              ))}
            </SingleSelect>
          </Field.Root>
        </Flex>

        {loading ? (
          <Flex justifyContent="center" padding={8}>
            <Loader>Loading</Loader>
          </Flex>
        ) : items.length === 0 ? (
          <Box padding={8} background="neutral100" hasRadius>
            <Typography textColor="neutral600">
              Nothing is waiting on you. {mine ? 'Try "Everyone" to see the whole queue.' : ''}
            </Typography>
          </Box>
        ) : (
          <Table colCount={5} rowCount={items.length}>
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma">Title</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Type</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Stage</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Locale</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Last moved</Typography>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((item) => (
                <Tr
                  key={item.id}
                  onClick={() =>
                    navigate(
                      `/content-manager/collection-types/${item.contentTypeUid}/${item.documentId}` +
                        (item.locale ? `?plugins[i18n][locale]=${item.locale}` : '')
                    )
                  }
                  style={{ cursor: 'pointer' }}
                >
                  <Td>
                    <Typography textColor="neutral800">{item.title}</Typography>
                  </Td>
                  <Td>
                    <Typography textColor="neutral600">{item.contentTypeName}</Typography>
                  </Td>
                  <Td>
                    {item.stage ? (
                      <Badge backgroundColor={item.stage.color} textColor="neutral0">
                        {item.stage.name}
                      </Badge>
                    ) : (
                      <Typography textColor="neutral500">—</Typography>
                    )}
                  </Td>
                  <Td>
                    <Typography textColor="neutral600">{item.locale ?? '—'}</Typography>
                  </Td>
                  <Td>
                    <Typography textColor="neutral600">
                      {formatWhen(item.lastTransitionAt)}
                    </Typography>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>
    </Main>
  );
};

export const QueuePageWithBoundary = () => (
  <Page.Protect>
    <QueuePage />
  </Page.Protect>
);

export default QueuePageWithBoundary;
