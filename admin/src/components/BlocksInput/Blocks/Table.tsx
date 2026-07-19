import * as React from 'react';
import { Box } from '@strapi/design-system';
import { Editor, Path, Transforms } from 'slate';
import { type RenderElementProps, ReactEditor, useSlate } from 'slate-react';
import { styled } from 'styled-components';

import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import type { TableCellAlign, TableCellElement } from '../utils/types';
import { TableToolbar } from './TableToolbar';
import {
  TABLE_TYPES,
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

const StyledTable = styled.table<{
  $activeRow: number | null;
  $activeCol: number | null;
}>`
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

  /* Spatial orientation while editing: tint the row and column holding the
     caret. Both rules are cheap nth-child selectors, no per-cell state. */
  ${({ $activeRow, theme }) =>
    $activeRow
      ? `tr:nth-child(${$activeRow}) > * { background: ${theme.colors.primary100}; }`
      : ''}
  ${({ $activeCol, theme }) =>
    $activeCol
      ? `tr > *:nth-child(${$activeCol}) { background: ${theme.colors.primary100}; }`
      : ''}
`;

/* ---------------------------------------------------------------------------
 * Components
 * -------------------------------------------------------------------------*/

const TableElement = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  // useSlate (not useSlateStatic) so the toolbar and the active row/column
  // highlight follow the caret.
  const editor = useSlate();
  const { disabled } = useBlocksEditorContext('TableElement');
  const path = ReactEditor.findPath(editor as ReactEditor, element);

  const location = getTableLocation(editor);
  const isFocused = Boolean(location && Path.equals(location.tablePath, path));

  return (
    <TableWrapper {...attributes} position="relative">
      {isFocused && location && (
        <TableToolbar location={location} disabled={disabled} />
      )}
      <TableScroller>
        <StyledTable
          $activeRow={isFocused && location ? location.rowIndex + 1 : null}
          $activeCol={isFocused && location ? location.colIndex + 1 : null}
        >
          <tbody>{children}</tbody>
        </StyledTable>
      </TableScroller>
    </TableWrapper>
  );
};

const TableRowElement = ({ attributes, children }: RenderElementProps) => (
  <tr {...attributes}>{children}</tr>
);

const TableCellElementComponent = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const cell = element as TableCellElement;
  const isHeader = cell.type === 'table-header-cell';
  const Tag = isHeader ? 'th' : 'td';
  const align = (cell.align as TableCellAlign | undefined) ?? 'left';

  return (
    <Tag
      {...attributes}
      // Header cells label their column for screen readers.
      scope={isHeader ? 'col' : undefined}
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
    const [node] = entry;
    if (isTableElement(node)) {
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
