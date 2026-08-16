export { default as Chart } from './src/Chart.astro';
export { chartBlockPlugin } from './src/blockPlugin';

// Re-exported so a consumer building a spec does not need a second install.
export type { ChartSpec, ChartType, Series, ChartOptions } from '@qkix/chartkit-core';
