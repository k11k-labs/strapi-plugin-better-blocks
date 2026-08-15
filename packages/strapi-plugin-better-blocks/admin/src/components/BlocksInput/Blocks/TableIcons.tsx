import * as React from 'react';
import { useTheme } from 'styled-components';

/**
 * Icons for the table contextual toolbar.
 *
 * They all share one visual language: a 3x3 table frame with the row or column
 * the action targets picked out by a tinted band, plus a `+` or `x` marker for
 * insert vs delete. That makes "insert row above" readable at a glance instead
 * of relying on the tooltip.
 *
 * `fill` follows the same convention as FontModifiersIcons: a theme color token
 * (e.g. "neutral600"), falling back to a raw CSS color.
 */

interface TableIconProps {
  fill?: string;
}

const useIconColor = (fill?: string) => {
  const { colors } = useTheme();
  return fill ? colors[fill as keyof typeof colors] || fill : colors.neutral600;
};

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const Frame = ({ color }: { color: string }) => (
  <g stroke={color} strokeWidth="1.4" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="1.5" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </g>
);

const Band = ({
  color,
  x,
  y,
  width,
  height,
}: {
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) => (
  <rect
    x={x}
    y={y}
    width={width}
    height={height}
    fill={color}
    opacity="0.22"
    rx="1.5"
  />
);

const PlusMark = ({
  color,
  cx,
  cy,
}: {
  color: string;
  cx: number;
  cy: number;
}) => (
  <g stroke={color} strokeWidth="1.6" strokeLinecap="round">
    <line x1={cx - 2} y1={cy} x2={cx + 2} y2={cy} />
    <line x1={cx} y1={cy - 2} x2={cx} y2={cy + 2} />
  </g>
);

const CrossMark = ({
  color,
  cx,
  cy,
}: {
  color: string;
  cx: number;
  cy: number;
}) => (
  <g stroke={color} strokeWidth="1.6" strokeLinecap="round">
    <line x1={cx - 2} y1={cy - 2} x2={cx + 2} y2={cy + 2} />
    <line x1={cx + 2} y1={cy - 2} x2={cx - 2} y2={cy + 2} />
  </g>
);

export const InsertRowAboveIcon = ({ fill }: TableIconProps) => {
  const color = useIconColor(fill);
  return (
    <Svg>
      <Band color={color} x={3} y={3} width={18} height={6} />
      <Frame color={color} />
      <PlusMark color={color} cx={12} cy={6} />
    </Svg>
  );
};

export const InsertRowBelowIcon = ({ fill }: TableIconProps) => {
  const color = useIconColor(fill);
  return (
    <Svg>
      <Band color={color} x={3} y={15} width={18} height={6} />
      <Frame color={color} />
      <PlusMark color={color} cx={12} cy={18} />
    </Svg>
  );
};

export const InsertColumnLeftIcon = ({ fill }: TableIconProps) => {
  const color = useIconColor(fill);
  return (
    <Svg>
      <Band color={color} x={3} y={3} width={6} height={18} />
      <Frame color={color} />
      <PlusMark color={color} cx={6} cy={12} />
    </Svg>
  );
};

export const InsertColumnRightIcon = ({ fill }: TableIconProps) => {
  const color = useIconColor(fill);
  return (
    <Svg>
      <Band color={color} x={15} y={3} width={6} height={18} />
      <Frame color={color} />
      <PlusMark color={color} cx={18} cy={12} />
    </Svg>
  );
};

export const DeleteRowIcon = ({ fill }: TableIconProps) => {
  const color = useIconColor(fill);
  return (
    <Svg>
      <Band color={color} x={3} y={9} width={18} height={6} />
      <Frame color={color} />
      <CrossMark color={color} cx={12} cy={12} />
    </Svg>
  );
};

export const DeleteColumnIcon = ({ fill }: TableIconProps) => {
  const color = useIconColor(fill);
  return (
    <Svg>
      <Band color={color} x={9} y={3} width={6} height={18} />
      <Frame color={color} />
      <CrossMark color={color} cx={12} cy={12} />
    </Svg>
  );
};

/** Table frame with a solid top row — the "toggle header row" affordance. */
export const HeaderRowIcon = ({ fill }: TableIconProps) => {
  const color = useIconColor(fill);
  return (
    <Svg>
      <rect x="3" y="3" width="18" height="6" rx="1.5" fill={color} />
      <Frame color={color} />
    </Svg>
  );
};

/**
 * Merge: the top-left 2x2 block reads as one tinted cell, with arrows pointing
 * inward to say "these become one".
 */
export const MergeCellsIcon = ({ fill }: TableIconProps) => {
  const color = useIconColor(fill);
  return (
    <Svg>
      <Band color={color} x={3} y={3} width={12} height={12} />
      <g stroke={color} strokeWidth="1.4" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="1.5" />
        <line x1="15" y1="3" x2="15" y2="21" />
        <line x1="3" y1="15" x2="21" y2="15" />
        {/* Inward arrows across the dissolved divide */}
        <line x1="6" y1="9" x2="12" y2="9" />
        <polyline points="10,7 12,9 10,11" fill="none" />
      </g>
    </Svg>
  );
};

/** Split: one cell with a dashed divider appearing down the middle. */
export const SplitCellIcon = ({ fill }: TableIconProps) => {
  const color = useIconColor(fill);
  return (
    <Svg>
      <g stroke={color} strokeWidth="1.4" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="1.5" />
        <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="2.5 2.5" />
        {/* Outward arrows either side of the new divide */}
        <line x1="5" y1="12" x2="9" y2="12" />
        <polyline points="7,10 5,12 7,14" fill="none" />
        <line x1="15" y1="12" x2="19" y2="12" />
        <polyline points="17,10 19,12 17,14" fill="none" />
      </g>
    </Svg>
  );
};
