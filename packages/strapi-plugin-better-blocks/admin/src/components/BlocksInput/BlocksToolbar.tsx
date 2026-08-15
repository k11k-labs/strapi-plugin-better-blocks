import * as React from 'react';
import { useElementOnScreen } from '@strapi/admin/strapi-admin';
import * as Toolbar from '@radix-ui/react-toolbar';
import {
  Button,
  Flex,
  Field,
  Popover,
  Tooltip,
  FlexComponent,
  Menu,
  IconButton,
} from '@strapi/design-system';
import {
  Link,
  Minus,
  PaintBrush,
  GridNine,
  Play,
  IndentIncrease,
  IndentDecrease,
  Plus,
  Quotes,
  Expand,
  Collapse,
} from '@strapi/icons';
import { MessageDescriptor, useIntl } from 'react-intl';
import {
  Editor,
  Transforms,
  Element as SlateElement,
  Node,
  Path,
  Text,
  type Ancestor,
} from 'slate';
import { HistoryEditor } from 'slate-history';
import { ReactEditor } from 'slate-react';
import { css, styled } from 'styled-components';

import { getTranslation } from '../../utils/getTranslation';

import {
  type BlocksStore,
  type SelectorBlockKey,
  isSelectorBlockKey,
  useBlocksEditorContext,
} from './BlocksEditor';
import { MenuScrollbarStyles } from './MenuScrollbar';
import { insertLink } from './utils/links';
import {
  type Block,
  type TextAlign,
  CustomElement,
  getEntries,
  getKeys,
  ListNode,
} from './utils/types';
import { insertHorizontalLine } from './Blocks/HorizontalLine';
import { insertInlineMath, MathIcon } from './Blocks/Math';
import { insertTable } from './Blocks/Table';
import { TableGridPicker } from './Blocks/TableGridPicker';
import { BLOCK_PREVIEW_TYPOGRAPHY } from './Blocks/Heading';
import { insertEmbedFromUrl, isEmbeddableUrl } from './Blocks/Embed';
import { getShortcutLabel } from './utils/shortcuts';
import {
  UndoIcon,
  RedoIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  AlignJustifyIcon,
} from './FontModifiersIcons';
import { EmojiPicker } from './EmojiPicker';
import { FindReplace } from './FindReplace';
import { LineHeightIcon } from './FontModifiersIcons';
import InlineColorPicker from './InlineColorPicker';
import { SpecialCharPicker } from './SpecialCharPicker';

/**
 * A single continuous flow of controls that wraps to fill each row, the way
 * CKEditor's toolbar does — buttons are never held back by their group.
 *
 * Grouping is carried by thin rules between clusters rather than by layout
 * boxes: keeping groups as `nowrap` flex containers made them jump to the next
 * line as whole units, leaving big holes at the end of rows.
 */
const ToolbarWrapper = styled<FlexComponent>(Flex)`
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spaces[1]};

  &[aria-disabled='true'] {
    cursor: not-allowed;
    background: ${({ theme }) => theme.colors.neutral150};
  }
`;

/**
 * Keeps the JSX grouped for readability without creating a layout box.
 * `display: contents` lifts the children up to be flex items of the toolbar
 * itself, so each button wraps independently.
 */
const ToolbarGroup = styled.div`
  display: contents;
`;

/** Thin rule marking the boundary between two clusters of controls. */
const ToolbarSeparator = styled.span`
  width: 1px;
  align-self: stretch;
  min-height: 2.4rem;
  flex-shrink: 0;
  margin: 0 ${({ theme }) => theme.spaces[1]};
  background: ${({ theme }) => theme.colors.neutral200};
`;

const FlexButton = styled<FlexComponent<'button'>>(Flex)`
  user-select: none;

  // Inherit the not-allowed cursor from ToolbarWrapper when disabled
  &[aria-disabled] {
    cursor: not-allowed;
  }

  &[aria-disabled='false'] {
    cursor: pointer;

    // Only apply hover styles if the button is enabled
    &:hover {
      background: ${({ theme }) => theme.colors.primary100};
    }
  }
`;

/**
 * Handles the modal component that may be returned by a block when converting it
 */
function useConversionModal() {
  const [modalElement, setModalComponent] =
    React.useState<React.JSX.Element | null>(null);

  const handleConversionResult = (
    renderModal: void | (() => React.JSX.Element) | undefined
  ) => {
    // Not all blocks return a modal
    if (renderModal) {
      // Use cloneElement to apply a key because to create a new instance of the component
      // Without the new key, the state is kept from previous times that option was picked
      setModalComponent(React.cloneElement(renderModal(), { key: Date.now() }));
    }
  };

  return { modalElement, handleConversionResult };
}

interface ToolbarButtonProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  name: string;
  label: MessageDescriptor;
  isActive: boolean;
  disabled: boolean;
  handleClick: () => void;
}

const ToolbarButton = ({
  icon: Icon,
  name,
  label,
  isActive,
  disabled,
  handleClick,
}: ToolbarButtonProps) => {
  const { editor } = useBlocksEditorContext('ToolbarButton');
  const { formatMessage } = useIntl();
  const labelMessage = formatMessage(label);

  const enabledColor = isActive ? 'primary600' : 'neutral600';

  return (
    <Tooltip label={labelMessage}>
      <Toolbar.ToggleItem
        value={name}
        data-state={isActive ? 'on' : 'off'}
        onMouseDown={(e) => {
          e.preventDefault();
          handleClick();
          ReactEditor.focus(editor as ReactEditor);
        }}
        aria-disabled={disabled}
        disabled={disabled}
        aria-label={labelMessage}
        asChild
      >
        <FlexButton
          tag="button"
          background={isActive ? 'primary100' : ''}
          alignItems="center"
          justifyContent="center"
          width={7}
          height={7}
          hasRadius
        >
          <Icon fill={disabled ? 'neutral300' : enabledColor} />
        </FlexButton>
      </Toolbar.ToggleItem>
    </Tooltip>
  );
};

