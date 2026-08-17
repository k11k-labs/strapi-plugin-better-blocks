import * as React from 'react';

import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  Box,
  Button,
  Checkbox,
  Field,
  Flex,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from '@strapi/design-system';
import { Upload } from '@strapi/icons';

import { ReportView } from './ReportView';
import { DEFAULT_IMPORT, routes } from '../api';
import type { CatalogueEntry, ImportRequest, Report, Status } from '../api';

interface Props {
  contentTypes: CatalogueEntry[];
}

/**
 * The import, in two deliberate steps.
 *
 * The file is read and resolved against the database first, and the button that
 * writes only appears once there is a report to read. It is the same request
 * either way, with one flag changed, so the preview cannot drift from what the
 * import then does.
 */
export const ImportPanel = ({ contentTypes }: Props) => {
  const { post } = useFetchClient();

  const [uid, setUid] = React.useState<string>(contentTypes[0]?.uid ?? '');
  const [options, setOptions] = React.useState(DEFAULT_IMPORT);
  const [file, setFile] = React.useState<File | null>(null);
  const [report, setReport] = React.useState<Report | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const input = React.useRef<HTMLInputElement>(null);

  const update = (patch: Partial<ImportRequest>) => {
    setOptions((current) => ({ ...current, ...patch }));
    // Any change of terms invalidates the preview: what it promised was
    // computed under the old ones.
    setReport(null);
  };

  const send = async (apply: boolean) => {
    if (!file) return;

    setBusy(true);
    setError(null);

    const form = new FormData();
    form.append('file', file);
    form.append('uid', uid);
    Object.entries(options).forEach(([key, value]) => form.append(key, String(value)));

    try {
      const { data } = await post<Report>(apply ? routes.apply : routes.preview, form);
      setReport(data);
    } catch (caught: any) {
      setError(caught?.response?.data?.error?.message ?? 'The file could not be read.');
      setReport(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Flex direction="column" gap={4} alignItems="stretch">
      <Typography variant="delta">Import</Typography>

      <Field.Root name="import-uid">
        <Field.Label>Content type</Field.Label>
        <SingleSelect
          value={uid}
          onChange={(value: string | number) => {
            setUid(String(value));
            setReport(null);
          }}
        >
          {contentTypes.map((entry) => (
            <SingleSelectOption key={entry.uid} value={entry.uid}>
              {entry.label}
            </SingleSelectOption>
          ))}
        </SingleSelect>
      </Field.Root>

      <Field.Root name="import-file">
        <Field.Label>File</Field.Label>
        <Flex gap={2} alignItems="center">
          <Button variant="secondary" onClick={() => input.current?.click()}>
            Choose a file
          </Button>
          <Typography variant="pi" textColor={file ? 'neutral800' : 'neutral500'}>
            {file ? file.name : 'JSON or CSV'}
          </Typography>
        </Flex>
        <input
          ref={input}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          style={{ display: 'none' }}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setReport(null);
          }}
        />
      </Field.Root>

      <Flex gap={4} wrap="wrap" alignItems="flex-end">
        <Box minWidth="200px">
          <Field.Root name="import-existing">
            <Field.Label>When it is already there</Field.Label>
            <SingleSelect
              value={options.onExisting}
              onChange={(value: string | number) =>
                update({ onExisting: value === 'skip' ? 'skip' : 'update' })
              }
            >
              <SingleSelectOption value="update">Update it</SingleSelectOption>
              <SingleSelectOption value="skip">Leave it alone</SingleSelectOption>
            </SingleSelect>
          </Field.Root>
        </Box>

        <Box minWidth="240px">
          <Field.Root name="import-missing">
            <Field.Label>When a relation points at nothing</Field.Label>
            <SingleSelect
              value={options.onMissingRelation}
              onChange={(value: string | number) =>
                update({ onMissingRelation: value === 'fail' ? 'fail' : 'skip' })
              }
            >
              <SingleSelectOption value="skip">Drop the link, keep the row</SingleSelectOption>
              <SingleSelectOption value="fail">Refuse the import</SingleSelectOption>
            </SingleSelect>
          </Field.Root>
        </Box>

        <Box minWidth="160px">
          <Field.Root name="import-status">
            <Field.Label>Import as</Field.Label>
            <SingleSelect
              value={options.status}
              onChange={(value: string | number) => update({ status: value as Status })}
            >
              <SingleSelectOption value="draft">Draft</SingleSelectOption>
              <SingleSelectOption value="published">Published</SingleSelectOption>
            </SingleSelect>
          </Field.Root>
        </Box>
      </Flex>

      <Checkbox
        checked={options.continueOnError}
        onCheckedChange={(value: boolean) => update({ continueOnError: Boolean(value) })}
      >
        Keep going past a row that fails
      </Checkbox>
      <Typography variant="pi" textColor="neutral600">
        {options.continueOnError
          ? 'Rows that fail are reported and the rest are committed.'
          : 'All or nothing: if any row fails, the whole import is rolled back and nothing changes.'}
      </Typography>

      <Flex gap={2}>
        <Button
          variant="secondary"
          startIcon={<Upload />}
          onClick={() => send(false)}
          loading={busy}
          disabled={!file || !uid}
        >
          Dry run
        </Button>
        <Button
          onClick={() => send(true)}
          loading={busy}
          disabled={!file || !uid || !report || report.applied}
        >
          Import for real
        </Button>
      </Flex>

      {!report && file && (
        <Typography variant="pi" textColor="neutral600">
          Run the dry run first. Nothing is written until you have seen what it would do.
        </Typography>
      )}

      {error && (
        <Typography variant="pi" textColor="danger600">
          {error}
        </Typography>
      )}

      {report && <ReportView report={report} />}
    </Flex>
  );
};

export default ImportPanel;
