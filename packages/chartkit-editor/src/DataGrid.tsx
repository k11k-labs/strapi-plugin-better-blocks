/**
 * The data grid.
 *
 * A spreadsheet is the shape people already have their numbers in, so the
 * editor looks like one: categories down the side, series across the top, a
 * number in each cell.
 *
 * Cells hold their text locally while being typed and only report a number
 * upward on blur. Parsing every keystroke means `1.` becomes `1` and the cursor
 * jumps behind the dot the moment anyone tries to type `1.5`, and a cleared
 * cell flickers through `0`. Committing on blur costs nothing and keeps typing
 * feeling like typing.
 */

import {
  Box,
  Button,
  Flex,
  IconButton,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@strapi/design-system';
import { Plus, Trash } from '@strapi/icons';
import * as React from 'react';

import type { ChartSpec } from '@qkix/chartkit-core';

import {
  addRow,
  addSeries,
  removeRow,
  removeSeries,
  setCell,
  setLabel,
  setSeriesName,
} from './edit';

export type DataGridProps = {
  spec: ChartSpec;
  onChange: (spec: ChartSpec) => void;
  disabled?: boolean;
};

export function DataGrid({ spec, onChange, disabled }: DataGridProps) {
  const { labels, series } = spec.data;

  return (
    <Box>
      <Box overflow="auto" maxHeight="380px">
        <Table colCount={series.length + 2} rowCount={labels.length + 1}>
          <Thead>
            <Tr>
              <Th>
                <ColumnHeading>Category</ColumnHeading>
              </Th>

              {series.map((one, seriesIndex) => (
                <Th key={seriesIndex} style={{ borderLeft: COLUMN_RULE }}>
                  {/* The delete button is taken out of the flow, so the name
                      input spans the whole cell and its right edge lands on the
                      same line as the numbers below it. Any button sharing the
                      row steals width from the input, and the heading drifts
                      away from the column it names. */}
                  {/* `flex: 1` because Strapi's Th wraps its children in a
                      flex row of its own: without it this shrinks to the width
                      of the text and the heading sits mid-column, nowhere near
                      the numbers it names. */}
                  <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                    <CellInput
                      value={one.name}
                      align="right"
                      aria-label={`Name of series ${seriesIndex + 1}`}
                      disabled={disabled}
                      onCommit={(text) => onChange(setSeriesName(spec, seriesIndex, text))}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                    >
                      <IconButton
                        label={`Remove series ${one.name}`}
                        variant="ghost"
                        size="S"
                        // The last series is not removable: a chart with none
                        // has nothing to draw. Disabled rather than hidden, so
                        // the control does not move as series come and go.
                        disabled={disabled || series.length <= 1}
                        onClick={() => onChange(removeSeries(spec, seriesIndex))}
                      >
                        <Trash />
                      </IconButton>
                    </span>
                  </div>
                </Th>
              ))}

              <Th>
                <ColumnHeading>&nbsp;</ColumnHeading>
              </Th>
            </Tr>
          </Thead>

          <Tbody>
            {labels.map((label, rowIndex) => (
              <Tr key={rowIndex}>
                <Td>
                  <CellInput
                    value={label}
                    aria-label={`Label of category ${rowIndex + 1}`}
                    disabled={disabled}
                    onCommit={(text) => onChange(setLabel(spec, rowIndex, text))}
                  />
                </Td>

                {series.map((one, seriesIndex) => (
                  <Td key={seriesIndex} style={{ borderLeft: COLUMN_RULE }}>
                    <NumberCell
                      value={one.values[rowIndex] ?? null}
                      aria-label={`${one.name} at ${label}`}
                      disabled={disabled}
                      onCommit={(value) => onChange(setCell(spec, seriesIndex, rowIndex, value))}
                    />
                  </Td>
                ))}

                <Td>
                  <IconButton
                    label={`Remove category ${label}`}
                    variant="ghost"
                    size="S"
                    disabled={disabled}
                    onClick={() => onChange(removeRow(spec, rowIndex))}
                  >
                    <Trash />
                  </IconButton>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Flex gap={2} paddingTop={3}>
        <Button
          variant="secondary"
          size="S"
          startIcon={<Plus />}
          disabled={disabled}
          onClick={() => onChange(addRow(spec))}
        >
          Add category
        </Button>
        <Button
          variant="secondary"
          size="S"
          startIcon={<Plus />}
          disabled={disabled}
          onClick={() => onChange(addSeries(spec))}
        >
          Add series
        </Button>
      </Flex>
    </Box>
  );
}

const ColumnHeading = ({ children }: { children: React.ReactNode }) => (
  <Box paddingLeft={2} paddingRight={2}>
    {children}
  </Box>
);

/**
 * A text cell that reports on blur.
 *
 * `key` on the value is what lets an outside change — a paste, an undo — reach
 * a cell that is holding its own draft.
 */
function CellInput({
  value,
  onCommit,
  disabled,
  align = 'left',
  ...rest
}: {
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  align?: 'left' | 'right';
  'aria-label': string;
}) {
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      {...rest}
      value={draft}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') setDraft(value);
      }}
      style={{ ...CELL_STYLE, textAlign: align }}
    />
  );
}

/** A numeric cell. An empty cell is a gap, not a zero. */
function NumberCell({
  value,
  onCommit,
  disabled,
  ...rest
}: {
  value: number | null;
  onCommit: (value: number | null) => void;
  disabled?: boolean;
  'aria-label': string;
}) {
  const asText = value === null ? '' : String(value);
  const [draft, setDraft] = React.useState(asText);

  React.useEffect(() => {
    setDraft(asText);
  }, [asText]);

  const commit = () => {
    const trimmed = draft.trim();
    // Empty means no reading. Writing 0 here would invent a measurement, and
    // the chart would draw a bar on the baseline that looks like data.
    const next = trimmed === '' ? null : Number(trimmed);
    const clean = next === null || Number.isFinite(next) ? next : null;

    if (clean !== value) onCommit(clean);
    // Snap the draft back to what was actually stored, so a cell typed as
    // `12abc` does not keep showing text the chart is not drawing.
    setDraft(clean === null ? '' : String(clean));
  };

  return (
    <input
      {...rest}
      value={draft}
      disabled={disabled}
      inputMode="decimal"
      placeholder="—"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') setDraft(asText);
      }}
      style={{ ...CELL_STYLE, textAlign: 'right' }}
    />
  );
}

/**
 * Deliberately a bare input rather than a design-system field.
 *
 * A grid of forty cells wants forty inputs that look like cells, not forty
 * bordered form controls with labels and hint slots. The colors are inherited,
 * so this follows the admin's theme.
 */
/**
 * A rule between columns.
 *
 * With four series and a hundred rows, a grid of bare numbers is genuinely hard
 * to read — the eye loses which column it is in halfway down. `currentColor` at
 * low opacity keeps the rule subtle and correct in either admin theme, rather
 * than picking a grey that is invisible on one of them.
 */
const COLUMN_RULE = '1px solid color-mix(in srgb, currentColor 15%, transparent)';

const CELL_STYLE: React.CSSProperties = {
  width: '100%',
  minWidth: '72px',
  padding: '6px 8px',
  border: '1px solid transparent',
  borderRadius: '4px',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  outlineOffset: '-1px',
};