/**
 * "Rich" blocks that are inserted (not conversions of the current block). They are
 * surfaced from the dedicated "+" Insert menu instead of the block-type dropdown.
 */
const INSERT_BLOCK_KEYS: SelectorBlockKey[] = [
  'image',
  'audio',
  'video',
  'embed',
  'button',
  'callout',
  'details',
  'diagram',
  'math',
  'social-embed',
];

/**
 * Everything hidden from the block-type dropdown. On top of the insert blocks,
 * lists and quote are excluded: they each have a dedicated toggle button in the
 * toolbar, so the type-conversion dropdown is left to the text hierarchy
 * (paragraph, headings, code).
 */
const DROPDOWN_EXCLUDED_KEYS: SelectorBlockKey[] = [
  ...INSERT_BLOCK_KEYS,
  'list-ordered',
  'list-unordered',
  'list-todo',
  'quote',
];

/**
 * The block key at the selection anchor, or null when there's no selection or
 * nothing matches. Read-only — it must be safe to call during render.
 */
const getAnchorBlockKey = (
  editor: Editor,
  blocks: BlocksStore
): string | null => {
  if (!editor.selection) return null;

  // A list item reports the type of its parent list, not of the item
  const listEntry = Editor.above(editor, {
    match: (node) =>
      !Editor.isEditor(node) && 'type' in node && node.type === 'list',
    at: editor.selection.anchor,
  });

  let node: Ancestor | undefined;

  if (listEntry) {
    [node] = listEntry;
  } else {
    try {
      [node] = Editor.parent(editor, editor.selection.anchor, {
        edge: 'start',
        depth: 2,
      });
    } catch {
      // Selection may point at a path that no longer exists mid-transform
      return null;
    }
  }

  if (!node || Editor.isEditor(node)) return null;

  return (
    getKeys(blocks).find((blockKey) =>
      blocks[blockKey].matchNode(node as never)
    ) ?? null
  );
};

const BlocksDropdown = () => {
  const { editor, blocks, disabled } = useBlocksEditorContext('BlocksDropdown');
  const { formatMessage } = useIntl();
  const { modalElement, handleConversionResult } = useConversionModal();

  const blockKeysToInclude: SelectorBlockKey[] = getEntries(blocks).reduce<
    ReturnType<typeof getEntries>
  >((currentKeys, entry) => {
    const [key, block] = entry;

    return block.isInBlocksSelector &&
      !DROPDOWN_EXCLUDED_KEYS.includes(key as SelectorBlockKey)
      ? [...currentKeys, key]
      : currentKeys;
  }, []);

  /**
   * The label is derived on every render rather than mirrored into state.
   *
   * Slate mutates `editor.children` in place, so an effect keyed on the
   * document never re-runs — which left the label stale after any conversion
   * that doesn't move the caret (the Cmd/Ctrl+Alt shortcuts, notably). The
   * component already re-renders on every editor change via `useSlate`, so
   * reading the document here is both correct and cheap.
   */
  const anchorBlockKey = getAnchorBlockKey(editor, blocks);
  // Remembers the last dropdown-listed block, so the trigger keeps showing
  // something sensible when the caret sits in a list, table or quote.
  const lastListedKey = React.useRef<SelectorBlockKey>('paragraph');
  if (
    anchorBlockKey &&
    isSelectorBlockKey(anchorBlockKey) &&
    !DROPDOWN_EXCLUDED_KEYS.includes(anchorBlockKey)
  ) {
    lastListedKey.current = anchorBlockKey;
  }
  const blockSelected = lastListedKey.current;

  const handleSelect = (optionKey: unknown) => {
    if (!isSelectorBlockKey(optionKey)) {
      return;
    }

    const editorIsEmpty =
      editor.children.length === 1 &&
      Editor.isEmpty(editor, editor.children[0] as never);

    if (!editor.selection && !editorIsEmpty) {
      // When there is no selection, create an empty block at the end of the editor
      // so that it can be converted to the selected block
      Transforms.insertNodes(
        editor,
        {
          type: 'quote',
          children: [{ type: 'text', text: '' }],
        } as Block<'quote'>,
        {
          select: true,
          // Since there's no selection, Slate will automatically insert the node at the end
        }
      );
    } else if (!editor.selection && editorIsEmpty) {
      // When there is no selection and the editor is empty,
      // select the empty paragraph from Slate's initialValue so it gets converted
      Transforms.select(editor, Editor.start(editor, [0, 0]));
    }

    // If selection is already a list block, toggle its format
    const currentListEntry = Editor.above(editor, {
      match: (node) =>
        !Editor.isEditor(node) && 'type' in node && node.type === 'list',
    });

    if (
      currentListEntry &&
      ['list-ordered', 'list-unordered', 'list-todo'].includes(optionKey)
    ) {
      const [currentList, currentListPath] = currentListEntry;
      const format =
        optionKey === 'list-ordered'
          ? 'ordered'
          : optionKey === 'list-todo'
            ? 'todo'
            : 'unordered';

      if (!Editor.isEditor(currentList) && isListNode(currentList)) {
        // Format is different, toggle list format
        if ((currentList as ListNode).format !== format) {
          Transforms.setNodes(editor, { format } as Block<'list'>, {
            at: currentListPath,
          });
        }
      }
      return;
    }

    // Let the block handle the Slate conversion logic
    const maybeRenderModal = blocks[optionKey].handleConvert?.(editor);
    handleConversionResult(maybeRenderModal);

    // No need to mirror the choice into state — the next render reads it back
    // off the document.
    ReactEditor.focus(editor as ReactEditor);
  };

  /**
   * Prevent the select from focusing itself so ReactEditor.focus(editor) can focus the editor instead.
   *
   * The editor first loses focus to a blur event when clicking the select button. However,
   * refocusing the editor is not enough since the select's default behavior is to refocus itself
   * after an option is selected.
   *
   */
  const preventSelectFocus = (e: Event) => e.preventDefault();

  /**
   * Repairs the stray empty list-item that Slate's delete behaviour leaves
   * behind instead of converting it to a paragraph.
   * Issue: https://github.com/ianstormtaylor/slate/issues/2500
   *
   * This mutates the document, so it stays in an effect rather than moving to
   * the render-time derivation above.
   */
  React.useEffect(() => {
    if (!editor.selection) return;

    const inList = Editor.above(editor, {
      match: (node) =>
        !Editor.isEditor(node) && 'type' in node && node.type === 'list',
      at: editor.selection.anchor,
    });
    if (inList) return;

    try {
      const [anchorNode] = Editor.parent(editor, editor.selection.anchor, {
        edge: 'start',
        depth: 2,
      });

      if ((anchorNode as CustomElement).type === 'list-item') {
        Transforms.setNodes(editor, {
          type: 'paragraph',
        } as Block<'paragraph'>);
      }
    } catch {
      // Selection may point at a path that no longer exists
    }
  }, [editor.selection, editor]);

  const Icon = blocks[blockSelected].icon;

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          disabled={disabled}
          startIcon={<Icon />}
          aria-label={formatMessage({
            id: 'components.Blocks.blocks.selectBlock',
            defaultMessage: 'Select a block',
          })}
        >
          {formatMessage(blocks[blockSelected].label)}
        </Menu.Trigger>
        <Menu.Content onCloseAutoFocus={preventSelectFocus}>
          {blockKeysToInclude.map((key) => {
            const OptionIcon = blocks[key].icon;
            const preview = BLOCK_PREVIEW_TYPOGRAPHY[key];
            const shortcut = getShortcutLabel(key);

            return (
              <StyledMenuItem
                key={key}
                onSelect={() => handleSelect(key)}
                $isActive={key === blockSelected}
              >
                <OptionIcon />
                {/* Rendering the option at (a scaled version of) its own type
                    style saves authors from converting-then-undoing to find out
                    what a level looks like. */}
                <BlockPreviewLabel
                  style={
                    preview
                      ? {
                          fontSize: preview.fontSize,
                          fontWeight: preview.fontWeight,
                        }
                      : undefined
                  }
                >
                  {formatMessage(blocks[key].label)}
                </BlockPreviewLabel>
                {shortcut && <ShortcutHint>{shortcut}</ShortcutHint>}
              </StyledMenuItem>
            );
          })}
        </Menu.Content>
      </Menu.Root>
      {modalElement}
    </>
  );
};

