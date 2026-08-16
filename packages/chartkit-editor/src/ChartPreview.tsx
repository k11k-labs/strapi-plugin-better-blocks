/**
 * A rendered chart, or the reasons there is not one.
 *
 * Shared by the editor, the dialog and whatever draws a chart block in a
 * document, so the thing an author clicks to edit and the thing they see while
 * editing are the same component.
 */

import { Box, Typography } from '@strapi/design-system';
import { renderChart, type ChartSpec } from '@qkix/chartkit-core';
import * as React from 'react';

export type ChartPreviewProps = {
  spec: ChartSpec;
  locale?: string;
  idPrefix?: string;
  /** Called on click, when the preview is a way into the editor. */
  onClick?: () => void;
};

export function ChartPreview({ spec, locale, idPrefix, onClick }: ChartPreviewProps) {
  const result = renderChart(spec, { locale, idPrefix: idPrefix ?? 'chartkit-preview' });

  if (!result.ok) {
    return (
      <Box padding={4} background="danger100" hasRadius onClick={onClick}>
        <Typography variant="pi" fontWeight="bold" textColor="danger600">
          This chart will not render yet
        </Typography>
        <Box paddingTop={2}>
          {result.issues.map((issue) => (
            <Typography key={issue.path} variant="pi" textColor="danger600" tag="p">
              {issue.path}: {issue.message}
            </Typography>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      padding={3}
      hasRadius
      onClick={onClick}
      style={{
        // Both, always. The chart's text and axes are
        // `var(--chart-text, currentColor)` by design, so a background without a
        // matching color leaves them inheriting the admin's theme — which on the
        // dark one is white text on white paper.
        background: '#ffffff',
        color: '#32324a',
        border: '1px solid #dcdce4',
        cursor: onClick ? 'pointer' : undefined,
      }}
      // chartkit-core's own output, escaped on the way in by its string builder.
      dangerouslySetInnerHTML={{ __html: result.svg }}
    />
  );
}
