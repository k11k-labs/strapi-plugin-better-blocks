export { renderChart, renderValidatedChart } from './render';
export type { RenderOptions, RenderResult } from './render';

export { validateChartSpec, isChartSpec } from './validate';
export type { ChartIssue, ChartValidationResult } from './validate';

export { migrateChartSpec } from './migrate';
export type { ChartMigrationResult } from './migrate';

export { CHART_SPEC_VERSION } from './types';
export type {
  AxisBounds,
  ChartData,
  ChartOptions,
  ChartSpec,
  ChartSpecVersion,
  ChartType,
  InlineData,
  MediaData,
  Series,
  ValueFormat,
} from './types';

export { seriesColor } from './theme';