const isListNode = (node: unknown): node is Block<'list'> => {
  return (
    Node.isNode(node) &&
    !Editor.isEditor(node) &&
    'type' in node &&
    node.type === 'list'
  );
};

interface ListButtonProps {
  block:
    | BlocksStore['list-ordered']
    | BlocksStore['list-unordered']
    | BlocksStore['list-todo'];
  format: Block<'list'>['format'];
  location?: 'toolbar' | 'menu';
}

const ListButton = ({
  block,
  format,
  location = 'toolbar',
}: ListButtonProps) => {
  const { formatMessage } = useIntl();
  const { editor, disabled, blocks } = useBlocksEditorContext('ListButton');

  const isListActive = () => {
    if (!editor.selection) return false;

    // Get the parent list at selection anchor node
    const currentListEntry = Editor.above(editor, {
      match: (node) =>
        !Editor.isEditor(node) && 'type' in node && node.type === 'list',
      at: editor.selection.anchor,
    });

    if (currentListEntry) {
      const [currentList] = currentListEntry;
      if (
        !Editor.isEditor(currentList) &&
        isListNode(currentList) &&
        (currentList as ListNode).format === format
      )
        return true;
    }
    return false;
  };

  /**
   * @TODO: Currently, applying list while multiple blocks are selected is not supported.
   * We should implement this feature in the future.
   */
  const isListDisabled = () => {
    // Always disabled when the whole editor is disabled
    if (disabled) {
      return true;
    }

    // Always enabled when there's no selection
    if (!editor.selection) {
      return false;
    }

    // Get the block node closest to the anchor and focus
    const anchorNodeEntry = Editor.above(editor, {
      at: editor.selection.anchor,
      match: (node) =>
        !Editor.isEditor(node) && 'type' in node && node.type !== 'text',
    });
    const focusNodeEntry = Editor.above(editor, {
      at: editor.selection.focus,
      match: (node) =>
        !Editor.isEditor(node) && 'type' in node && node.type !== 'text',
    });

    if (!anchorNodeEntry || !focusNodeEntry) {
      return false;
    }

    // Disabled if the anchor and focus are not in the same block
    return anchorNodeEntry[0] !== focusNodeEntry[0];
  };

  const toggleList = (format: Block<'list'>['format']) => {
    let currentListEntry;
    if (editor.selection) {
      currentListEntry = Editor.above(editor, {
        match: (node) =>
          !Editor.isEditor(node) && 'type' in node && node.type === 'list',
      });
    } else {
      // If no selection, toggle last inserted node
      const [_, lastNodePath] = Editor.last(editor, []);
      currentListEntry = Editor.above(editor, {
        match: (node) =>
          !Editor.isEditor(node) && 'type' in node && node.type === 'list',
        at: lastNodePath,
      });
    }

    if (!currentListEntry) {
      // If selection is not a list then convert it to list
      (blocks[`list-${format}`] as { handleConvert: (editor: Editor) => void })
        .handleConvert!(editor);
      return;
    }

    // If selection is already a list then toggle format
    const [currentList, currentListPath] = currentListEntry;

    if (!Editor.isEditor(currentList) && isListNode(currentList)) {
      if ((currentList as ListNode).format !== format) {
        // Format is different, toggle list format
        Transforms.setNodes(editor, { format } as Block<'list'>, {
          at: currentListPath,
        });
      } else {
        // Check if we're in a nested list
        const parentListEntry = Editor.above(editor, {
          at: currentListPath,
          match: (node) =>
            !Editor.isEditor(node) && 'type' in node && node.type === 'list',
        });

        if (parentListEntry) {
          // Same format in nested list: un-nest one level
          const currentListItemEntry = Editor.above(editor, {
            match: (node) =>
              !Editor.isEditor(node) &&
              'type' in node &&
              node.type === 'list-item',
          });

          if (currentListItemEntry) {
            const [, currentListItemPath] = currentListItemEntry;
            const targetPath = Path.next(currentListPath);

            Transforms.moveNodes(editor, {
              at: currentListItemPath,
              to: targetPath,
            });

            // Remove nested list if empty
            try {
              const remainingList = Editor.node(editor, currentListPath);
              if (remainingList) {
                const [remainingNode] = remainingList;
                if (
                  !Editor.isEditor(remainingNode) &&
                  'children' in remainingNode &&
                  (remainingNode as ListNode).children.length === 0
                ) {
                  Transforms.removeNodes(editor, { at: currentListPath });
                }
              }
            } catch {
              // Node may have been removed already
            }
          }
        } else {
          // Format is same at top level, convert selected list-item to paragraph
          blocks['paragraph'].handleConvert!(editor);
        }
      }
    }
  };

  if (location === 'menu') {
    const Icon = block.icon;

    return (
      <StyledMenuItem
        onSelect={() => toggleList(format)}
        $isActive={isListActive()}
        disabled={isListDisabled()}
      >
        <Icon />
        {formatMessage(block.label)}
      </StyledMenuItem>
    );
  }

  return (
    <ToolbarButton
      icon={block.icon}
      name={format}
      label={block.label}
      isActive={isListActive()}
      disabled={isListDisabled()}
      handleClick={() => toggleList(format)}
    />
  );
};

