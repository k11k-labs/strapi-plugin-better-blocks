import * as React from 'react';
import { Box } from '@strapi/design-system';
import { Editor, type Node as SlateNode, Path, Transforms } from 'slate';
import {
  type RenderElementProps,
  ReactEditor,
  useSlate,
  useSlateStatic,
} from 'slate-react';
import { styled } from 'styled-components';

import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import type {
  CustomElement,
  TableCellAlign,
  TableCellElement,
} from '../utils/types';
import { TableToolbar } from './TableToolbar';
import {
  type GridRange,
  type TableGrid,
  buildTableGrid,
  covers,
  findCellByPath,
} from './tableGrid';
import {
  TABLE_TYPES,
  allowTableEdit,
  createTableCell,
  createTableRow,
  getTableLocation,
  insertTable,
  isTableElement,
} from './tableOperations';

/* ---------------------------------------------------------------------------
 * Styled components
 * -------------------------------------------------------------------------*/

/** Height reserved above every table for the contextual toolbar, so showing it
 *  doesn't shift the document. */
const TOOLBAR_GUTTER = '3.6rem';

const TableWrapper = styled(Box)`
  padding-top: ${TOOLBAR_GUTTER};
`;

/** Wide tables scroll horizontally instead of overflowing the editor. */
const TableScroller = styled.div`
  overflow-x: auto;
  max-width: 100%;
`;

const StyledTable = styled.table<{ $hasRange: boolean }>`
  width: 100%;
  border-collapse: collapse;
  margin: ${({ theme }) => theme.spaces[2]} 0;

  th,
  td {
    /* 2px against a mid-grey: the 1px hairline was effectively invisible on
       high-DPI screens, which made large tables hard to navigate. */
    border: 2px solid ${({ theme }) => theme.colors.neutral400};
    padding: ${({ theme }) => theme.spaces[2]} ${({ theme }) => theme.spaces[3]};
    min-width: 80px;
    vertical-align: top;
    position: relative;
  }

  th {
    background: ${({ theme }) => theme.colors.neutral100};
    font-weight: ${({ theme }) => theme.fontWeights.bold};
    text-align: inherit;
  }

  /* Cells carry their own highlight — with colSpan/rowSpan in play, a cell's
     index within its row is no longer its visual column, so nth-child rules
     can't identify a column any more. */
  th[data-highlight='active'],
  td[data-highlight='active'] {
    background: ${({ theme }) => theme.colors.primary100};
  }

  th[data-highlight='range'],
  td[data-highlight='range'] {
    background: ${({ theme }) => theme.colors.primary200};
  }

  /* While a range of cells is selected, the browser's own text highlight would
     paint across the range tint and read as two competing selections. */
  ${({ $hasRange }) =>
    $hasRange ? '& ::selection { background: transparent; }' : ''}
`;

/* ---------------------------------------------------------------------------
 * Components
 * -------------------------------------------------------------------------*/

/**
 * Lets each cell work out whether it should be highlighted.
 *
 * Cells are rendered independently by Slate's renderElement, so they can't see
 * the table's grid on their own — and with spans they can't be identified by
 * child index either. Only the focused table provides a value; every other
 * table renders with `null` and no highlight.
 */
interface TableSelectionValue {
  grid: TableGrid;
  activeRow: number;
  activeCol: number;
  range: GridRange | null;
}

const TableSelectionContext = React.createContext<TableSelectionValue | null>(
  null
);

const TableElement = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  // useSlate (not useSlateStatic) so the toolbar and the highlights follow the
  // caret.
  const editor = useSlate();
  const { disabled } = useBlocksEditorContext('TableElement');
  const path = ReactEditor.findPath(editor as ReactEditor, element);

  const location = getTableLocation(editor);
  const isFocused = Boolean(location && Path.equals(location.tablePath, path));

  const selection = React.useMemo<TableSelectionValue | null>(
    () =>
      isFocused && location
        ? {
            grid: location.grid,
            activeRow: location.rowIndex,
            activeCol: location.colIndex,
            range: location.range,
          }
        : null,
    [isFocused, location]
  );

  return (
    <TableWrapper {...attributes} position="relative">
      {isFocused && location && (
        <TableToolbar location={location} disabled={disabled} />
      )}
      <TableScroller>
        <StyledTable $hasRange={Boolean(selection?.range)}>
          <TableSelectionContext.Provider value={selection}>
            <tbody>{children}</tbody>
          </TableSelectionContext.Provider>
        </StyledTable>
      </TableScroller>
    </TableWrapper>
  );
};

