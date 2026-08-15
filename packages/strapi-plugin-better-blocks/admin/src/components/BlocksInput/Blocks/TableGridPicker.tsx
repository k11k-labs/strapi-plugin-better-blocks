import * as React from 'react';
import { Box, Button, Field, Flex, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { styled } from 'styled-components';

/** Size of the hover grid. Larger tables go through the custom-size inputs. */
const GRID_ROWS = 10;
const GRID_COLS = 10;

/** Upper bound for the custom-size inputs — a guard against typos, not a limit
 *  anyone should hit in practice. */
const MAX_DIMENSION = 50;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(${GRID_COLS}, 1.6rem);
  grid-auto-rows: 1.6rem;
  gap: 2px;
  outline: none;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary600};
    outline-offset: 4px;
    border-radius: ${({ theme }) => theme.borderRadius};
  }
`;

const Cell = styled.div<{ $selected: boolean }>`
  border: 1px solid
    ${({ theme, $selected }) =>
      $selected ? theme.colors.primary600 : theme.colors.neutral300};
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.primary200 : theme.colors.neutral0};
  border-radius: 2px;
  cursor: pointer;
`;

interface TableGridPickerProps {
  /** Called with a 1-based row/column count once the author commits a size. */
  onSelect: (rows: number, cols: number) => void;
}

/**
 * Notion/Word-style table size picker: hover (or arrow-key) across a 10x10 grid
 * to pick the dimensions, with a custom-size fallback for anything bigger.
 *
 * The grid is plain divs in a CSS grid rather than SVG or a canvas, so it
 * paints instantly and stays keyboard navigable for free.
 */
const TableGridPicker = ({ onSelect }: TableGridPickerProps) => {
  const { formatMessage } = useIntl();
  // 1-based; 0 means "nothing hovered yet"
  const [hover, setHover] = React.useState({ rows: 0, cols: 0 });
  const [customRows, setCustomRows] = React.useState('3');
  const [customCols, setCustomCols] = React.useState('3');
  const gridRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    gridRef.current?.focus();
  }, []);

  const clamp = (value: number) =>
    Math.min(Math.max(value, 1), MAX_DIMENSION) || 1;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const { rows, cols } = hover;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        setHover({ rows: Math.max(rows - 1, 1), cols: Math.max(cols, 1) });
        return;
      case 'ArrowDown':
        event.preventDefault();
        setHover({
          rows: Math.min(rows + 1, GRID_ROWS),
          cols: Math.max(cols, 1),
        });
        return;
      case 'ArrowLeft':
        event.preventDefault();
        setHover({ rows: Math.max(rows, 1), cols: Math.max(cols - 1, 1) });
        return;
      case 'ArrowRight':
        event.preventDefault();
        setHover({
          rows: Math.max(rows, 1),
          cols: Math.min(cols + 1, GRID_COLS),
        });
        return;
      case 'Enter':
      case ' ':
        if (rows > 0 && cols > 0) {
          event.preventDefault();
          onSelect(rows, cols);
        }
        return;
    }
  };

  const dimensionLabel =
    hover.rows > 0
      ? `${hover.rows} × ${hover.cols}`
      : formatMessage({
          id: 'components.Blocks.table.pickSize',
          defaultMessage: 'Pick a size',
        });

  return (
    <Flex direction="column" alignItems="stretch" gap={3} padding={3}>
      <Grid
        ref={gridRef}
        role="grid"
        tabIndex={0}
        aria-label={formatMessage({
          id: 'components.Blocks.table.gridPicker',
          defaultMessage:
            'Table size picker. Use the arrow keys to choose rows and columns, then press Enter.',
        })}
        onKeyDown={handleKeyDown}
        onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
      >
        {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, index) => {
          const row = Math.floor(index / GRID_COLS) + 1;
          const col = (index % GRID_COLS) + 1;

          return (
            <Cell
              key={index}
              role="gridcell"
              aria-selected={row <= hover.rows && col <= hover.cols}
              $selected={row <= hover.rows && col <= hover.cols}
              onMouseEnter={() => setHover({ rows: row, cols: col })}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(row, col);
              }}
            />
          );
        })}
      </Grid>

      <Box aria-live="polite">
        <Typography variant="pi" textColor="neutral600">
          {dimensionLabel}
        </Typography>
      </Box>

      <Flex gap={2} alignItems="flex-end">
        <Field.Root width="7rem">
          <Field.Label>
            {formatMessage({
              id: 'components.Blocks.table.rows',
              defaultMessage: 'Rows',
            })}
          </Field.Label>
          <Field.Input
            type="number"
            min={1}
            max={MAX_DIMENSION}
            value={customRows}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setCustomRows(event.target.value)
            }
          />
        </Field.Root>
        <Field.Root width="7rem">
          <Field.Label>
            {formatMessage({
              id: 'components.Blocks.table.columns',
              defaultMessage: 'Columns',
            })}
          </Field.Label>
          <Field.Input
            type="number"
            min={1}
            max={MAX_DIMENSION}
            value={customCols}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setCustomCols(event.target.value)
            }
          />
        </Field.Root>
        <Button
          variant="secondary"
          onClick={() =>
            onSelect(clamp(Number(customRows)), clamp(Number(customCols)))
          }
        >
          {formatMessage({
            id: 'components.Blocks.insert',
            defaultMessage: 'Insert',
          })}
        </Button>
      </Flex>
    </Flex>
  );
};

export { TableGridPicker, GRID_ROWS, GRID_COLS, MAX_DIMENSION };
