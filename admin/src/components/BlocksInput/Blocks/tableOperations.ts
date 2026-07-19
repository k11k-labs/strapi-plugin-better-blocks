import { Editor, Path, Transforms, Node } from 'slate';

import type { CustomElement, TableCellAlign } from '../utils/types';

/* ---------------------------------------------------------------------------
 * Node factories
 * -------------------------------------------------------------------------*/

const CELL_TYPES = ['table-cell', 'table-header-cell'] as const;

const TABLE_TYPES = [
  'table',
  'table-row',
  'table-cell',
  'table-header-cell',
] as const;

const createTableCell = (isHeader = false) =>
  ({
    type: isHeader ? 'table-header-cell' : 'table-cell',
    children: [{ type: 'text', text: '' }],
  }) as unknown as CustomElement;

const createTableRow = (cols: number, isHeader = false) =>
  ({
    type: 'table-row',
    children: Array.from({ length: cols }, () => createTableCell(isHeader)),
  }) as unknown as CustomElement;

/**
 * Builds a table of `rows` x `cols`. The first row is a header row unless
 * `withHeader` is false, in which case every row holds plain data cells.
 */
const createTable = (rows: number, cols: number, withHeader = true) =>
  ({
    type: 'table',
    children: withHeader
      ? [
          createTableRow(cols, true),
          ...Array.from({ length: Math.max(rows - 1, 0) }, () =>
            createTableRow(cols)
          ),
        ]
      : Array.from({ length: rows }, () => createTableRow(cols)),
  }) as unknown as CustomElement;

/**
 * Inserts a table at the current selection, followed by an empty paragraph so
 * the author always has somewhere to continue writing below it.
 */
const insertTable = (editor: Editor, rows = 3, cols = 3, withHeader = true) => {
  const table = createTable(rows, cols, withHeader);
  const paragraph = {
    type: 'paragraph',
    children: [{ type: 'text', text: '' }],
  } as unknown as CustomElement;

  Transforms.insertNodes(editor, [table as never, paragraph as never]);
};

/* ---------------------------------------------------------------------------
 * Structure guard
 * -------------------------------------------------------------------------*/

/**
 * Runs `fn` with the table structure protection in `withTables` temporarily
 * lifted. Everything that legitimately adds/removes rows, columns or the table
 * itself has to go through here, otherwise `editor.apply` swallows the ops.
 */
const allowTableEdit = (editor: Editor, fn: () => void) => {
  (editor as unknown as { __allowTableEdit: boolean }).__allowTableEdit = true;
  try {
    Editor.withoutNormalizing(editor, fn);
  } finally {
    (editor as unknown as { __allowTableEdit: boolean }).__allowTableEdit =
      false;
  }
};

/* ---------------------------------------------------------------------------
 * Locating the caret within a table
 * -------------------------------------------------------------------------*/

const isCellType = (node: unknown): boolean =>
  Boolean(
    node &&
    typeof node === 'object' &&
    'type' in node &&
    CELL_TYPES.includes(
      (node as CustomElement).type as (typeof CELL_TYPES)[number]
    )
  );

const isTableElement = (node: unknown): boolean =>
  Boolean(
    node &&
    typeof node === 'object' &&
    'type' in node &&
    TABLE_TYPES.includes(
      (node as CustomElement).type as (typeof TABLE_TYPES)[number]
    )
  );

interface TableLocation {
  tablePath: Path;
  table: CustomElement;
  /** Index of the row holding the caret. */
  rowIndex: number;
  /** Index of the cell holding the caret, within its row. */
  colIndex: number;
  rowCount: number;
  colCount: number;
  cell: CustomElement;
  cellPath: Path;
}

/**
 * Resolves the table cell the caret currently sits in, together with its
 * coordinates. Returns null when the selection is outside any table.
 */
const getTableLocation = (editor: Editor): TableLocation | null => {
  const { selection } = editor;
  if (!selection) return null;

  const cellEntry = Editor.above(editor, {
    at: selection.anchor,
    match: (node) => !Editor.isEditor(node) && isCellType(node),
  });
  if (!cellEntry) return null;

  const [cell, cellPath] = cellEntry;
  // A cell always lives at [...tablePath, rowIndex, colIndex]
  if (cellPath.length < 3) return null;

  const tablePath = cellPath.slice(0, -2);
  const [table] = Editor.node(editor, tablePath);
  if (
    !table ||
    Editor.isEditor(table) ||
    (table as CustomElement).type !== 'table'
  ) {
    return null;
  }

  const rows = (table as CustomElement).children as CustomElement[];

  return {
    tablePath,
    table: table as CustomElement,
    rowIndex: cellPath[cellPath.length - 2],
    colIndex: cellPath[cellPath.length - 1],
    rowCount: rows.length,
    colCount: (rows[0]?.children as CustomElement[] | undefined)?.length ?? 0,
    cell: cell as CustomElement,
    cellPath,
  };
};

/** A row is a header row when every one of its cells is a header cell. */
const isHeaderRow = (row: CustomElement): boolean => {
  const cells = row.children as CustomElement[];
  return cells.length > 0 && cells.every((c) => c.type === 'table-header-cell');
};

/* ---------------------------------------------------------------------------
 * Row / column operations
 * -------------------------------------------------------------------------*/