const TableRowElement = ({ attributes, children }: RenderElementProps) => (
  <tr {...attributes}>{children}</tr>
);

/** Background tint for a cell, or undefined when it isn't highlighted. */
const useCellHighlight = (
  element: RenderElementProps['element']
): 'range' | 'active' | undefined => {
  const editor = useSlateStatic();
  const selection = React.useContext(TableSelectionContext);
  if (!selection) return undefined;

  let path: Path;
  try {
    path = ReactEditor.findPath(editor as ReactEditor, element);
  } catch {
    return undefined;
  }

  const cell = findCellByPath(selection.grid, path);
  if (!cell) return undefined;

  const { range } = selection;
  if (range) {
    const overlapsRange =
      cell.row <= range.bottom &&
      cell.row + cell.rowSpan - 1 >= range.top &&
      cell.col <= range.right &&
      cell.col + cell.colSpan - 1 >= range.left;
    return overlapsRange ? 'range' : undefined;
  }

  // Orientation aid: tint the row and column holding the caret
  const inActiveRow = covers(cell, selection.activeRow, cell.col);
  const inActiveCol = covers(cell, cell.row, selection.activeCol);
  return inActiveRow || inActiveCol ? 'active' : undefined;
};

const TableCellElementComponent = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const cell = element as TableCellElement;
  const isHeader = cell.type === 'table-header-cell';
  const Tag = isHeader ? 'th' : 'td';
  const align = (cell.align as TableCellAlign | undefined) ?? 'left';
  const highlight = useCellHighlight(element);

  return (
    <Tag
      {...attributes}
      // Header cells label their column for screen readers.
      scope={isHeader ? 'col' : undefined}
      // Absent spans mean 1; React omits the attribute for undefined.
      colSpan={cell.colSpan && cell.colSpan > 1 ? cell.colSpan : undefined}
      rowSpan={cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined}
      data-highlight={highlight}
      style={{ textAlign: align }}
    >
      {children}
    </Tag>
  );
};

/* ---------------------------------------------------------------------------
 * Table structure plugin
 * -------------------------------------------------------------------------*/

/**
 * Trims any `rowSpan` that reaches past the last row, or `colSpan` past the
 * widest row. Returns true when something was changed, so the caller can let
 * Slate re-run normalization on the repaired table.
 */
const clampOversizedSpans = (
  editor: Editor,
  table: CustomElement,
  tablePath: Path
): boolean => {
  const grid = buildTableGrid(table, tablePath);
  let repaired = false;

  for (const cell of grid.cells) {
    const maxRowSpan = Math.max(grid.rowCount - cell.row, 1);
    const maxColSpan = Math.max(grid.colCount - cell.col, 1);
    const next: Record<string, number | undefined> = {};

    if (cell.rowSpan > maxRowSpan) {
      next.rowSpan = maxRowSpan > 1 ? maxRowSpan : undefined;
    }
    if (cell.colSpan > maxColSpan) {
      next.colSpan = maxColSpan > 1 ? maxColSpan : undefined;
    }

    if (Object.keys(next).length > 0) {
      allowTableEdit(editor, () => {
        Transforms.setNodes(editor, next as Partial<SlateNode>, {
          at: cell.path,
        });
      });
      repaired = true;
    }
  }

  return repaired;
};

/**
 * Protects the table's shape from Slate's generic editing behaviours (deleting
 * across cells, normalizing rows away, converting a cell to a paragraph, …).
 *
 * Structural edits are performed by tableOperations, which lifts the guard via
 * `allowTableEdit`. Inline editing inside a cell — marks, links, inline math —
 * is deliberately untouched, so cells keep full rich-text parity.
 */
