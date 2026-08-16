export { ChartEditor } from './ChartEditor';
export type { ChartEditorProps } from './ChartEditor';

export { DataGrid } from './DataGrid';
export type { DataGridProps } from './DataGrid';

export { PastePanel } from './PastePanel';
export type { PastePanelProps } from './PastePanel';

// The edit operations are exported because they are the whole data model of the
// editor: a host that wants its own controls can drive a spec with these rather
// than reimplementing array surgery that has to preserve nulls.
export {
  addRow,
  addSeries,
  normalizeShape,
  removeRow,
  removeSeries,
  replaceData,
  setCell,
  setLabel,
  setSeriesName,
  setType,
  typeChangeDiscardsSeries,
} from './edit';
export type { CellValue } from './edit';

export { parseDelimited, toNumber } from './csv';
export type { ParsedTable, ParseResult } from './csv';
