/**
 * The whole chart-editing surface.
 *
 * One component, used in both places Chartkit appears: the standalone Strapi
 * custom field, and the chart block inside Better Blocks. That is the reason
 * this is its own package — if it lived in either plugin, the other would have
 * to depend on a whole editor plugin to reuse it.
 *
 * The preview is rendered by `renderChart` from `@qkix/chartkit-core`, the same
 * function the front-end renderers call. The editor and the published page draw
 * from one code path, so a chart cannot look right here and wrong there.
 */

import {
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  SingleSelect,
  SingleSelectOption,
  Textarea,
  TextInput,
  Toggle,
  Typography,
} from '@strapi/design-system';
import { renderChart, type ChartSpec, type ChartType } from '@qkix/chartkit-core';
import * as React from 'react';

import { DataGrid } from './DataGrid';
import { PastePanel } from './PastePanel';
import { normalizeShape, setType, typeChangeDiscardsSeries } from './edit';

export type ChartEditorProps = {
  spec: ChartSpec;
  onChange: (spec: ChartSpec) => void;
  disabled?: boolean;
  /** Number formatting in the preview. Defaults to the browser's locale. */
  locale?: string;
};

const TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
  { value: 'pie', label: 'Pie' },
  { value: 'donut', label: 'Donut' },
];

export function ChartEditor({ spec, onChange, disabled, locale }: ChartEditorProps) {
  const [pendingType, setPendingType] = React.useState<ChartType | null>(null);
  const [pasteOpen, setPasteOpen] = React.useState(false);

  // Every edit goes out through here, so a spec can never leave the editor
  // ragged — a series shorter than the labels makes every later edit ambiguous.
  const update = (next: ChartSpec) => onChange(normalizeShape(next));

  const chooseType = (type: ChartType) => {
    // Pie and donut show one series, so switching to them throws the rest away.
    // Asking first is the difference between a conversion and a silent deletion.
    if (typeChangeDiscardsSeries(spec, type)) {
      setPendingType(type);
      return;
    }
    update(setType(spec, type));
  };

  const preview = renderChart(spec, { locale, idPrefix: 'chartkit-editor' });

  return (
    <Flex direction="column" alignItems="stretch" gap={4}>
      <Preview result={preview} />

      <Flex gap={4} alignItems="flex-end" wrap="wrap">
        <Box minWidth="160px">
          <Field.Root name="chart-type">
            <Field.Label>Chart type</Field.Label>
            <SingleSelect
              value={spec.type}
              disabled={disabled}
              onChange={(value: string | number) => chooseType(String(value) as ChartType)}
            >
              {TYPES.map(({ value, label }) => (
                <SingleSelectOption key={value} value={value}>
                  {label}
                </SingleSelectOption>
              ))}
            </SingleSelect>
          </Field.Root>
        </Box>

        <Box flex="1" minWidth="200px">
          <Field.Root name="chart-title">
            <Field.Label>Title</Field.Label>
            <TextInput
              value={spec.title ?? ''}
              disabled={disabled}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                update({ ...spec, title: event.target.value })
              }
            />
          </Field.Root>
        </Box>

        {spec.type === 'bar' && (
          <Box>
            <Field.Root name="chart-stacked">
              <Field.Label>Stacked</Field.Label>
              <Toggle
                checked={spec.options?.barMode === 'stacked'}
                disabled={disabled}
                onLabel="On"
                offLabel="Off"
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  update({
                    ...spec,
                    options: {
                      ...spec.options,
                      barMode: event.target.checked ? 'stacked' : 'grouped',
                    },
                  })
                }
              />
            </Field.Root>
          </Box>
        )}
      </Flex>

      <Field.Root
        name="chart-description"
        hint="Describes the chart for anyone who cannot see it. A sentence saying what the numbers show conveys far more than a screen reader listing them."
      >
        <Field.Label>Description</Field.Label>
        <Textarea
          value={spec.description ?? ''}
          disabled={disabled}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
            update({ ...spec, description: event.target.value })
          }
        />
        <Field.Hint />
      </Field.Root>

      <Box>
        <Flex justifyContent="space-between" alignItems="center" paddingBottom={2}>
          <Typography variant="delta" tag="h3">
            Data
          </Typography>
          <Button
            variant="tertiary"
            size="S"
            disabled={disabled}
            onClick={() => setPasteOpen(true)}
          >
            Paste from a spreadsheet
          </Button>
        </Flex>

        <DataGrid spec={spec} onChange={update} disabled={disabled} />
      </Box>

      {pasteOpen && (
        <PastePanel
          spec={spec}
          onCancel={() => setPasteOpen(false)}
          onApply={(next) => {
            update(next);
            setPasteOpen(false);
          }}
        />
      )}

      <Dialog.Root open={pendingType !== null} onOpenChange={() => setPendingType(null)}>
        <Dialog.Content>
          <Dialog.Header>Switch to {pendingType}?</Dialog.Header>
          <Dialog.Body>
            <Typography>
              A {pendingType} chart shows one series as shares of a whole. Switching keeps{' '}
              <strong>{spec.data.series[0]?.name}</strong> and removes the other{' '}
              {spec.data.series.length - 1}.
            </Typography>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Cancel</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button
                variant="danger-light"
                onClick={() => {
                  if (pendingType) update(setType(spec, pendingType));
                  setPendingType(null);
                }}
              >
                Switch and remove
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}

/**
 * The preview, or the reasons there is not one.
 *
 * A spec that will not render is shown as its validation issues rather than as
 * an empty frame. The author is the only person who can fix it, and this is the
 * one moment they are looking.
 */
function Preview({ result }: { result: ReturnType<typeof renderChart> }) {
  if (!result.ok) {
    return (
      <Box padding={4} background="danger100" hasRadius>
        <Typography variant="pi" fontWeight="bold" textColor="danger600">
          This chart will not render yet
        </Typography>
        <Box paddingTop={2}>
          {result.issues.map((issue) => (
            <Typography key={issue.path} variant="pi" textColor="danger600" tag="p">
              {issue.path}: {issue.message}
            </Typography>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      padding={3}
      hasRadius
      style={{
        // Both, always. The chart's text and axes are
        // `var(--chart-text, currentColor)` by design, so a background without
        // a matching color leaves them inheriting the admin's theme — which on
        // the dark one is white text on white paper.
        background: '#ffffff',
        color: '#32324a',
        border: '1px solid #dcdce4',
      }}
      // chartkit-core's own output, escaped on the way in by its string builder.
      dangerouslySetInnerHTML={{ __html: result.svg }}
    />
  );
}
