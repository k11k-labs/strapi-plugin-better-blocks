/**
 * A Chartkit chart, as a React component.
 *
 * The work happens in `@qkix/chartkit-core`, which turns a spec into a finished
 * SVG string. This is the thin part: hand that string to React.
 */

import { renderChart, type ChartSpec, type RenderOptions } from '@qkix/chartkit-core';
import type { ReactNode } from 'react';

export type ChartProps = {
  spec: ChartSpec;
  /**
   * Locale for number formatting. Worth passing explicitly on a server, where
   * the runtime default is whatever the container was built with.
   */
  locale?: string;
  /**
   * Prefix for the ids the chart's `aria-labelledby` points at. Required when a
   * page holds more than one chart, or their accessible names collide.
   */
  idPrefix?: string;
  className?: string;
  /**
   * Called when the spec will not render, instead of the chart. Without one,
   * an invalid spec renders nothing - the same as any other broken content, and
   * better than a half-drawn chart that looks like real data.
   */
  fallback?: (issues: { path: string; message: string }[]) => ReactNode;
};

export function Chart({ spec, locale, idPrefix, className, fallback }: ChartProps): ReactNode {
  const options: RenderOptions = { locale, idPrefix };
  const result = renderChart(spec, options);

  if (!result.ok) return fallback ? fallback(result.issues) : null;

  // The markup is this library's own output, built by a string builder that
  // escapes every author-controlled value on the way in - see chartkit-core's
  // svg.ts. Nothing from the spec reaches the page unescaped.
  return <div className={className} dangerouslySetInnerHTML={{ __html: result.svg }} />;
}
