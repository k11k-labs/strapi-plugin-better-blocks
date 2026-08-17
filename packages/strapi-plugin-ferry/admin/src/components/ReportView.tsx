import * as React from 'react';

import { Badge, Box, Flex, Typography } from '@strapi/design-system';

import { summarise } from '../api';
import type { Report } from '../api';

/**
 * The dry run, on screen.
 *
 * The point of the whole feature is here: before anything is written, say what
 * will happen in terms a person can check - how many rows, which ones, and
 * every link that leads nowhere with the row number it came from. An import
 * tool that only reports afterwards is asking to be trusted; this one is asking
 * to be read.
 */

const Count = ({ label, value, tone }: { label: string; value: number; tone?: string }) => (
  <Flex direction="column" gap={1} alignItems="flex-start">
    <Typography variant="beta" textColor={value > 0 ? tone : 'neutral500'}>
      {value}
    </Typography>
    <Typography variant="pi" textColor="neutral600">
      {label}
    </Typography>
  </Flex>
);

export const ReportView = ({ report }: { report: Report }) => {
  const failures = report.rows.filter((row) => row.outcome === 'error');

  return (
    <Flex direction="column" gap={4} alignItems="stretch">
      <Box
        padding={4}
        hasRadius
        background="neutral0"
        borderColor="neutral200"
        borderWidth="1px"
        borderStyle="solid"
      >
        <Flex justifyContent="space-between" alignItems="center" paddingBottom={3}>
          <Typography variant="delta">
            {report.applied ? 'Imported' : 'Dry run - nothing written yet'}
          </Typography>
          <Badge>{summarise(report)}</Badge>
        </Flex>

        <Flex gap={8} wrap="wrap">
          <Count label="in the file" value={report.total} tone="neutral800" />
          <Count label="to create" value={report.created} tone="success600" />
          <Count label="to update" value={report.updated} tone="primary600" />
          <Count label="skipped" value={report.skipped} tone="neutral600" />
          <Count label="failed" value={report.errored} tone="danger600" />
        </Flex>
      </Box>

      {report.warnings.map((warning, index) => (
        <Box
          key={index}
          padding={3}
          hasRadius
          background="warning100"
          borderColor="warning200"
          borderWidth="1px"
          borderStyle="solid"
        >
          <Typography variant="pi" textColor="warning700">
            {warning}
          </Typography>
        </Box>
      ))}

      {report.unresolved.length > 0 && (
        <Box
          padding={4}
          hasRadius
          background="neutral0"
          borderColor="warning200"
          borderWidth="1px"
          borderStyle="solid"
        >
          <Typography variant="delta">Relations that point at nothing</Typography>
          <Box paddingTop={1} paddingBottom={3}>
            <Typography variant="pi" textColor="neutral600">
              These targets are neither in the file nor in this environment. With &quot;drop the
              link&quot; the rows still import without them; with &quot;refuse the import&quot;
              nothing is written at all.
            </Typography>
          </Box>

          <Flex direction="column" gap={2} alignItems="stretch">
            {report.unresolved.slice(0, 25).map((entry, index) => (
              <Flex key={index} gap={3} alignItems="baseline" wrap="wrap">
                <Badge>row {entry.row}</Badge>
                <Typography variant="omega" fontWeight="bold">
                  {entry.field}
                </Typography>
                <Typography variant="pi" textColor="neutral600">
                  {entry.target}
                </Typography>
                <Typography variant="pi" textColor="danger600">
                  {entry.keys.join(', ')}
                </Typography>
              </Flex>
            ))}
            {report.unresolved.length > 25 && (
              <Typography variant="pi" textColor="neutral600">
                and {report.unresolved.length - 25} more
              </Typography>
            )}
          </Flex>
        </Box>
      )}

      {failures.length > 0 && (
        <Box
          padding={4}
          hasRadius
          background="neutral0"
          borderColor="danger200"
          borderWidth="1px"
          borderStyle="solid"
        >
          <Typography variant="delta" textColor="danger600">
            Rows that failed
          </Typography>
          <Box paddingTop={2}>
            <Flex direction="column" gap={2} alignItems="stretch">
              {failures.slice(0, 25).map((row) => (
                <Flex key={row.row} gap={3} alignItems="baseline" wrap="wrap">
                  <Badge>row {row.row}</Badge>
                  <Typography variant="pi" textColor="neutral600">
                    {row.documentId ?? 'no documentId'}
                  </Typography>
                  <Typography variant="pi" textColor="danger600">
                    {row.message}
                  </Typography>
                </Flex>
              ))}
            </Flex>
          </Box>
        </Box>
      )}
    </Flex>
  );
};

export default ReportView;
