import * as React from 'react';

import { Box } from '@strapi/design-system';
import { useTheme } from 'styled-components';

const MIN_SCALE = 0.15;
const MAX_SCALE = 3;

interface View {
  x: number;
  y: number;
  scale: number;
}

const START: View = { x: 0, y: 0, scale: 1 };

/**
 * The view that shows the whole diagram, centred.
 *
 * A schema of any size is bigger than the panel, so opening at 1:1 in the
 * top-left corner shows a corner of one box and reads as broken. Never zooms
 * *in* past 1:1 - a two-box schema blown up to fill the screen looks like a
 * mistake too.
 */
export const fitView = (
  content: { width: number; height: number },
  viewport: { width: number; height: number },
  padding = 24
): View => {
  if (content.width <= 0 || content.height <= 0) return START;

  const scale = Math.min(
    1,
    (viewport.width - padding * 2) / content.width,
    (viewport.height - padding * 2) / content.height
  );

  return {
    scale,
    x: (viewport.width - content.width * scale) / 2,
    y: (viewport.height - content.height * scale) / 2,
  };
};

/**
 * Pan and zoom over a diagram the server drew.
 *
 * The whole of the interactivity, in one file and with no graph library. That
 * is the point: every plugin this replaces pulled in a React canvas library to
 * get dragging, and then broke when React, styled-components or Strapi moved
 * under it. Panning is a translate, zooming is a scale about the pointer, and
 * clicking a box is one delegated listener reading the `data-uid` the renderer
 * already puts on every box.
 */
export const Canvas = ({
  svg,
  onOpen,
  view,
  onViewChange,
  fitTo,
  refit,
}: {
  svg: string;
  onOpen: (uid: string) => void;
  view: View;
  onViewChange: (view: View) => void;
  /** Diagram extent. When it changes, the view is fitted to it. */
  fitTo: { width: number; height: number };
  /** Bump to refit on demand - what the "Reset view" button changes. */
  refit: number;
}) => {
  const surface = React.useRef<HTMLDivElement | null>(null);
  const dragging = React.useRef<{ x: number; y: number; startX: number; startY: number } | null>(
    null
  );

  /**
   * Repaint the drawing in the admin panel's own colours.
   *
   * The renderer writes its palette as CSS custom properties with light
   * defaults, so a downloaded file opens correctly on a white page. Here those
   * defaults are overridden from the live theme, which is what keeps the same
   * bytes readable in dark mode instead of a white sheet stapled into a dark
   * page.
   */
  const theme = useTheme() as unknown as { colors?: Record<string, string> };
  const palette = React.useMemo(() => {
    const c = theme?.colors ?? {};

    return {
      '--bp-surface': c.neutral0,
      '--bp-box': c.neutral0,
      '--bp-box-component': c.neutral100,
      '--bp-border': c.neutral200,
      '--bp-accent': c.primary600,
      '--bp-accent-component': c.success600,
      '--bp-accent-single': c.warning600,
      '--bp-title': c.neutral800,
      '--bp-field': c.neutral800,
      '--bp-type': c.neutral600,
      '--bp-edge': c.neutral500 ?? c.neutral600,
      '--bp-hover': c.primary100,
    } as React.CSSProperties;
  }, [theme]);

  const handleWheel = React.useCallback(
    (event: WheelEvent) => {
      if (!surface.current) return;
      // Without this the admin panel's own page scrolls while zooming.
      event.preventDefault();

      const rect = surface.current.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      const factor = Math.exp(-event.deltaY / 400);
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
      const ratio = scale / view.scale;

      // Keep whatever is under the cursor under the cursor.
      onViewChange({
        scale,
        x: pointerX - (pointerX - view.x) * ratio,
        y: pointerY - (pointerY - view.y) * ratio,
      });
    },
    [view, onViewChange]
  );

  React.useEffect(() => {
    const node = surface.current;
    if (!node) return;

    // Non-passive, because a passive listener may not preventDefault and the
    // page would scroll behind the diagram.
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  /**
   * Fit whenever the drawing changes size - first load, and every toggle that
   * adds or removes boxes. Deliberately not on every render: refitting while
   * someone is panning would fight them for control.
   */
  const fitKey = `${fitTo.width}x${fitTo.height}x${refit}`;
  React.useEffect(() => {
    const node = surface.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    onViewChange(fitView(fitTo, { width: rect.width, height: rect.height }));
    // Keyed on the size only: `fitTo` and `onViewChange` are fresh objects on
    // every render, and depending on them would refit continuously.
  }, [fitKey]); // eslint-disable-line

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    dragging.current = { x: view.x, y: view.y, startX: event.clientX, startY: event.clientY };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragging.current;
    if (!drag) return;

    onViewChange({
      scale: view.scale,
      x: drag.x + (event.clientX - drag.startX),
      y: drag.y + (event.clientY - drag.startY),
    });
  };

  const endDrag = (event: React.PointerEvent) => {
    const drag = dragging.current;
    dragging.current = null;
    if (!drag) return;

    // A drag that moved is a pan, not a click on whatever was underneath.
    const moved =
      Math.abs(event.clientX - drag.startX) > 3 || Math.abs(event.clientY - drag.startY) > 3;
    if (moved) return;

    const box = (event.target as Element).closest?.('[data-uid]');
    const uid = box?.getAttribute('data-uid');
    // A plugin's internal table has no page in the Content-Type Builder, so a
    // click on one goes nowhere rather than to the Builder's default page.
    if (uid && box?.getAttribute('data-navigable') === 'true') onOpen(uid);
  };

  return (
    <Box
      ref={surface}
      background="neutral100"
      hasRadius
      overflow="hidden"
      position="relative"
      style={{
        height: '100%',
        cursor: dragging.current ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={() => {
        dragging.current = null;
      }}
    >
      <div
        style={{
          ...palette,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transformOrigin: '0 0',
          width: 'max-content',
        }}
        // The SVG comes from this plugin's own renderer, which escapes every
        // value it writes - see `escapeXml` in server/src/services/svg.ts.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </Box>
  );
};

export const INITIAL_VIEW = START;
export type { View };