const LinkButton = ({
  disabled,
  location = 'toolbar',
}: {
  disabled: boolean;
  location?: 'toolbar' | 'menu';
}) => {
  const { editor } = useBlocksEditorContext('LinkButton');
  const { formatMessage } = useIntl();

  const isLinkActive = () => {
    const { selection } = editor;

    if (!selection) return false;

    const [match] = Array.from(
      Editor.nodes(editor, {
        at: Editor.unhangRange(editor, selection),
        match: (node) =>
          SlateElement.isElement(node) &&
          'type' in node &&
          node.type === 'link',
      })
    );

    return Boolean(match);
  };

  const isLinkDisabled = () => {
    // Always disabled when the whole editor is disabled
    if (disabled) {
      return true;
    }

    // Always enabled when there's no selection
    if (!editor.selection) {
      return false;
    }

    // Get the block node closest to the anchor and focus
    const anchorNodeEntry = Editor.above(editor, {
      at: editor.selection.anchor,
      match: (node) =>
        !Editor.isEditor(node) && 'type' in node && node.type !== 'text',
    });
    const focusNodeEntry = Editor.above(editor, {
      at: editor.selection.focus,
      match: (node) =>
        !Editor.isEditor(node) && 'type' in node && node.type !== 'text',
    });

    if (!anchorNodeEntry || !focusNodeEntry) {
      return false;
    }

    // Disabled if the anchor and focus are not in the same block
    return anchorNodeEntry[0] !== focusNodeEntry[0];
  };

  const addLink = () => {
    (editor as any).shouldSaveLinkPath = true;
    // We insert an empty anchor, so we split the DOM to have a element we can use as reference for the popover
    insertLink(editor, { url: '' });
  };

  const label = {
    id: 'components.Blocks.link',
    defaultMessage: 'Link',
  } as MessageDescriptor;

  if (location === 'menu') {
    return (
      <StyledMenuItem
        onSelect={addLink}
        $isActive={isLinkActive()}
        disabled={isLinkDisabled()}
      >
        <Link />
        {formatMessage(label)}
      </StyledMenuItem>
    );
  }

  return (
    <ToolbarButton
      icon={Link}
      name="link"
      label={label}
      isActive={isLinkActive()}
      handleClick={addLink}
      disabled={isLinkDisabled()}
    />
  );
};

const StyledMenuItem = styled(Menu.Item)<{ $isActive: boolean }>`
  &:hover {
    background-color: ${({ theme }) => theme.colors.primary100};
  }

  ${(props) =>
    props.$isActive &&
    css`
      font-weight: bold;
      background-color: ${({ theme }) => theme.colors.primary100};
      color: ${({ theme }) => theme.colors.primary600};
      font-weight: bold;
    `}

  > span {
    display: inline-flex;
    gap: ${({ theme }) => theme.spaces[2]};
    align-items: center;
    width: 100%;
  }

  svg {
    fill: ${({ theme, $isActive }) =>
      $isActive ? theme.colors.primary600 : theme.colors.neutral600};
    flex-shrink: 0;
  }
`;

const BlockPreviewLabel = styled.span`
  line-height: 1.3;
`;

/** Keyboard hint pinned to the right edge of a menu item. */
const ShortcutHint = styled.span`
  margin-left: auto;
  padding-left: ${({ theme }) => theme.spaces[6]};
  color: ${({ theme }) => theme.colors.neutral500};
  font-size: 1.2rem;
  white-space: nowrap;
`;

const UndoButton = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('UndoButton');
  const { formatMessage } = useIntl();

  return (
    <ToolbarButton
      icon={UndoIcon}
      name="undo"
      label={{
        id: 'components.Blocks.undo',
        defaultMessage: 'Undo',
      }}
      isActive={false}
      disabled={
        disabled ||
        (editor as unknown as HistoryEditor).history.undos.length === 0
      }
      handleClick={() => HistoryEditor.undo(editor as unknown as HistoryEditor)}
    />
  );
};

const RedoButton = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('RedoButton');
  const { formatMessage } = useIntl();

  return (
    <ToolbarButton
      icon={RedoIcon}
      name="redo"
      label={{
        id: 'components.Blocks.redo',
        defaultMessage: 'Redo',
      }}
      isActive={false}
      disabled={
        disabled ||
        (editor as unknown as HistoryEditor).history.redos.length === 0
      }
      handleClick={() => HistoryEditor.redo(editor as unknown as HistoryEditor)}
    />
  );
};

