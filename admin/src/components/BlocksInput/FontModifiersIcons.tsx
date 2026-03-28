import * as React from 'react';
import { useTheme } from 'styled-components';

type FontModifierIconProps = {
  fill: string;
};

export const Uppercase = ({ fill }: FontModifierIconProps) => {
  const { colors } = useTheme();

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="2.7"
        y="17"
        fontFamily="Arial"
        fontSize="14"
        fill={colors[fill as keyof typeof colors]}
      >
        AA
      </text>
    </svg>
  );
};

export const Superscript = ({ fill }: FontModifierIconProps) => {
  const { colors } = useTheme();

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="5"
        y="17"
        fontFamily="Arial"
        fontSize="14"
        fill={colors[fill as keyof typeof colors]}
      >
        X
      </text>
      <text
        x="15"
        y="10"
        fontFamily="Arial"
        fontSize="8"
        fill={colors[fill as keyof typeof colors]}
      >
        1
      </text>
    </svg>
  );
};

export const UndoIcon = ({
  fill,
  ...props
}: React.SVGProps<SVGSVGElement> & { fill?: string }) => {
  const { colors } = useTheme();
  const strokeColor = fill
    ? colors[fill as keyof typeof colors] || fill
    : colors.neutral600;

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      fill="none"
    >
      <path
        d="M7 7h7a5 5 0 0 1 0 10H7"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 4 7 7l3 3"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const RedoIcon = ({
  fill,
  ...props
}: React.SVGProps<SVGSVGElement> & { fill?: string }) => {
  const { colors } = useTheme();
  const strokeColor = fill
    ? colors[fill as keyof typeof colors] || fill
    : colors.neutral600;

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      fill="none"
    >
      <path
        d="M17 7h-7a5 5 0 0 0 0 10h7"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 4l3 3-3 3"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const AlignLeftIcon = ({
  fill,
  ...props
}: React.SVGProps<SVGSVGElement> & { fill?: string }) => {
  const { colors } = useTheme();
  const c = fill
    ? colors[fill as keyof typeof colors] || fill
    : colors.neutral600;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...props} fill="none">
      <path
        d="M3 6h18M3 10h12M3 14h18M3 18h12"
        stroke={c}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const AlignCenterIcon = ({
  fill,
  ...props
}: React.SVGProps<SVGSVGElement> & { fill?: string }) => {
  const { colors } = useTheme();
  const c = fill
    ? colors[fill as keyof typeof colors] || fill
    : colors.neutral600;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...props} fill="none">
      <path
        d="M3 6h18M6 10h12M3 14h18M6 18h12"
        stroke={c}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const AlignRightIcon = ({
  fill,
  ...props
}: React.SVGProps<SVGSVGElement> & { fill?: string }) => {
  const { colors } = useTheme();
  const c = fill
    ? colors[fill as keyof typeof colors] || fill
    : colors.neutral600;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...props} fill="none">
      <path
        d="M3 6h18M9 10h12M3 14h18M9 18h12"
        stroke={c}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const AlignJustifyIcon = ({
  fill,
  ...props
}: React.SVGProps<SVGSVGElement> & { fill?: string }) => {
  const { colors } = useTheme();
  const c = fill
    ? colors[fill as keyof typeof colors] || fill
    : colors.neutral600;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...props} fill="none">
      <path
        d="M3 6h18M3 10h18M3 14h18M3 18h18"
        stroke={c}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const LineHeightIcon = ({
  fill,
  ...props
}: React.SVGProps<SVGSVGElement> & { fill?: string }) => {
  const { colors } = useTheme();
  const c = fill
    ? colors[fill as keyof typeof colors] || fill
    : colors.neutral600;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...props} fill="none">
      <path
        d="M11 6h10M11 12h10M11 18h10"
        stroke={c}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M5 4l-2 3h4L5 4zM5 20l-2-3h4l-2 3z" fill={c} />
      <path d="M5 7v10" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

export const SpecialCharIcon = ({
  fill,
  ...props
}: React.SVGProps<SVGSVGElement> & { fill?: string }) => {
  const { colors } = useTheme();
  const c = fill
    ? colors[fill as keyof typeof colors] || fill
    : colors.neutral600;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...props} fill="none">
      <text
        x="4"
        y="18"
        fontFamily="serif"
        fontSize="18"
        fontWeight="400"
        fill={c}
      >
        {'\u03A9'}
      </text>
    </svg>
  );
};

export const Subsscript = ({ fill }: FontModifierIconProps) => {
  const { colors } = useTheme();

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="5"
        y="17"
        fontFamily="Arial"
        fontSize="14"
        fill={colors[fill as keyof typeof colors]}
      >
        X
      </text>
      <text
        x="15"
        y="20"
        fontFamily="Arial"
        fontSize="8"
        fill={colors[fill as keyof typeof colors]}
      >
        1
      </text>
    </svg>
  );
};