const insertRow = (
  editor: Editor,
  location: TableLocation,
  position: 'above' | 'below'
) => {
  const { tablePath, rowIndex, colCount } = location;
  const at = position === 'above' ? rowIndex : rowIndex + 1;

  allowTableEdit(editor, () => {
    Transforms.insertNodes(editor, createTableRow(colCount) as never, {
      at: [...tablePath, at],
    });
  });

  // Put the caret in the first cell of the row we just created
  Transforms.select(editor, Editor.start(editor, [...tablePath, at, 0]));
};

const insertColumn = (
  editor: Editor,
  location: TableLocation,
  position: 'left' | 'right'
) => {
  const { tablePath, table, colIndex, rowIndex } = location;
  const at = position === 'left' ? colIndex : colIndex + 1;
  const rows = table.children as CustomElement[];

  allowTableEdit(editor, () => {
    // Reverse order keeps the paths of the rows we haven't touched yet valid
    for (let r = rows.length - 1; r >= 0; r--) {
      Transforms.insertNodes(
        editor,
        createTableCell(isHeaderRow(rows[r])) as never,
        { at: [...tablePath, r, at] }
      );
    }
  });

  Transforms.select(editor, Editor.start(editor, [...tablePath, rowIndex, at]));
};

const deleteRow = (editor: Editor, location: TableLocation) => {
  const { tablePath, table, rowIndex, rowCount } = location;
  // Never leave a table without rows
  if (rowCount <= 1) return;

  const rows = table.children as CustomElement[];
  const wasHeader = isHeaderRow(rows[rowIndex]);

  allowTableEdit(editor, () => {
    Transforms.removeNodes(editor, { at: [...tablePath, rowIndex] });

    // Deleting the header row promotes the row that takes its place, so the
    // table never ends up header-less by accident.
    if (wasHeader && rowIndex === 0) {
      const promoted = rows[1];
      if (promoted) {
        (promoted.children as CustomElement[]).forEach((_, c) => {
          Transforms.setNodes(
            editor,
            { type: 'table-header-cell' } as Partial<Node>,
            { at: [...tablePath, 0, c] }
          );
        });
      }
    }
  });

  const nextRow = Math.min(rowIndex, rowCount - 2);
  Transforms.select(editor, Editor.start(editor, [...tablePath, nextRow, 0]));
};

const deleteColumn = (editor: Editor, location: TableLocation) => {
  const { tablePath, table, colIndex, colCount, rowIndex } = location;
  // Never leave a table without columns
  if (colCount <= 1) return;

  const rows = table.children as CustomElement[];

  allowTableEdit(editor, () => {
    for (let r = rows.length - 1; r >= 0; r--) {
      Transforms.removeNodes(editor, { at: [...tablePath, r, colIndex] });
    }
  });

  const nextCol = Math.min(colIndex, colCount - 2);
  Transforms.select(
    editor,
    Editor.start(editor, [...tablePath, rowIndex, nextCol])
  );
};

const deleteTable = (editor: Editor, location: TableLocation) => {
  allowTableEdit(editor, () => {
    Transforms.removeNodes(editor, { at: location.tablePath });
  });
};

/* ---------------------------------------------------------------------------
 * Cell operations
 * -------------------------------------------------------------------------*/

/**
 * Applies a horizontal alignment to every cell the selection touches (a single
 * cell in the common case). `left` clears the property rather than storing it,
 * so untouched documents and left-aligned cells stay byte-identical.
 */
const setCellAlign = (editor: Editor, align: TableCellAlign) => {
  const cellEntries = Array.from(
    Editor.nodes(editor, {
      match: (node) => !Editor.isEditor(node) && isCellType(node),
    })
  );

  Editor.withoutNormalizing(editor, () => {
    cellEntries.forEach(([, path]) => {
      Transforms.setNodes(
        editor,
        { align: align === 'left' ? undefined : align } as Partial<Node>,
        { at: path }
      );
    });
  });
};

const getCellAlign = (location: TableLocation): TableCellAlign =>
  ((location.cell as { align?: TableCellAlign }).align as TableCellAlign) ??
  'left';

/**
 * Turns the table's first row into header cells, or back into data cells.
 * Header cells render as `<th scope="col">` for screen readers.
 */
const toggleHeaderRow = (editor: Editor, location: TableLocation) => {
  const { tablePath, table } = location;
  const rows = table.children as CustomElement[];
  const firstRow = rows[0];
  if (!firstRow) return;

  const nextType = isHeaderRow(firstRow) ? 'table-cell' : 'table-header-cell';

  allowTableEdit(editor, () => {
    (firstRow.children as CustomElement[]).forEach((_, c) => {
      Transforms.setNodes(editor, { type: nextType } as Partial<Node>, {
        at: [...tablePath, 0, c],
      });
    });
  });
};

const hasHeaderRow = (location: TableLocation): boolean => {
  const firstRow = (location.table.children as CustomElement[])[0];
  return Boolean(firstRow && isHeaderRow(firstRow));
};

export {
  type TableLocation,
  CELL_TYPES,
  TABLE_TYPES,
  allowTableEdit,
  createTable,
  createTableCell,
  createTableRow,
  deleteColumn,
  deleteRow,
  deleteTable,
  getCellAlign,
  getTableLocation,
  hasHeaderRow,
  insertColumn,
  insertRow,
  insertTable,
  isCellType,
  isHeaderRow,
  isTableElement,
  setCellAlign,
  toggleHeaderRow,
};
