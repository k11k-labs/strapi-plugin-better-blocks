import { Editor, Node, Path, Transforms } from 'slate';

import type {
  CustomElement,
  TableCellAlign,
  TableCellElement,
} from '../utils/types';
import {
  type GridCell,
  type GridRange,
  type TableGrid,
  buildTableGrid,
  cellsInRange,
  cellsOriginatingInRow,
  findCellByPath,
  getSelectedRange,
  nodeIndexForColumn,
} from './tableGrid';

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

/** Moves the caret to the start of a path, ignoring paths that no longer exist. */
const selectStartOf = (editor: Editor, path: Path) => {
  try {
    Transforms.select(editor, Editor.start(editor, path));
  } catch {
    // The operation may have removed whatever we hoped to land on
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
  /** Span-aware layout of the whole table. */
  grid: TableGrid;
  /** The cell holding the caret, with its grid coordinates. */
  focused: GridCell;
  /** Rectangle of cells the selection covers, or null within a single cell. */
  range: GridRange | null;
  /** Row the caret's cell lives in. */
  rowIndex: number;
  /** Leftmost grid column the caret's cell covers. */
  colIndex: number;
  rowCount: number;
  /** Total grid columns, spans included. */
  colCount: number;
  cell: CustomElement;
  cellPath: Path;
}

/**
 * Resolves the table cell the caret currently sits in, together with the grid
 * it belongs to. Returns null when the selection is outside any table.
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
  // A cell always lives at [...tablePath, rowIndex, indexInRow]
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

  const grid = buildTableGrid(table as CustomElement, tablePath);
  const focused = findCellByPath(grid, cellPath);
  if (!focused) return null;

  return {
    tablePath,
    table: table as CustomElement,
    grid,
    focused,
    range: getSelectedRange(editor, grid),
    rowIndex: focused.row,
    colIndex: focused.col,
    rowCount: grid.rowCount,
    colCount: grid.colCount,
    cell: cell as CustomElement,
    cellPath,
  };
};

/** A row is a header row when every one of its cells is a header cell. */
const isHeaderRow = (row: CustomElement): boolean => {
  const cells = row.children as CustomElement[];
  return cells.length > 0 && cells.every((c) => c.type === 'table-header-cell');
};

const isHeaderRowAt = (table: CustomElement, rowIndex: number): boolean => {
  const row = (table.children as CustomElement[])[rowIndex];
  return Boolean(row && isHeaderRow(row));
};

/** Span value to store: 1 becomes absent, so unmerged cells stay clean. */
const spanProp = (value: number): number | undefined =>
  value > 1 ? value : undefined;

/* ---------------------------------------------------------------------------
 * Column operations
 * -------------------------------------------------------------------------*/

/**
 * Inserts a column beside the caret's cell.
 *
 * A cell that straddles the insertion boundary is widened rather than given a
 * new neighbour — otherwise the merge would visually break apart. Every other
 * row gets a fresh cell, placed at the child index that lands it in the new
 * grid column (which is not the same as the column number once spans exist).
 */
const insertColumn = (
  editor: Editor,
  location: TableLocation,
  position: 'left' | 'right'
) => {
  const { grid, focused, tablePath, table } = location;
  const boundary =
    position === 'left' ? focused.col : focused.col + focused.colSpan;

  const straddling = grid.cells.filter(
    (cell) => cell.col < boundary && cell.col + cell.colSpan > boundary
  );
  const straddlingSet = new Set(straddling);

  const insertions: { path: Path; isHeader: boolean }[] = [];
  for (let row = 0; row < grid.rowCount; row++) {
    const occupant = grid.matrix[row]?.[boundary];
    // A straddling cell already reaches into the new column
    if (occupant && straddlingSet.has(occupant)) continue;

    insertions.push({
      path: [...tablePath, row, nodeIndexForColumn(grid, row, boundary)],
      isHeader: isHeaderRowAt(table, row),
    });
  }

  allowTableEdit(editor, () => {
    // Widen first: these paths come from the pre-insert grid
    straddling.forEach((cell) => {
      Transforms.setNodes(
        editor,
        { colSpan: cell.colSpan + 1 } as Partial<Node>,
        { at: cell.path }
      );
    });

    insertions.forEach(({ path, isHeader }) => {
      Transforms.insertNodes(editor, createTableCell(isHeader) as never, {
        at: path,
      });
    });
  });

  const landing = insertions.find(
    (insertion) => insertion.path[insertion.path.length - 2] === focused.row
  );
  if (landing) selectStartOf(editor, landing.path);
};

/**
 * Deletes the grid column the caret's cell starts in. Cells that span across it
 * shrink by one instead of disappearing.
 */
const deleteColumn = (editor: Editor, location: TableLocation) => {
  const { grid, focused } = location;
  if (grid.colCount <= 1) return;

  const target = focused.col;
  const affected = new Set<GridCell>();
  for (let row = 0; row < grid.rowCount; row++) {
    const cell = grid.matrix[row]?.[target];
    if (cell) affected.add(cell);
  }

  const shrinking = [...affected].filter((cell) => cell.colSpan > 1);
  const removing = [...affected].filter((cell) => cell.colSpan === 1);

  allowTableEdit(editor, () => {
    shrinking.forEach((cell) => {
      Transforms.setNodes(
        editor,
        { colSpan: spanProp(cell.colSpan - 1) } as Partial<Node>,
        { at: cell.path }
      );
    });

    // Descending order keeps the not-yet-removed paths valid
    removing
      .map((cell) => cell.path)
      .sort((a, b) => Path.compare(b, a))
      .forEach((path) => Transforms.removeNodes(editor, { at: path }));
  });

  selectStartOf(editor, [
    ...location.tablePath,
    focused.row,
    Math.max(nodeIndexForColumn(grid, focused.row, target) - 1, 0),
  ]);
};

/* ---------------------------------------------------------------------------
 * Row operations
 * -------------------------------------------------------------------------*/

/**
 * Inserts a row above or below the caret's cell. Cells whose rowSpan straddles
 * the boundary are stretched instead of being split by the new row, and the new
 * row only gets cells for the columns those stretched cells don't already cover.
 */
const insertRow = (
  editor: Editor,
  location: TableLocation,
  position: 'above' | 'below'
) => {
  const { grid, focused, tablePath } = location;
  const boundary =
    position === 'above' ? focused.row : focused.row + focused.rowSpan;

  const straddling = grid.cells.filter(
    (cell) => cell.row < boundary && cell.row + cell.rowSpan > boundary
  );
  const straddlingSet = new Set(straddling);

  let newCellCount = 0;
  for (let col = 0; col < grid.colCount; col++) {
    const occupant = grid.matrix[boundary]?.[col];
    if (occupant && straddlingSet.has(occupant)) continue;
    newCellCount++;
  }

  allowTableEdit(editor, () => {
    straddling.forEach((cell) => {
      Transforms.setNodes(
        editor,
        { rowSpan: cell.rowSpan + 1 } as Partial<Node>,
        { at: cell.path }
      );
    });

    Transforms.insertNodes(editor, createTableRow(newCellCount) as never, {
      at: [...tablePath, boundary],
    });
  });

  selectStartOf(editor, [...tablePath, boundary, 0]);
};

/**
 * Deletes the row the caret sits in.
 *
 * Cells reaching into the row from above simply shrink. Cells that *start* in
 * the row but continue below it can't just be removed — they're re-inserted
 * into the following row, one row shorter, so the merge survives.
 */
const deleteRow = (editor: Editor, location: TableLocation) => {
  const { grid, focused, tablePath, table } = location;
  if (grid.rowCount <= 1) return;

  const target = focused.row;
  const wasHeader = isHeaderRowAt(table, target);

  const shrinking = grid.cells.filter(
    (cell) => cell.row < target && cell.row + cell.rowSpan > target
  );
  const migrating = grid.cells
    .filter((cell) => cell.row === target && cell.rowSpan > 1)
    .sort((a, b) => a.col - b.col);

  allowTableEdit(editor, () => {
    shrinking.forEach((cell) => {
      Transforms.setNodes(
        editor,
        { rowSpan: spanProp(cell.rowSpan - 1) } as Partial<Node>,
        { at: cell.path }
      );
    });

    // Re-home cells that continue past this row into the next one
    migrating.forEach((cell, migratedSoFar) => {
      const clone = {
        ...(JSON.parse(JSON.stringify(cell.node)) as TableCellElement),
        rowSpan: spanProp(cell.rowSpan - 1),
      };

      Transforms.insertNodes(editor, clone as never, {
        at: [
          ...tablePath,
          target + 1,
          nodeIndexForColumn(grid, target + 1, cell.col) + migratedSoFar,
        ],
      });
    });

    Transforms.removeNodes(editor, { at: [...tablePath, target] });

    // Deleting the header row promotes its successor, so the table never ends
    // up header-less by accident.
    if (wasHeader && target === 0) {
      const [promoted] = Editor.node(editor, [...tablePath, 0]);
      ((promoted as CustomElement).children as CustomElement[]).forEach(
        (_, index) => {
          Transforms.setNodes(
            editor,
            { type: 'table-header-cell' } as Partial<Node>,
            { at: [...tablePath, 0, index] }
          );
        }
      );
    }
  });

  selectStartOf(editor, [...tablePath, Math.min(target, grid.rowCount - 2), 0]);
};

const deleteTable = (editor: Editor, location: TableLocation) => {
  allowTableEdit(editor, () => {
    Transforms.removeNodes(editor, { at: location.tablePath });
  });
};

/* ---------------------------------------------------------------------------
 * Merge & split
 * -------------------------------------------------------------------------*/

/**
 * Whether a range straddles the header/body divide.
 *
 * A header cell labels a column; one that runs from the header down into the
 * body labels nothing and belongs to neither. HTML agrees — a `rowSpan` may not
 * cross the `<thead>`/`<tbody>` boundary, so a browser would clamp it and render
 * something different from what the editor shows. Merging is therefore confined
 * to one side of the divide. Merging *within* the header (a heading spanning two
 * columns) is perfectly fine and stays allowed.
 */
const rangeCrossesHeaderBoundary = (
  table: CustomElement,
  range: GridRange
): boolean => {
  const topIsHeader = isHeaderRowAt(table, range.top);

  for (let row = range.top + 1; row <= range.bottom; row++) {
    if (isHeaderRowAt(table, row) !== topIsHeader) return true;
  }

  return false;
};

/** Whether the selection covers enough distinct cells to merge. */
const canMergeCells = (location: TableLocation): boolean => {
  if (!location.range) return false;
  if (rangeCrossesHeaderBoundary(location.table, location.range)) return false;
  return cellsInRange(location.grid, location.range).length > 1;
};

/** Whether the caret's cell is the result of a merge. */
const canSplitCell = (location: TableLocation): boolean =>
  location.focused.colSpan > 1 || location.focused.rowSpan > 1;

/**
 * Merges the selected rectangle into its top-left cell.
 *
 * The range arrives already squared off (see expandRangeToRectangle), so the
 * result always tiles the grid. Content from the absorbed cells is appended to
 * the anchor rather than discarded — losing an author's text to a layout
 * operation would be unforgivable.
 */
const mergeCells = (editor: Editor, location: TableLocation) => {
  const { grid, range, tablePath, table } = location;
  if (!range) return;
  // Guarded in the toolbar too; repeated here so the operation is safe to call
  // from anywhere.
  if (rangeCrossesHeaderBoundary(table, range)) return;

  const anchor = grid.matrix[range.top]?.[range.left];
  if (!anchor) return;

  const absorbed = cellsInRange(grid, range).filter((cell) => cell !== anchor);
  if (absorbed.length === 0) return;

  // Snapshot the content before anything moves
  const carriedOver = absorbed
    .filter((cell) => Node.string(cell.node).trim() !== '')
    .flatMap(
      (cell) => JSON.parse(JSON.stringify(cell.node.children)) as Node[]
    );

  const anchorHasContent = Node.string(anchor.node).trim() !== '';

  allowTableEdit(editor, () => {
    if (carriedOver.length > 0) {
      const at = [...anchor.path, anchor.node.children.length];
      Transforms.insertNodes(
        editor,
        (anchorHasContent
          ? [{ type: 'text', text: ' ' } as unknown as Node, ...carriedOver]
          : carriedOver) as never,
        { at }
      );
    }

    Transforms.setNodes(
      editor,
      {
        colSpan: spanProp(range.right - range.left + 1),
        rowSpan: spanProp(range.bottom - range.top + 1),
      } as Partial<Node>,
      { at: anchor.path }
    );

    absorbed
      .map((cell) => cell.path)
      .sort((a, b) => Path.compare(b, a))
      .forEach((path) => Transforms.removeNodes(editor, { at: path }));
  });

  selectStartOf(editor, [...tablePath, anchor.row, anchor.indexInRow]);
};

/**
 * Undoes a merge: the cell shrinks back to 1x1 and every slot it vacates is
 * refilled with an empty cell. The content stays in the original cell.
 */
const splitCell = (editor: Editor, location: TableLocation) => {
  const { grid, focused, table, tablePath } = location;
  if (focused.colSpan === 1 && focused.rowSpan === 1) return;

  // Vacated slots, grouped per row and left to right
  const vacated: { row: number; col: number }[] = [];
  for (let row = focused.row; row < focused.row + focused.rowSpan; row++) {
    for (let col = focused.col; col < focused.col + focused.colSpan; col++) {
      if (row === focused.row && col === focused.col) continue;
      vacated.push({ row, col });
    }
  }

  allowTableEdit(editor, () => {
    Transforms.setNodes(
      editor,
      { colSpan: undefined, rowSpan: undefined } as Partial<Node>,
      { at: focused.path }
    );

    const insertedPerRow = new Map<number, number>();

    vacated.forEach(({ row, col }) => {
      const offset = insertedPerRow.get(row) ?? 0;
      Transforms.insertNodes(
        editor,
        createTableCell(isHeaderRowAt(table, row)) as never,
        { at: [...tablePath, row, nodeIndexForColumn(grid, row, col) + offset] }
      );
      insertedPerRow.set(row, offset + 1);
    });
  });

  selectStartOf(editor, focused.path);
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
  const { tablePath, table, grid } = location;
  const firstRow = (table.children as CustomElement[])[0];
  if (!firstRow) return;

  const nextType = isHeaderRow(firstRow) ? 'table-cell' : 'table-header-cell';
  const paths = cellsOriginatingInRow(grid, 0).map((cell) => cell.path);

  allowTableEdit(editor, () => {
    paths.forEach((path) => {
      Transforms.setNodes(editor, { type: nextType } as Partial<Node>, {
        at: path,
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
  canMergeCells,
  canSplitCell,
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
  isHeaderRowAt,
  isTableElement,
  mergeCells,
  rangeCrossesHeaderBoundary,
  setCellAlign,
  splitCell,
  toggleHeaderRow,
};
