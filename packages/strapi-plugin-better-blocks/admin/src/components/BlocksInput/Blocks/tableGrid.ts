import { Editor, Path, type Point } from 'slate';

import type { CustomElement, TableCellElement } from '../utils/types';

/**
 * Span-aware view of a table.
 *
 * Once cells can carry `colSpan` / `rowSpan`, a cell's index within its row
 * stops being its visual column: a row of three cells can cover four columns,
 * and a cell with `rowSpan: 2` occupies a slot in the row below without having
 * a node there. Every structural operation therefore works against this grid —
 * a slot-by-slot map of what covers what — rather than against raw child
 * indices.
 */

/** A cell as it sits in the grid. One per node, shared by every slot it covers. */
export interface GridCell {
  node: TableCellElement;
  /** Path of the node itself: [...tablePath, rowIndex, indexWithinRow]. */
  path: Path;
  /** Row this cell's node lives in. */
  row: number;
  /** Leftmost grid column this cell covers. */
  col: number;
  rowSpan: number;
  colSpan: number;
  /** Index of the node among its row's children. */
  indexInRow: number;
}

export interface TableGrid {
  tablePath: Path;
  rowCount: number;
  /** Total grid columns, spans included. */
  colCount: number;
  /** `matrix[row][col]` — the cell covering that slot, or undefined if ragged. */
  matrix: (GridCell | undefined)[][];
  /** Every cell once, in document order. */
  cells: GridCell[];
}

/** A rectangle of grid slots, inclusive on both ends. */
export interface GridRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

const spanOf = (value: unknown): number => {
  const n = typeof value === 'number' ? value : 1;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
};

/**
 * Lays a table's cells out into grid slots.
 *
 * Standard table layout: walk each row left to right, skipping slots already
 * claimed by a `rowSpan` from an earlier row, and stamp each cell across every
 * slot it covers.
 */
export const buildTableGrid = (
  table: CustomElement,
  tablePath: Path
): TableGrid => {
  const rows = (table.children ?? []) as CustomElement[];
  const matrix: (GridCell | undefined)[][] = rows.map(() => []);
  const cells: GridCell[] = [];

  rows.forEach((row, rowIndex) => {
    const rowCells = (row.children ?? []) as TableCellElement[];
    let col = 0;

    rowCells.forEach((node, indexInRow) => {
      // Step past slots already covered by a rowSpan from above
      while (matrix[rowIndex][col]) col++;

      const cell: GridCell = {
        node,
        path: [...tablePath, rowIndex, indexInRow],
        row: rowIndex,
        col,
        rowSpan: spanOf((node as { rowSpan?: unknown }).rowSpan),
        colSpan: spanOf((node as { colSpan?: unknown }).colSpan),
        indexInRow,
      };
      cells.push(cell);

      for (
        let r = rowIndex;
        r < rowIndex + cell.rowSpan && r < rows.length;
        r++
      ) {
        for (let c = col; c < col + cell.colSpan; c++) {
          matrix[r][c] = cell;
        }
      }

      col += cell.colSpan;
    });
  });

  const colCount = matrix.reduce((max, row) => Math.max(max, row.length), 0);

  return { tablePath, rowCount: rows.length, colCount, matrix, cells };
};

/** The cell whose node sits at `path`, or undefined. */
export const findCellByPath = (
  grid: TableGrid,
  path: Path
): GridCell | undefined =>
  grid.cells.find((cell) => Path.equals(cell.path, path));

/** Cells that originate in `row`, left to right. */
export const cellsOriginatingInRow = (
  grid: TableGrid,
  row: number
): GridCell[] => grid.cells.filter((cell) => cell.row === row);

/**
 * Where a new cell covering grid column `col` has to be inserted among row
 * `row`'s children — i.e. how many of that row's own cells start left of it.
 * Cells that merely reach into the row from above have no node here and so
 * don't count.
 */
export const nodeIndexForColumn = (
  grid: TableGrid,
  row: number,
  col: number
): number =>
  cellsOriginatingInRow(grid, row).filter((cell) => cell.col < col).length;

