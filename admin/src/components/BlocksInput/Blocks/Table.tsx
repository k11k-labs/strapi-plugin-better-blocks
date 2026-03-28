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

const TableActions = styled(Flex)`
  position: absolute;
  top: -32px;
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
    const tableNode = element as any;
    const colCount = tableNode.children[0]?.children?.length || 3;
    const newRow = createTableRow(colCount);
    Transforms.insertNodes(editor, newRow as any, {
      at: [...path, tableNode.children.length],
    });
  };

  const addColumn = () => {
    const tableNode = element as any;
    tableNode.children.forEach((_: any, rowIndex: number) => {
      const isHeader = rowIndex === 0;
      Transforms.insertNodes(editor, createTableCell(isHeader) as any, {
        at: [...path, rowIndex, tableNode.children[rowIndex].children.length],
      });
    });
  };

  const removeTable = () => {
    Transforms.removeNodes(editor, { at: path });
  };

  return (
    <Box
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
    </Box>
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

const withTables = (editor: Editor): Editor => {
  const { deleteBackward, deleteForward, insertBreak } = editor;

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
        const start = Editor.start(editor, cellPath);
        if (Editor.isStart(editor, selection.anchor, cellPath)) {
          return; // Don't delete backward at start of cell
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
          return; // Don't delete forward at end of cell
        }
      }
    }
    deleteForward(unit);
  };

  // Tab between cells instead of inserting tab character
  editor.insertBreak = () => {
    const { selection } = editor;
    if (selection) {
      const [table] = Editor.nodes(editor, {
        match: (n) =>
          !Editor.isEditor(n) && 'type' in n && (n as any).type === 'table',
      });
      if (table) {
        // In a table, insert a soft break (newline within cell)
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