const RemoveFormattingButton = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('RemoveFormattingButton');

  const handleRemoveFormatting = () => {
    if (!editor.selection) return;

    const marks = Editor.marks(editor);
    if (marks) {
      Object.keys(marks).forEach((mark) => {
        if (mark !== 'type' && mark !== 'text') {
          Editor.removeMark(editor, mark);
        }
      });
    }
    ReactEditor.focus(editor as ReactEditor);
  };

  return (
    <ToolbarButton
      icon={PaintBrush}
      name="removeFormatting"
      label={{
        id: 'components.Blocks.removeFormatting',
        defaultMessage: 'Remove formatting',
      }}
      isActive={false}
      disabled={disabled}
      handleClick={handleRemoveFormatting}
    />
  );
};

const ALIGN_OPTIONS: {
  value: TextAlign;
  icon: React.ComponentType<any>;
  label: string;
}[] = [
  { value: 'left', icon: AlignLeftIcon, label: 'Align left' },
  { value: 'center', icon: AlignCenterIcon, label: 'Align center' },
  { value: 'right', icon: AlignRightIcon, label: 'Align right' },
  { value: 'justify', icon: AlignJustifyIcon, label: 'Justify' },
];

const TextAlignButton = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('TextAlignButton');
  const { formatMessage } = useIntl();

  const getCurrentAlign = (): TextAlign => {
    if (!editor.selection) return 'left';
    const [node] = Editor.parent(editor, editor.selection.anchor, {
      edge: 'start',
      depth: 2,
    });
    return ((node as CustomElement).textAlign as TextAlign) || 'left';
  };

  const currentAlign = getCurrentAlign();
  const CurrentIcon =
    ALIGN_OPTIONS.find((o) => o.value === currentAlign)?.icon || AlignLeftIcon;

  const setAlignment = (align: TextAlign) => {
    if (!editor.selection) return;

    const entry = Editor.above(editor, {
      match: (n) =>
        !Editor.isEditor(n) &&
        'type' in n &&
        !['text', 'link', 'list-item'].includes((n as CustomElement).type),
    });

    if (entry) {
      const [, path] = entry;
      Transforms.setNodes(
        editor,
        {
          textAlign: align === 'left' ? undefined : align,
        } as Partial<CustomElement>,
        { at: path }
      );
    }
    ReactEditor.focus(editor as ReactEditor);
  };

  return (
    <Menu.Root>
      <Menu.Trigger disabled={disabled}>
        <Tooltip
          label={formatMessage({
            id: 'components.Blocks.textAlign',
            defaultMessage: 'Text alignment',
          })}
        >
          <FlexButton
            tag="button"
            alignItems="center"
            justifyContent="center"
            width={7}
            height={7}
            hasRadius
            aria-disabled={disabled}
          >
            <CurrentIcon fill={disabled ? 'neutral300' : 'neutral600'} />
          </FlexButton>
        </Tooltip>
      </Menu.Trigger>
      <Menu.Content>
        {ALIGN_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = currentAlign === opt.value;
          return (
            <StyledMenuItem
              key={opt.value}
              onSelect={() => setAlignment(opt.value)}
              $isActive={isActive}
            >
              <Icon fill={isActive ? 'primary600' : 'neutral600'} />
              {opt.label}
            </StyledMenuItem>
          );
        })}
      </Menu.Content>
    </Menu.Root>
  );
};

const InsertBlockButton = ({ disabled }: { disabled: boolean }) => {
  const { editor, blocks } = useBlocksEditorContext('InsertBlockButton');
  const { formatMessage } = useIntl();
  const { modalElement, handleConversionResult } = useConversionModal();

  const handleInsert = (key: SelectorBlockKey) => {
    const maybeRenderModal = blocks[key].handleConvert?.(editor);
    handleConversionResult(maybeRenderModal);
    ReactEditor.focus(editor as ReactEditor);
  };

  return (
    <>
      <Menu.Root>
        <Menu.Trigger disabled={disabled}>
          <Tooltip
            label={formatMessage({
              id: 'components.Blocks.insertBlock',
              defaultMessage: 'Insert',
            })}
          >
            <FlexButton
              tag="button"
              alignItems="center"
              justifyContent="center"
              width={7}
              height={7}
              hasRadius
              aria-disabled={disabled}
            >
              <Plus fill={disabled ? 'neutral300' : 'neutral600'} />
            </FlexButton>
          </Tooltip>
        </Menu.Trigger>
        <Menu.Content>
          {INSERT_BLOCK_KEYS.map((key) => {
            const Icon = blocks[key].icon;
            return (
              <StyledMenuItem
                key={key}
                onSelect={() => handleInsert(key)}
                $isActive={false}
              >
                <Icon />
                {formatMessage(blocks[key].label)}
              </StyledMenuItem>
            );
          })}
        </Menu.Content>
      </Menu.Root>
      {modalElement}
    </>
  );
};

/**
 * Opens a size picker instead of dropping a fixed 3x3 grid, so authors get the
 * table they actually want without then adding or deleting rows.
 */
const InsertTableButton = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('InsertTableButton');
  const { formatMessage } = useIntl();
  const [isOpen, setIsOpen] = React.useState(false);

  const label = formatMessage({
    id: 'components.Blocks.insertTable',
    defaultMessage: 'Insert table',
  });

  const handleSelect = (rows: number, cols: number) => {
    insertTable(editor, rows, cols);
    setIsOpen(false);
    ReactEditor.focus(editor as ReactEditor);
  };

  return (
    // Uncontrolled `onOpenChange` would fight the mousedown toggle below and
    // close the popover again on the same click, so open state is manual.
    <Popover.Root open={isOpen}>
      <Popover.Trigger>
        <FlexButton
          tag="button"
          alignItems="center"
          justifyContent="center"
          width={7}
          height={7}
          hasRadius
          aria-disabled={disabled}
          aria-label={label}
          title={label}
          onMouseDown={(e: React.MouseEvent) => {
            e.preventDefault();
            if (!disabled) setIsOpen((open) => !open);
          }}
        >
          <GridNine fill={disabled ? 'neutral300' : 'neutral600'} />
        </FlexButton>
      </Popover.Trigger>
      <Popover.Content onPointerDownOutside={() => setIsOpen(false)}>
        <TableGridPicker onSelect={handleSelect} />
      </Popover.Content>
    </Popover.Root>
  );
};