const withTables = (editor: Editor): Editor => {
  const { deleteBackward, deleteForward, insertBreak, normalizeNode, apply } =
    editor;

  editor.apply = (op) => {
    if (
      (editor as unknown as { __allowTableEdit?: boolean }).__allowTableEdit
    ) {
      apply(op);
      return;
    }

    if (
      (op.type === 'remove_node' ||
        op.type === 'merge_node' ||
        op.type === 'move_node') &&
      op.path.length > 0
    ) {
      try {
        const node =
          op.type === 'remove_node'
            ? (op as { node: unknown }).node
            : Editor.node(editor, op.path)?.[0];
        if (node && isTableElement(node)) {
          return; // Block this operation
        }
      } catch {
        // Path may be invalid, let it through
      }
    }

    // Block set_node that would change a table cell type to something else
    if (op.type === 'set_node' && op.path.length > 0) {
      try {
        const [node] = Editor.node(editor, op.path);
        const newType = (op as { newProperties?: { type?: string } })
          .newProperties?.type;
        if (
          isTableElement(node) &&
          newType &&
          !(TABLE_TYPES as readonly string[]).includes(newType)
        ) {
          return;
        }
      } catch {
        // Path may be invalid
      }
    }

    apply(op);
  };

  // Prevent the normalizer from removing table structure nodes
  editor.normalizeNode = (entry) => {
    const [node, path] = entry;

    if (isTableElement(node)) {
      // The one repair worth making: spans that reach past the table's bounds.
      // The operations here can't produce those, but hand-edited or imported
      // JSON can, and an over-long span throws off every grid calculation.
      // Clamping strictly decreases the spans, so this always terminates.
      if ((node as CustomElement).type === 'table') {
        if (clampOversizedSpans(editor, node as CustomElement, path)) return;
      }
      return;
    }

    normalizeNode(entry);
  };

  // Prevent deleting across table cell boundaries
  editor.deleteBackward = (unit) => {
    const { selection } = editor;
    if (selection) {
      const [cell] = Editor.nodes(editor, {
        match: (n) =>
          !Editor.isEditor(n) &&
          'type' in n &&
          ((n as { type: string }).type === 'table-cell' ||
            (n as { type: string }).type === 'table-header-cell'),
      });
      if (cell) {
        const [, cellPath] = cell;
        if (Editor.isStart(editor, selection.anchor, cellPath)) {
          return;
        }
      }
    }
    deleteBackward(unit);
  };

  editor.deleteForward = (unit) => {
    const { selection } = editor;
    if (selection) {
      const [cell] = Editor.nodes(editor, {
        match: (n) =>
          !Editor.isEditor(n) &&
          'type' in n &&
          ((n as { type: string }).type === 'table-cell' ||
            (n as { type: string }).type === 'table-header-cell'),
      });
      if (cell) {
        const [, cellPath] = cell;
        if (Editor.isEnd(editor, selection.anchor, cellPath)) {
          return;
        }
      }
    }
    deleteForward(unit);
  };

  // In a table, Enter inserts a soft break (newline within cell)
  editor.insertBreak = () => {
    const { selection } = editor;
    if (selection) {
      const [table] = Editor.nodes(editor, {
        match: (n) =>
          !Editor.isEditor(n) &&
          'type' in n &&
          (n as { type: string }).type === 'table',
      });
      if (table) {
        Transforms.insertText(editor, '\n');
        return;
      }
    }
    insertBreak();
  };

  return editor;
};

/* ---------------------------------------------------------------------------
 * Block definitions
 * -------------------------------------------------------------------------*/

const tableBlocks: Pick<
  BlocksStore,
  'table' | 'table-row' | 'table-cell' | 'table-header-cell'
> = {
  table: {
    renderElement: (props) => <TableElement {...props} />,
    matchNode: (node) => (node as { type: string }).type === 'table',
    isInBlocksSelector: false,
  },
  'table-row': {
    renderElement: (props) => <TableRowElement {...props} />,
    matchNode: (node) => (node as { type: string }).type === 'table-row',
    isInBlocksSelector: false,
  },
  'table-cell': {
    renderElement: (props) => <TableCellElementComponent {...props} />,
    matchNode: (node) => (node as { type: string }).type === 'table-cell',
    isInBlocksSelector: false,
  },
  'table-header-cell': {
    renderElement: (props) => <TableCellElementComponent {...props} />,
    matchNode: (node) =>
      (node as { type: string }).type === 'table-header-cell',
    isInBlocksSelector: false,
  },
};

export {
  tableBlocks,
  withTables,
  insertTable,
  createTableCell,
  createTableRow,
};
