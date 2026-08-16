/**
 * The chart custom field.
 *
 * A preview, and a button that opens the editor. The editor itself is
 * `@qkix/chartkit-editor` — the same component the chart block inside Better
 * Blocks mounts, which is why it is a package rather than living in one of the
 * two plugins that need it.
 *
 * The dialog rather than an inline editor for the same reason the block uses
 * one: the editor is a preview plus a grid plus a row of settings, which is
 * most of a screen given to a field the author usually only glances at on their
 * way to the rest of the form.
 */

import { Box, Button, Field, Flex, Typography } from '@strapi/design-system';
import { ChartEditorDialog, ChartPreview } from '@qkix/chartkit-editor';
import type { ChartSpec } from '@qkix/chartkit-core';
import * as React from 'react';

import { readValue, starterSpec, writeValue } from '../value';

type ChartFieldProps = {
  name: string;
  value?: string | null;
  onChange: (event: { target: { name: string; type: string; value: string } }) => void;
  attribute?: {
    type: string;
    customField: string;
    options?: {
      previewLocale?: string;
    };
  };
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
};

const ChartField = React.forwardRef<HTMLDivElement, ChartFieldProps>((props, ref) => {
  const { name, value, onChange, disabled, error, hint, label, required } = props;

  const [open, setOpen] = React.useState(false);

  // Re-read only when the stored value actually changes. Parsing and migrating
  // on every render would hand `ChartEditorDialog` a new object each time, and
  // its "reset the draft when the spec changes" effect would fire continuously,
  // wiping whatever is being typed.
  const stored = React.useMemo(() => readValue(value), [value]);

  const locale = props.attribute?.options?.previewLocale || undefined;

  const save = (spec: ChartSpec) => {
    onChange({ target: { name, type: 'json', value: writeValue(spec) } });
  };

  // Memoized for the same reason `stored` is, and it matters more here: a fresh
  // starter object on every render would reset the dialog's draft every time
  // this field re-rendered — which the edit view does on any change to any
  // field — throwing away a chart halfway through being built.
  const starter = React.useMemo(() => starterSpec(), []);

  // Only ever opened over something. A field with nothing in it opens over the
  // starter, and the starter is written to the document on save, not on open —
  // merely looking at a new entry must not mark it dirty.
  const editing = stored.status === 'ok' ? stored.spec : starter;

  return (
    <Field.Root id={name} name={name} required={required} error={error} hint={hint}>
      <Flex direction="column" alignItems="stretch" gap={1} ref={ref}>
        <Field.Label>{label}</Field.Label>

        {stored.status === 'ok' && (
          <ChartPreview
            spec={stored.spec}
            locale={locale}
            idPrefix={`chartkit-${name}`}
            onClick={disabled ? undefined : () => setOpen(true)}
          />
        )}

        {stored.status === 'empty' && (
          <EmptyState disabled={disabled} onCreate={() => setOpen(true)} />
        )}

        {stored.status === 'unreadable' && (
          <Box padding={4} background="danger100" hasRadius>
            <Typography variant="pi" fontWeight="bold" textColor="danger600" tag="p">
              {stored.reason}
            </Typography>
            <Box paddingTop={2}>
              {/* No edit button. Opening the editor here would show the starter
                chart over data that exists, and saving would overwrite it. */}
              <Typography variant="pi" textColor="danger600">
                Editing here would replace it, so the field is read-only until the value is fixed or
                cleared.
              </Typography>
            </Box>
          </Box>
        )}

        {stored.status === 'ok' && (
          <Flex paddingTop={2} gap={2}>
            <Button variant="secondary" size="S" disabled={disabled} onClick={() => setOpen(true)}>
              Edit chart
            </Button>
          </Flex>
        )}

        {stored.status !== 'unreadable' && (
          <ChartEditorDialog
            spec={editing}
            open={open}
            onOpenChange={setOpen}
            onSave={save}
            locale={locale}
            disabled={disabled}
            title={label ? `Edit ${label}` : 'Edit chart'}
          />
        )}

        <Field.Hint />
        <Field.Error />
      </Flex>
    </Field.Root>
  );
});

ChartField.displayName = 'ChartField';

/**
 * What an empty field shows.
 *
 * A dashed box rather than a bare button, so the field occupies the space a
 * chart will occupy. A form row that is one small button tall and then jumps to
 * full height on the first save reflows everything under it.
 */
function EmptyState({ disabled, onCreate }: { disabled?: boolean; onCreate: () => void }) {
  return (
    <Flex
      direction="column"
      gap={2}
      padding={6}
      hasRadius
      justifyContent="center"
      background="neutral100"
      style={{ border: '1px dashed #dcdce4' }}
    >
      <Typography variant="pi" textColor="neutral600">
        No chart yet.
      </Typography>
      <Button variant="secondary" size="S" disabled={disabled} onClick={onCreate}>
        Create chart
      </Button>
    </Flex>
  );
}

export default ChartField;