/**
 * Blockquote as a first-class toggle next to the lists, rather than an entry
 * buried in the block-type dropdown.
 */
const QuoteButton = ({ disabled }: { disabled: boolean }) => {
  const { editor, blocks } = useBlocksEditorContext('QuoteButton');

  const isQuoteActive = () => {
    if (!editor.selection) return false;

    const [match] = Editor.nodes(editor, {
      at: editor.selection.anchor,
      match: (node) =>
        !Editor.isEditor(node) && 'type' in node && node.type === 'quote',
    });

    return Boolean(match);
  };

  const toggleQuote = () => {
    if (isQuoteActive()) {
      blocks.paragraph.handleConvert?.(editor);
      return;
    }
    blocks.quote.handleConvert?.(editor);
  };

  return (
    <ToolbarButton
      icon={Quotes}
      name="quote"
      label={blocks.quote.label}
      isActive={isQuoteActive()}
      disabled={disabled}
      handleClick={toggleQuote}
    />
  );
};

/**
 * Fullscreen toggle. Lives at the toolbar's right edge — the conventional spot
 * for a maximize control, and always in view unlike the old bottom-corner
 * placement.
 */
const ExpandButton = () => {
  const { isExpandedMode, onToggleExpand } =
    useBlocksEditorContext('ExpandButton');
  const { formatMessage } = useIntl();

  const label = formatMessage(
    isExpandedMode
      ? {
          id: getTranslation('components.Blocks.collapse'),
          defaultMessage: 'Collapse',
        }
      : {
          id: getTranslation('components.Blocks.expand'),
          defaultMessage: 'Expand',
        }
  );

  return (
    <Tooltip label={label}>
      <FlexButton
        tag="button"
        type="button"
        alignItems="center"
        justifyContent="center"
        width={7}
        height={7}
        hasRadius
        aria-disabled={false}
        aria-label={label}
        onClick={onToggleExpand}
      >
        {isExpandedMode ? (
          <Collapse fill="neutral600" />
        ) : (
          <Expand fill="neutral600" />
        )}
      </FlexButton>
    </Tooltip>
  );
};

const InsertMediaButton = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('InsertMediaButton');
  const { formatMessage } = useIntl();
  const [showInput, setShowInput] = React.useState(false);
  const [mediaUrl, setMediaUrl] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleInsert = () => {
    // Inserts the `embed` block: `media-embed` is deprecated and kept only so
    // documents authored before this block still render.
    if (mediaUrl && insertEmbedFromUrl(editor, mediaUrl)) {
      setMediaUrl('');
      setShowInput(false);
      ReactEditor.focus(editor as ReactEditor);
    }
  };

  React.useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  const label = formatMessage({
    id: 'components.Blocks.insertMedia',
    defaultMessage: 'Insert media',
  });

  return (
    <Popover.Root open={showInput}>
      <Popover.Trigger>
        <FlexButton
          tag="button"
          alignItems="center"
          justifyContent="center"
          width={7}
          height={7}
          hasRadius
          aria-disabled={disabled}
          aria-label={label}
          title={label}
          onMouseDown={(e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) setShowInput((v) => !v);
          }}
        >
          <Play fill={disabled ? 'neutral300' : 'neutral600'} />
        </FlexButton>
      </Popover.Trigger>
      <Popover.Content onPointerDownOutside={() => setShowInput(false)}>
        <Flex padding={3} direction="column" gap={3}>
          <Field.Root width="300px">
            <Flex direction="column" gap={1} alignItems="stretch">
              <Field.Label>
                {formatMessage({
                  id: 'components.Blocks.mediaUrl',
                  defaultMessage: 'Video URL',
                })}
              </Field.Label>
              <Field.Input
                ref={inputRef}
                name="mediaUrl"
                placeholder="https://youtube.com/watch?v=..."
                value={mediaUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setMediaUrl(e.target.value)
                }
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleInsert();
                  }
                }}
              />
            </Flex>
          </Field.Root>
          <Flex justifyContent="flex-end" gap={2}>
            <Button variant="tertiary" onClick={() => setShowInput(false)}>
              {formatMessage({ id: 'global.cancel', defaultMessage: 'Cancel' })}
            </Button>
            <Button
              disabled={!mediaUrl || !isEmbeddableUrl(mediaUrl)}
              onClick={handleInsert}
            >
              {formatMessage({
                id: 'components.Blocks.insert',
                defaultMessage: 'Insert',
              })}
            </Button>
          </Flex>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
};

const FONT_FAMILIES = [
  'Default',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
  'Tahoma',
  'Palatino',
  'Garamond',
];

const FONT_SIZES = [
  'Default',
  '10px',
  '12px',
  '14px',
  '16px',
  '18px',
  '20px',
  '24px',
  '28px',
  '32px',
  '36px',
  '48px',
];

const FontFamilySelect = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('FontFamilySelect');

  const currentFont = (() => {
    const marks = Editor.marks(editor) as any;
    return marks?.fontFamily || undefined;
  })();

  const handleSelect = (font: string) => {
    if (font === 'Default') {
      Editor.removeMark(editor, 'fontFamily');
    } else {
      Editor.addMark(editor, 'fontFamily', font);
    }
    ReactEditor.focus(editor as ReactEditor);
  };

  return (
    <Menu.Root>
      <Menu.Trigger disabled={disabled} size="S" aria-label="Font family">
        {currentFont || 'Font'}
      </Menu.Trigger>
      <Menu.Content onCloseAutoFocus={(e: Event) => e.preventDefault()}>
        {FONT_FAMILIES.map((f) => (
          <StyledMenuItem
            key={f}
            onSelect={() => handleSelect(f)}
            $isActive={currentFont === f || (!currentFont && f === 'Default')}
          >
            {f}
          </StyledMenuItem>
        ))}
      </Menu.Content>
    </Menu.Root>
  );
};

