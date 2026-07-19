import * as React from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import { Flex, Portal } from '@strapi/design-system';
import type { MessageDescriptor } from 'react-intl';
import { Editor, Range } from 'slate';
import { ReactEditor } from 'slate-react';
import { styled } from 'styled-components';

import { useBlocksEditorContext } from './BlocksEditor';
import {
  LinkButton,
  RemoveFormattingButton,
  ToolbarButton,
} from './BlocksToolbar';
import InlineColorPicker from './InlineColorPicker';
import type { CustomElement } from './utils/types';

/**
 * Shape of one entry in the modifiers store. Spelled out here because
 * `ModifiersStore` is keyed off Slate's `Text` type, whose public typings don't
 * carry this plugin's custom marks.
 */
interface Modifier {
  icon: React.ComponentType;
  label: MessageDescriptor;
  checkIsActive: (editor: Editor) => boolean;
  handleToggle: (editor: Editor) => void;
}

/** Marks worth surfacing on a selection — the long tail (super/subscript,
 *  uppercase) stays in the main toolbar so this bar stays glanceable. */
const SELECTION_MODIFIERS = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'code',
] as const;

/** Blocks whose content isn't rich text, so inline formatting is meaningless. */
const UNFORMATTABLE_BLOCKS = [
  'code',
  'image',
  'button',
  'horizontal-line',
  'video',
  'audio',
  'embed',
  'social-embed',
  'diagram',
];

/** Gap between the selection rect and the bar. */
const OFFSET = 8;

const Bar = styled(Flex)`
  position: fixed;
  top: -10000px;
  left: -10000px;
  z-index: 10;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
  background: ${({ theme }) => theme.colors.neutral0};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: ${({ theme }) => theme.shadows.popupShadow};
  padding: ${({ theme }) => theme.spaces[1]};

  &[data-visible='true'] {
    opacity: 1;
    pointer-events: auto;
  }
`;

/**
 * Medium/Notion-style mini toolbar that appears over a text selection, so
 * formatting doesn't require a trip up to the main toolbar.
 *
 * It positions itself imperatively (writing to `style` in an effect rather than
 * storing a rect in state) because it has to re-measure on every editor render,
 * and a state write there would loop.
 */
const FloatingSelectionToolbar = () => {
  const { editor, disabled, modifiers } = useBlocksEditorContext(
    'FloatingSelectionToolbar'
  );
  const barRef = React.useRef<HTMLDivElement>(null);
  // Suppressed while the author is dragging out a selection, so the bar doesn't
  // chase the cursor mid-drag.
  const [isSelecting, setIsSelecting] = React.useState(false);

  React.useEffect(() => {
    const onDown = () => setIsSelecting(true);
    const onUp = () => setIsSelecting(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const shouldShow = React.useCallback(() => {
    const { selection } = editor;

    if (disabled || !selection || Range.isCollapsed(selection)) return false;
    if (!ReactEditor.isFocused(editor as ReactEditor)) return false;
    if (Editor.string(editor, selection) === '') return false;

    // Marks don't apply to code or void media blocks
    const anchorBlock = editor.children[selection.anchor.path[0]] as
      | CustomElement
      | undefined;
    if (anchorBlock && UNFORMATTABLE_BLOCKS.includes(anchorBlock.type)) {
      return false;
    }

    return true;
  }, [editor, disabled]);

  // Runs after every render — the editor re-renders on selection change, which
  // is exactly when the bar needs repositioning.
  React.useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    if (isSelecting || !shouldShow()) {
      bar.dataset.visible = 'false';
      return;
    }

    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) {
      bar.dataset.visible = 'false';
      return;
    }

    const rect = domSelection.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      bar.dataset.visible = 'false';
      return;
    }

    const { offsetWidth, offsetHeight } = bar;
    // Above the selection, unless there isn't room — then below it.
    const fitsAbove = rect.top - offsetHeight - OFFSET > 0;
    const top = fitsAbove
      ? rect.top - offsetHeight - OFFSET
      : rect.bottom + OFFSET;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - offsetWidth / 2, OFFSET),
      window.innerWidth - offsetWidth - OFFSET
    );

    bar.style.top = `${top}px`;
    bar.style.left = `${left}px`;
    bar.dataset.visible = 'true';
  });

  return (
    <Portal>
      <Toolbar.Root asChild>
        <Bar
          ref={barRef}
          gap={1}
          alignItems="center"
          data-visible="false"
          role="toolbar"
          aria-label="Text formatting"
          // Keep the selection alive when the bar is clicked
          onMouseDown={(event: React.MouseEvent) => event.preventDefault()}
        >
          <Toolbar.ToggleGroup type="multiple" asChild>
            <Flex gap={1} alignItems="center">
              {SELECTION_MODIFIERS.map((name) => {
                // ModifiersStore is keyed off Slate's Text type, which doesn't
                // carry our custom marks in its public typings.
                const modifier = (
                  modifiers as unknown as Record<string, Modifier>
                )[name];
                if (!modifier) return null;

                return (
                  <ToolbarButton
                    key={name}
                    name={name}
                    icon={
                      modifier.icon as React.ComponentType<
                        React.SVGProps<SVGSVGElement>
                      >
                    }
                    label={modifier.label}
                    isActive={modifier.checkIsActive(editor)}
                    disabled={disabled}
                    handleClick={() => modifier.handleToggle(editor)}
                  />
                );
              })}
              <LinkButton disabled={disabled} location="toolbar" />
              <InlineColorPicker />
              {/* ToolbarButton renders a Radix ToggleItem, which throws unless
                  it has a ToggleGroup ancestor — keep it inside this group. */}
              <RemoveFormattingButton disabled={disabled} />
            </Flex>
          </Toolbar.ToggleGroup>
        </Bar>
      </Toolbar.Root>
    </Portal>
  );
};

export { FloatingSelectionToolbar };