/** Whether `cell` covers the given slot. */
export const covers = (cell: GridCell, row: number, col: number): boolean =>
  cell.row <= row &&
  row < cell.row + cell.rowSpan &&
  cell.col <= col &&
  col < cell.col + cell.colSpan;

/**
 * Grows `range` until every cell it touches is fully inside it.
 *
 * Selecting two cells that a third one straddles can't produce a rectangle
 * without swallowing that third cell — so the range expands to include it,
 * which may in turn pull in others. Repeats to a fixed point, which always
 * terminates because the range only ever grows and is bounded by the table.
 */
export const expandRangeToRectangle = (
  grid: TableGrid,
  range: GridRange
): GridRange => {
  const result = { ...range };
  let changed = true;

  while (changed) {
    changed = false;

    for (const cell of grid.cells) {
      const overlaps =
        cell.row <= result.bottom &&
        cell.row + cell.rowSpan - 1 >= result.top &&
        cell.col <= result.right &&
        cell.col + cell.colSpan - 1 >= result.left;

      if (!overlaps) continue;

      if (cell.row < result.top) {
        result.top = cell.row;
        changed = true;
      }
      if (cell.col < result.left) {
        result.left = cell.col;
        changed = true;
      }
      if (cell.row + cell.rowSpan - 1 > result.bottom) {
        result.bottom = cell.row + cell.rowSpan - 1;
        changed = true;
      }
      if (cell.col + cell.colSpan - 1 > result.right) {
        result.right = cell.col + cell.colSpan - 1;
        changed = true;
      }
    }
  }

  return result;
};

/** Every cell with at least one slot inside `range`, without duplicates. */
export const cellsInRange = (grid: TableGrid, range: GridRange): GridCell[] => {
  const seen = new Set<GridCell>();

  for (let r = range.top; r <= range.bottom; r++) {
    for (let c = range.left; c <= range.right; c++) {
      const cell = grid.matrix[r]?.[c];
      if (cell) seen.add(cell);
    }
  }

  return [...seen];
};

const isCellNode = (node: unknown): node is TableCellElement =>
  Boolean(
    node &&
    typeof node === 'object' &&
    'type' in node &&
    ((node as CustomElement).type === 'table-cell' ||
      (node as CustomElement).type === 'table-header-cell')
  );

/** The grid cell containing a point, or undefined if it isn't in this table. */
const cellAtPoint = (
  editor: Editor,
  grid: TableGrid,
  point: Point
): GridCell | undefined => {
  const entry = Editor.above(editor, {
    at: point,
    match: (node) => !Editor.isEditor(node) && isCellNode(node),
  });

  return entry ? findCellByPath(grid, entry[1]) : undefined;
};

/**
 * The rectangle of cells the selection covers, or null when it stays within a
 * single cell.
 *
 * The selection model is Slate's own — dragging across cells already produces a
 * range spanning both, and Shift+arrow already extends it, so there's no
 * separate cell-selection state to keep in sync.
 *
 * Only the two *endpoints* define the rectangle, though. A document range is
 * linear, so everything between r2c1 and r3c2 includes the whole tail of row 2
 * — taking the bounding box of every touched cell would turn a 2x2 pick into a
 * full-width 2x5 one. Treating anchor and focus as opposite corners gives the
 * 2D behaviour authors expect from a table.
 */
export const getSelectedRange = (
  editor: Editor,
  grid: TableGrid
): GridRange | null => {
  if (!editor.selection) return null;

  const anchor = cellAtPoint(editor, grid, editor.selection.anchor);
  const focus = cellAtPoint(editor, grid, editor.selection.focus);

  if (!anchor || !focus || anchor === focus) return null;

  const corners = [anchor, focus];
  const range: GridRange = {
    top: Math.min(...corners.map((c) => c.row)),
    left: Math.min(...corners.map((c) => c.col)),
    bottom: Math.max(...corners.map((c) => c.row + c.rowSpan - 1)),
    right: Math.max(...corners.map((c) => c.col + c.colSpan - 1)),
  };

  return expandRangeToRectangle(grid, range);
};