const FontSizeSelect = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('FontSizeSelect');

  const currentSize = (() => {
    const marks = Editor.marks(editor) as any;
    return marks?.fontSize || undefined;
  })();

  const handleSelect = (size: string) => {
    if (size === 'Default') {
      Editor.removeMark(editor, 'fontSize');
    } else {
      Editor.addMark(editor, 'fontSize', size);
    }
    ReactEditor.focus(editor as ReactEditor);
  };

  return (
    <Menu.Root>
      <Menu.Trigger disabled={disabled} size="S" aria-label="Font size">
        {currentSize || 'Size'}
      </Menu.Trigger>
      <Menu.Content onCloseAutoFocus={(e: Event) => e.preventDefault()}>
        {FONT_SIZES.map((s) => (
          <StyledMenuItem
            key={s}
            onSelect={() => handleSelect(s)}
            $isActive={currentSize === s || (!currentSize && s === 'Default')}
          >
            {s}
          </StyledMenuItem>
        ))}
      </Menu.Content>
    </Menu.Root>
  );
};

const LINE_HEIGHT_OPTIONS = [
  { value: undefined, label: 'Default' },
  { value: '1', label: '1' },
  { value: '1.15', label: '1.15' },
  { value: '1.5', label: '1.5' },
  { value: '2', label: '2' },
  { value: '2.5', label: '2.5' },
  { value: '3', label: '3' },
];

const LineHeightButton = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('LineHeightButton');
  const { formatMessage } = useIntl();

  const getCurrentLineHeight = (): string | undefined => {
    if (!editor.selection) return undefined;
    const [node] = Editor.parent(editor, editor.selection.anchor, {
      edge: 'start',
      depth: 2,
    });
    return (node as any).lineHeight;
  };

  const currentLH = getCurrentLineHeight();

  const setLineHeight = (lh: string | undefined) => {
    if (!editor.selection) return;
    const entry = Editor.above(editor, {
      match: (n) =>
        !Editor.isEditor(n) &&
        'type' in n &&
        !['text', 'link', 'list-item'].includes((n as any).type),
    });
    if (entry) {
      const [, path] = entry;
      Transforms.setNodes(editor, { lineHeight: lh } as any, { at: path });
    }
    ReactEditor.focus(editor as ReactEditor);
  };

  return (
    <Menu.Root>
      <Menu.Trigger disabled={disabled}>
        <Tooltip
          label={formatMessage({
            id: 'components.Blocks.lineHeight',
            defaultMessage: 'Line height',
          })}
        >
          <FlexButton
            tag="button"
            alignItems="center"
            justifyContent="center"
            width={7}
            height={7}
            hasRadius
            aria-disabled={disabled}
          >
            <LineHeightIcon fill={disabled ? 'neutral300' : 'neutral600'} />
          </FlexButton>
        </Tooltip>
      </Menu.Trigger>
      <Menu.Content>
        {LINE_HEIGHT_OPTIONS.map((opt) => (
          <StyledMenuItem
            key={opt.label}
            onSelect={() => setLineHeight(opt.value)}
            $isActive={currentLH === opt.value}
          >
            {opt.label}
          </StyledMenuItem>
        ))}
      </Menu.Content>
    </Menu.Root>
  );
};

const IndentButton = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('IndentButton');

  const handleIndent = () => {
    if (!editor.selection) return;
    const entry = Editor.above(editor, {
      match: (n) =>
        !Editor.isEditor(n) &&
        'type' in n &&
        !['text', 'link'].includes((n as any).type),
    });
    if (entry) {
      const [node, path] = entry;
      const current = ((node as any).indent as number) || 0;
      if (current < 6) {
        Transforms.setNodes(editor, { indent: current + 1 } as any, {
          at: path,
        });
      }
    }
    ReactEditor.focus(editor as ReactEditor);
  };

  return (
    <ToolbarButton
      icon={IndentIncrease}
      name="indent"
      label={{
        id: 'components.Blocks.indent',
        defaultMessage: 'Increase indent',
      }}
      isActive={false}
      disabled={disabled}
      handleClick={handleIndent}
    />
  );
};

const OutdentButton = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('OutdentButton');

  const handleOutdent = () => {
    if (!editor.selection) return;
    const entry = Editor.above(editor, {
      match: (n) =>
        !Editor.isEditor(n) &&
        'type' in n &&
        !['text', 'link'].includes((n as any).type),
    });
    if (entry) {
      const [node, path] = entry;
      const current = ((node as any).indent as number) || 0;
      if (current > 0) {
        Transforms.setNodes(
          editor,
          { indent: current - 1 || undefined } as any,
          { at: path }
        );
      }
    }
    ReactEditor.focus(editor as ReactEditor);
  };

  return (
    <ToolbarButton
      icon={IndentDecrease}
      name="outdent"
      label={{
        id: 'components.Blocks.outdent',
        defaultMessage: 'Decrease indent',
      }}
      isActive={false}
      disabled={disabled}
      handleClick={handleOutdent}
    />
  );
};

const HorizontalLineButton = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('HorizontalLineButton');
  const { formatMessage } = useIntl();

  const label = formatMessage({
    id: 'components.Blocks.horizontalLine',
    defaultMessage: 'Horizontal line',
  });

  return (
    <Tooltip label={label}>
      <Toolbar.ToggleItem
        value="horizontalLine"
        data-state="off"
        onMouseDown={(e) => {
          e.preventDefault();
          insertHorizontalLine(editor);
          ReactEditor.focus(editor as ReactEditor);
        }}
        aria-disabled={disabled}
        disabled={disabled}
        aria-label={label}
        asChild
      >
        <FlexButton
          tag="button"
          alignItems="center"
          justifyContent="center"
          width={7}
          height={7}
          hasRadius
        >
          <Minus fill={disabled ? 'neutral300' : 'neutral600'} />
        </FlexButton>
      </Toolbar.ToggleItem>
    </Tooltip>
  );
};

