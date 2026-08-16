export { Chart } from './Chart';
export type { ChartProps } from './Chart';

export { chartBlockPlugin } from './blockPlugin';
export type { ChartBlockOptions } from './blockPlugin';

// Re-exported so a consumer building a spec does not need a second install.
export type { ChartSpec, ChartType, Series, ChartOptions } from '@qkix/chartkit-core';
