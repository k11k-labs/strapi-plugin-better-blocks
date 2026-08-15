import React from 'react';
import { Popover, Flex, FlexComponent, Box } from '@strapi/design-system';
import { Editor, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { styled, useTheme } from 'styled-components';
import { useBlocksEditorContext } from './BlocksEditor';
import { COLORS_OPTIONS, BG_COLORS_OPTIONS } from './utils/optionsDefaults';
import { getOptionsWithFallback } from './utils/optionsParser';

type ColorMode = 'foreground' | 'background';

// Foreground color icon (A letter, matches FontModifiersIcons pattern)
const ForegroundIcon = ({ color }: { color?: string | null }) => {
  const { colors } = useTheme();
  const fill = color || colors.neutral600;
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="7"
        y="17"
        fontFamily="Arial"
        fontSize="14"
        fill={fill}
        stroke="rgba(128,128,128,0.3)"
        strokeWidth="0.5"
      >
        A
      </text>
    </svg>
  );
};

// Background color icon (highlight marker)
const BackgroundIcon = () => {
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
        x="7"
        y="17"
        fontFamily="Arial"
        fontSize="14"
        fill={colors.neutral600}
      >
        A
      </text>
      <rect
        x="3"
        y="19"
        width="18"
        height="3"
        rx="1"
        fill={colors.neutral600}
        opacity="0.4"
      />
    </svg>
  );
};

const ColorGrid = styled(Flex)`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  padding: 8px;
  max-width: 180px;
`;

const ColorSwatch = styled.button<{ $color: string; $isActive: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 2px solid
    ${({ $isActive, theme }) =>
      $isActive ? theme.colors.primary600 : 'transparent'};
  background-color: ${({ $color }) => $color};
  cursor: pointer;
  transition: transform 0.1s ease;

  &:hover {
    transform: scale(1.1);
    border-color: ${({ theme }) => theme.colors.primary500};
  }
`;

const ColorToolbarButton = styled<FlexComponent<'button'>>(Flex)`
  flex-shrink: 0;
  min-width: 32px;

  &[aria-disabled] {
    cursor: not-allowed;
  }

  &[aria-disabled='false'] {
    cursor: pointer;

    &:hover {
      background: ${({ theme }) => theme.colors.primary100};
    }
  }
`;

const RemoveColorButton = styled.button`
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: ${({ theme }) => theme.colors.neutral100};
  color: ${({ theme }) => theme.colors.neutral800};
  cursor: pointer;
  font-size: 12px;
  border-radius: 4px;
  margin-top: 4px;

  &:hover {
    background: ${({ theme }) => theme.colors.neutral200};
  }
`;

const ModeTab = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 6px 8px;
  border: none;
  border-bottom: 2px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary600 : 'transparent'};
  background: transparent;
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary600 : theme.colors.neutral600};
  cursor: pointer;
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;

  &:hover {
    color: ${({ theme }) => theme.colors.primary500};
  }
`;

const InlineColorPicker = () => {
  const {
    editor,
    disabled,
    pluginOptions = {},
  } = useBlocksEditorContext('InlineColorPicker');
  const [isOpen, setIsOpen] = React.useState(false);
  const [mode, setMode] = React.useState<ColorMode>('foreground');

  // Get color options from plugin configuration
  const fgOptions = getOptionsWithFallback(
    COLORS_OPTIONS,
    (pluginOptions as any)?.customColorsPresets,
    (pluginOptions as any)?.disableDefaultColors
  );

  const bgOptions = getOptionsWithFallback(
    BG_COLORS_OPTIONS,
    (pluginOptions as any)?.customBgColorsPresets,
    (pluginOptions as any)?.disableDefaultBgColors
  );

  const markName = mode === 'foreground' ? 'color' : 'backgroundColor';
  const colorOptions = mode === 'foreground' ? fgOptions : bgOptions;

  // Get current mark value from selection
  const getCurrentMark = (mark: string): string | null => {
    const marks = Editor.marks(editor);
    return (marks as any)?.[mark] || null;
  };

  const currentFgColor = getCurrentMark('color');
  const currentBgColor = getCurrentMark('backgroundColor');
  const currentColor = mode === 'foreground' ? currentFgColor : currentBgColor;

  // Apply mark to selected text
  const applyColor = (color: string) => {
    if (!editor.selection) {
      const endOfEditor = Editor.end(editor, []);
      Transforms.select(editor, endOfEditor);
    }

    Editor.addMark(editor, markName, color);
    setIsOpen(false);
    ReactEditor.focus(editor as ReactEditor);
  };

  // Remove mark from selected text
  const removeColor = () => {
    Editor.removeMark(editor, markName);
    setIsOpen(false);
    ReactEditor.focus(editor as ReactEditor);
  };

  // Check if color picker should be disabled
  const isDisabled = () => {
    if (disabled) return true;
    if (!editor.selection) return false;

    const selectedNode = editor.children[
      editor.selection.anchor.path[0]
    ] as any;
    if (!selectedNode) return true;
    if (
      ['image', 'code', 'separator', 'horizontal-line'].includes(
        selectedNode.type
      )
    ) {
      return true;
    }
    return false;
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger>
        <ColorToolbarButton
          tag="button"
          alignItems="center"
          justifyContent="center"
          width={7}
          height={7}
          hasRadius
          aria-label="Text color"
          aria-disabled={isDisabled()}
          disabled={isDisabled()}
          style={{
            ...(currentBgColor ? { backgroundColor: currentBgColor } : {}),
          }}
        >
          <ForegroundIcon color={currentFgColor} />
        </ColorToolbarButton>
      </Popover.Trigger>
      <Popover.Content>
        <Box padding={2}>
          <Flex gap={0} style={{ marginBottom: '4px' }}>
            <ModeTab
              $active={mode === 'foreground'}
              onClick={() => setMode('foreground')}
            >
              <ForegroundIcon /> Text
            </ModeTab>
            <ModeTab
              $active={mode === 'background'}
              onClick={() => setMode('background')}
            >
              <BackgroundIcon /> Highlight
            </ModeTab>
          </Flex>
          <ColorGrid>
            {colorOptions.map((option, index) => (
              <ColorSwatch
                key={`${mode}-color-${index}`}
                $color={option.value}
                $isActive={currentColor === option.value}
                onClick={() => applyColor(option.value)}
                title={option.label}
              />
            ))}
          </ColorGrid>
          {currentColor && (
            <RemoveColorButton onClick={removeColor}>
              {mode === 'foreground' ? 'Remove color' : 'Remove highlight'}
            </RemoveColorButton>
          )}
        </Box>
      </Popover.Content>
    </Popover.Root>
  );
};

export default InlineColorPicker;
