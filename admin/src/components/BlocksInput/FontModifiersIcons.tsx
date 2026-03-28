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