const InlineMathButton = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('InlineMathButton');
  const { formatMessage } = useIntl();

  const label = formatMessage({
    id: 'components.Blocks.inlineMath',
    defaultMessage: 'Inline math',
  });

  return (
    <Tooltip label={label}>
      <Toolbar.ToggleItem
        value="inlineMath"
        data-state="off"
        onMouseDown={(e) => {
          e.preventDefault();
          insertInlineMath(editor);
          ReactEditor.focus(editor as ReactEditor);
        }}
        aria-disabled={disabled}
        disabled={disabled}
        aria-label={label}
        asChild
      >
        <FlexButton
          tag="button"
          alignItems="center"
          justifyContent="center"
          width={7}
          height={7}
          hasRadius
        >
          <MathIcon fill={disabled ? 'neutral300' : 'neutral600'} />
        </FlexButton>
      </Toolbar.ToggleItem>
    </Tooltip>
  );
};

const BlocksToolbar = () => {
  const { editor, blocks, modifiers, disabled } =
    useBlocksEditorContext('BlocksToolbar');
  const { formatMessage } = useIntl();

  /**
   * The modifier buttons are disabled when an image is selected.
   */
  const checkButtonDisabled = () => {
    // Always disabled when the whole editor is disabled
    if (disabled) {
      return true;
    }

    if (!editor.selection) {
      return false;
    }

    const selectedNode = editor.children[
      editor.selection.anchor.path[0]
    ] as CustomElement;
    if (!selectedNode) return true;
    if (
      ['code', 'image', 'button', 'horizontal-line'].includes(selectedNode.type)
    ) {
      return true;
    }

    return false;
  };

  const isButtonDisabled = checkButtonDisabled();

  /**
   * Mark toggles, rendered straight into the toolbar.
   *
   * These used to go through EditorToolbarObserver, which relegated whatever
   * didn't fit into a "More" menu. That design only works for a single
   * non-wrapping row clipped by `overflow: hidden`; this toolbar wraps instead,
   * so nothing ever overflowed and the menu's trigger — which reserves its
   * space with `visibility: hidden` — sat there as a permanent empty slot
   * between the lists and the next separator.
   */
  const markButtons = getEntries(modifiers).map(([name, modifier]) => {
    const mark = modifier as {
      icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
      label: MessageDescriptor;
      checkIsActive: (editor: Editor) => boolean;
      handleToggle: (editor: Editor) => void;
    };

    return (
      <ToolbarButton
        key={String(name)}
        name={String(name)}
        icon={mark.icon}
        label={mark.label}
        isActive={mark.checkIsActive(editor)}
        handleClick={() => mark.handleToggle(editor)}
        disabled={isButtonDisabled}
      />
    );
  });

  return (
    <Toolbar.Root aria-disabled={disabled} asChild>
      <ToolbarWrapper padding={2} width="100%">
        <MenuScrollbarStyles />

        {/* ---- History ---- */}
        <Toolbar.ToggleGroup type="multiple" asChild>
          <ToolbarGroup>
            <UndoButton disabled={disabled} />
            <RedoButton disabled={disabled} />
          </ToolbarGroup>
        </Toolbar.ToggleGroup>
        <ToolbarSeparator />

        {/* ---- Structure: what kind of block am I in ---- */}
        <BlocksDropdown />
        <ToolbarSeparator />

        {/* ---- Type: the look of the characters themselves ---- */}
        <ToolbarGroup>
          <FontSizeSelect disabled={isButtonDisabled} />
          <FontFamilySelect disabled={isButtonDisabled} />
          <InlineColorPicker />
        </ToolbarGroup>
        <ToolbarSeparator />

        {/* ---- Marks ---- */}
        <Toolbar.ToggleGroup type="multiple" asChild>
          <ToolbarGroup>
            {markButtons}
            <LinkButton disabled={isButtonDisabled} location="toolbar" />
          </ToolbarGroup>
        </Toolbar.ToggleGroup>
        <ToolbarSeparator />

        {/* ---- Lists ---- */}
        <Toolbar.ToggleGroup type="single" asChild>
          <ToolbarGroup>
            <ListButton
              block={blocks['list-unordered']}
              format={'unordered' as never}
              location="toolbar"
            />
            <ListButton
              block={blocks['list-ordered']}
              format={'ordered' as never}
              location="toolbar"
            />
            <ListButton
              block={blocks['list-todo']}
              format={'todo' as never}
              location="toolbar"
            />
          </ToolbarGroup>
        </Toolbar.ToggleGroup>
        <ToolbarSeparator />

        {/* ---- Paragraph-level formatting ---- */}
        <Toolbar.ToggleGroup type="multiple" asChild>
          <ToolbarGroup>
            <QuoteButton disabled={isButtonDisabled} />
            <TextAlignButton disabled={isButtonDisabled} />
            <LineHeightButton disabled={isButtonDisabled} />
            <IndentButton disabled={isButtonDisabled} />
            <OutdentButton disabled={isButtonDisabled} />
            <RemoveFormattingButton disabled={isButtonDisabled} />
          </ToolbarGroup>
        </Toolbar.ToggleGroup>
        <ToolbarSeparator />

        {/* ---- Insertion: what can I add here ---- */}
        <Toolbar.ToggleGroup type="multiple" asChild>
          <ToolbarGroup>
            <InsertBlockButton disabled={disabled} />
            <InsertTableButton disabled={disabled} />
            <InsertMediaButton disabled={disabled} />
            <InlineMathButton disabled={isButtonDisabled} />
            <HorizontalLineButton disabled={disabled} />
            <EmojiPicker disabled={isButtonDisabled} />
            <SpecialCharPicker disabled={isButtonDisabled} />
          </ToolbarGroup>
        </Toolbar.ToggleGroup>
        <ToolbarSeparator />

        {/* ---- Utilities ---- */}
        <ToolbarGroup>
          <FindReplace disabled={disabled} />
          <ExpandButton />
        </ToolbarGroup>
      </ToolbarWrapper>
    </Toolbar.Root>
  );
};

export {
  BlocksToolbar,
  useConversionModal,
  // Re-used by the floating selection toolbar
  ToolbarButton,
  LinkButton,
  RemoveFormattingButton,
};
