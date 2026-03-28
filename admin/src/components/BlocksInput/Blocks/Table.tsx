import * as React from 'react';
import { Box, Button, Flex, Popover } from '@strapi/design-system';
import { GridNine } from '@strapi/icons';
import { Editor, Transforms } from 'slate';
import {
  type RenderElementProps,
  ReactEditor,
  useSlateStatic,
} from 'slate-react';
import { styled } from 'styled-components';

import { type BlocksStore } from '../BlocksEditor';
import { CustomElement } from '../utils/types';

/* ---------------------------------------------------------------------------
 * Styled components
 * -------------------------------------------------------------------------*/

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin: ${({ theme }) => theme.spaces[2]} 0;

  th,
  td {
    border: 1px solid ${({ theme }) => theme.colors.neutral200};
    padding: ${({ theme }) => theme.spaces[2]} ${({ theme }) => theme.spaces[3]};
    min-width: 80px;
    vertical-align: top;
    position: relative;
  }

  th {
    background: ${({ theme }) => theme.colors.neutral100};
    font-weight: ${({ theme }) => theme.fontWeights.bold};
  }
`;

const TableWrapper = styled(Box)`
  padding-top: 32px;
`;

const TableActions = styled(Flex)`
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
`;

const ActionBtn = styled.button`
  background: ${({ theme }) => theme.colors.neutral100};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: 2px 6px;
  cursor: pointer;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.neutral600};

  &:hover {
    background: ${({ theme }) => theme.colors.primary100};
    color: ${({ theme }) => theme.colors.primary600};
  }
`;

/* ---------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------*/

const createTableCell = (isHeader = false) => ({
  type: isHeader ? 'table-header-cell' : 'table-cell',
  children: [{ type: 'text', text: '' }],
});

const createTableRow = (cols: number, isHeader = false) => ({
  type: 'table-row',
  children: Array.from({ length: cols }, () => createTableCell(isHeader)),
});

const createTable = (rows: number, cols: number) => ({
  type: 'table',
  children: [
    createTableRow(cols, true),
    ...Array.from({ length: rows - 1 }, () => createTableRow(cols)),
  ],
});

const insertTable = (editor: Editor, rows = 3, cols = 3) => {
  const table = createTable(rows, cols);
  const paragraph = {
    type: 'paragraph',
    children: [{ type: 'text', text: '' }],
  };
  Transforms.insertNodes(editor, [table as any, paragraph as any]);
};

/* ---------------------------------------------------------------------------
 * Components
 * -------------------------------------------------------------------------*/

const TableElement = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const editor = useSlateStatic();
  const [showActions, setShowActions] = React.useState(false);
  const path = ReactEditor.findPath(editor as ReactEditor, element);

  const addRow = () => {
    allowTableEdit(editor, () => {
      const tableNode = element as any;
      const colCount = tableNode.children[0]?.children?.length || 3;
      const newRow = createTableRow(colCount);
      Transforms.insertNodes(editor, newRow as any, {
        at: [...path, tableNode.children.length],
      });
    });
  };

  const addColumn = () => {
    allowTableEdit(editor, () => {
      const tableNode = element as any;
      const colCount = tableNode.children[0]?.children?.length || 0;
      for (
        let rowIndex = tableNode.children.length - 1;
        rowIndex >= 0;
        rowIndex--
      ) {
        const isHeader = rowIndex === 0;
        Transforms.insertNodes(editor, createTableCell(isHeader) as any, {
          at: [...path, rowIndex, colCount],
        });
      }
    });
  };

  const removeTable = () => {
    allowTableEdit(editor, () => {
      Transforms.removeNodes(editor, { at: path });
    });
  };

  return (
    <TableWrapper
      {...attributes}
      position="relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {showActions && (
        <TableActions contentEditable={false} gap={1}>
          <ActionBtn
            onMouseDown={(e) => {
              e.preventDefault();
              addRow();
            }}
          >
            + Row
          </ActionBtn>
          <ActionBtn
            onMouseDown={(e) => {
              e.preventDefault();
              addColumn();
            }}
          >
            + Col
          </ActionBtn>
          <ActionBtn
            onMouseDown={(e) => {
              e.preventDefault();
              removeTable();
            }}
          >
            Delete
          </ActionBtn>
        </TableActions>
      )}
      <StyledTable>
        <tbody>{children}</tbody>
      </StyledTable>
    </TableWrapper>
  );
};

const TableRowElement = ({ attributes, children }: RenderElementProps) => {
  return <tr {...attributes}>{children}</tr>;
};

const TableCellElement = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const isHeader = (element as any).type === 'table-header-cell';
  const Tag = isHeader ? 'th' : 'td';
  return <Tag {...attributes}>{children}</Tag>;
};

/* ---------------------------------------------------------------------------
 * Void plugin for table structure
 * -------------------------------------------------------------------------*/

const TABLE_TYPES = ['table', 'table-row', 'table-cell', 'table-header-cell'];

const isTableElement = (node: any): boolean =>
  node && 'type' in node && TABLE_TYPES.includes(node.type);

/**
 * Run a callback with table structure protection temporarily disabled.
 * Used by toolbar action buttons (+ Row, + Col, Delete) that need to
 * legitimately modify table structure.
 */
const allowTableEdit = (editor: Editor, fn: () => void) => {
  (editor as any).__allowTableEdit = true;
  fn();
  (editor as any).__allowTableEdit = false;
};

const withTables = (editor: Editor): Editor => {
  const { deleteBackward, deleteForward, insertBreak, normalizeNode, apply } =
    editor;

  // Block any operation that would remove/merge/move table structure nodes
  // unless explicitly allowed by allowTableEdit()
  editor.apply = (op) => {
    if ((editor as any).__allowTableEdit) {
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
            ? (op as any).node
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
        if (
          isTableElement(node) &&
          (op as any).newProperties?.type &&
          !TABLE_TYPES.includes((op as any).newProperties.type)
        ) {
          return;
        }
      } catch {
        // Path may be invalid
      }
    }

    apply(op);
  };

  // Prevent normalizer from removing table structure nodes
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
          ((n as any).type === 'table-cell' ||
            (n as any).type === 'table-header-cell'),
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
          ((n as any).type === 'table-cell' ||
            (n as any).type === 'table-header-cell'),
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
          !Editor.isEditor(n) && 'type' in n && (n as any).type === 'table',
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
    matchNode: (node) => (node as any).type === 'table',
    isInBlocksSelector: false,
  },
  'table-row': {
    renderElement: (props) => <TableRowElement {...props} />,
    matchNode: (node) => (node as any).type === 'table-row',
    isInBlocksSelector: false,
  },
  'table-cell': {
    renderElement: (props) => <TableCellElement {...props} />,
    matchNode: (node) => (node as any).type === 'table-cell',
    isInBlocksSelector: false,
  },
  'table-header-cell': {
    renderElement: (props) => <TableCellElement {...props} />,
    matchNode: (node) => (node as any).type === 'table-header-cell',
    isInBlocksSelector: false,
  },
};

export { tableBlocks, withTables, insertTable };
