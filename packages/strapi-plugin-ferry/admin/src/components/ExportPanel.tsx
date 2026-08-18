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
import { Download } from '@strapi/icons';

import { DEFAULT_EXPORT, routes, saveFile } from '../api';
import type {
  CatalogueEntry,
  ExportEnvelope,
  ExportRequest,
  FieldPlan,
  Format,
  Status,
} from '../api';

interface Props {
  contentTypes: CatalogueEntry[];
}

export const ExportPanel = ({ contentTypes }: Props) => {
  const { get, post } = useFetchClient();

  const [uid, setUid] = React.useState<string>(contentTypes[0]?.uid ?? '');
  const [options, setOptions] = React.useState(DEFAULT_EXPORT);
  const [plan, setPlan] = React.useState<FieldPlan | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!uid) return;
    let alive = true;

    get<FieldPlan>(routes.plan(uid))
      .then(({ data }) => alive && setPlan(data))
      .catch(() => alive && setPlan(null));

    return () => {
      alive = false;
    };
  }, [get, uid]);

  const update = (patch: Partial<ExportRequest>) =>
    setOptions((current) => ({ ...current, ...patch }));

  const run = async () => {
    setBusy(true);
    setError(null);
    setWarnings([]);
    setDone(null);

    try {
      // `envelope` asks for the file as a string inside JSON rather than as a
      // download. Strapi's admin fetch client parses every response as JSON no
      // matter what `responseType` it is handed, so asking for a blob gets a
      // parsed object back and saving it writes "[object Object]" to disk.
      const { data } = await post<ExportEnvelope>(routes.export, {
        uid,
        ...options,
        envelope: true,
      });

      saveFile(data.body, data.filename, data.mime);

      setWarnings(data.warnings ?? []);
      setDone(`${data.filename} (${data.count} document${data.count === 1 ? '' : 's'})`);
    } catch (caught: any) {
      setError(caught?.response?.data?.error?.message ?? 'The export failed.');
    } finally {
      setBusy(false);
    }
  };

  const carries = plan
    ? [
        `${plan.scalars.length} field(s)`,
        options.relations && plan.relations.length > 0
          ? `${plan.relations.length} relation(s)`
          : null,
        plan.components.length > 0 ? `${plan.components.length} component(s)` : null,
        plan.dynamicZones.length > 0 ? `${plan.dynamicZones.length} dynamic zone(s)` : null,
        options.media && plan.media.length > 0 ? `${plan.media.length} media field(s)` : null,
      ].filter(Boolean)
    : [];

  return (
    <Flex direction="column" gap={4} alignItems="stretch">
      <Typography variant="delta">Export</Typography>

      <Field.Root name="export-uid">
        <Field.Label>Content type</Field.Label>
        <SingleSelect value={uid} onChange={(value: string | number) => setUid(String(value))}>
          {contentTypes.map((entry) => (
            <SingleSelectOption key={entry.uid} value={entry.uid}>
              {entry.label}
            </SingleSelectOption>
          ))}
        </SingleSelect>
      </Field.Root>

      <Flex gap={4} wrap="wrap" alignItems="flex-end">
        <Box minWidth="160px">
          <Field.Root name="export-format">
            <Field.Label>Format</Field.Label>
            <SingleSelect
              value={options.format}
              onChange={(value: string | number) => update({ format: value as Format })}
            >
              <SingleSelectOption value="json">JSON - everything</SingleSelectOption>
              <SingleSelectOption value="csv">CSV - flat fields</SingleSelectOption>
            </SingleSelect>
          </Field.Root>
        </Box>

        <Box minWidth="160px">
          <Field.Root name="export-status">
            <Field.Label>Version</Field.Label>
            <SingleSelect
              value={options.status}
              onChange={(value: string | number) => update({ status: value as Status })}
              disabled={plan ? !plan.draftAndPublish : false}
            >
              <SingleSelectOption value="draft">Draft</SingleSelectOption>
              <SingleSelectOption value="published">Published</SingleSelectOption>
            </SingleSelect>
          </Field.Root>
        </Box>
      </Flex>

      <Flex gap={4} wrap="wrap">
        <Checkbox
          checked={options.relations}
          onCheckedChange={(value: boolean) => update({ relations: Boolean(value) })}
        >
          Relations
        </Checkbox>
        <Checkbox
          checked={options.media}
          onCheckedChange={(value: boolean) => update({ media: Boolean(value) })}
        >
          Media references
        </Checkbox>
      </Flex>

      {carries.length > 0 && (
        <Typography variant="pi" textColor="neutral600">
          Carries {carries.join(', ')}.
          {options.format === 'csv' && (plan?.components.length || plan?.dynamicZones.length)
            ? ' CSV leaves components and dynamic zones behind - use JSON to keep them.'
            : ''}
        </Typography>
      )}

      <Box>
        <Button startIcon={<Download />} onClick={run} loading={busy} disabled={!uid}>
          Export
        </Button>
      </Box>

      {done && (
        <Typography variant="pi" textColor="success600">
          Saved {done}.
        </Typography>
      )}

      {warnings.map((warning, index) => (
        <Typography key={index} variant="pi" textColor="warning700">
          {warning}
        </Typography>
      ))}

      {error && (
        <Typography variant="pi" textColor="danger600">
          {error}
        </Typography>
      )}
    </Flex>
  );
};

export default ExportPanel;
