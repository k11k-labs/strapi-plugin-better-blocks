import * as React from 'react';
import { useElementOnScreen } from '@strapi/admin/strapi-admin';
import * as Toolbar from '@radix-ui/react-toolbar';
import {
  Button,
  Flex,
  Field,
  Popover,
  Tooltip,
  SingleSelect,
  SingleSelectOption,
  Box,
  FlexComponent,
  BoxComponent,
  Menu,
  IconButton,
} from '@strapi/design-system';
import { Link, Minus, PaintBrush, GridNine, Play } from '@strapi/icons';
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

import {
  EditorToolbarObserver,
  type ObservedComponent,
} from '../EditorToolbarObserver';

import {
  type BlocksStore,
  type SelectorBlockKey,
  isSelectorBlockKey,
  useBlocksEditorContext,
} from './BlocksEditor';
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
import { insertTable } from './Blocks/Table';
import { insertMediaEmbed, isMediaUrl } from './Blocks/MediaEmbed';
import {
  UndoIcon,
  RedoIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  AlignJustifyIcon,
} from './FontModifiersIcons';
import InlineColorPicker from './InlineColorPicker';

const ToolbarSeparator = styled(Flex)`
  width: 1px;
  height: 2.4rem;
  background: ${({ theme }) => theme.colors.neutral200};
  flex-shrink: 0;
`;

const ToolbarWrapper = styled<FlexComponent>(Flex)`
  &[aria-disabled='true'] {
    cursor: not-allowed;
    background: ${({ theme }) => theme.colors.neutral150};
  }
`;

const FlexButton = styled<FlexComponent<'button'>>(Flex)`
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

const SelectWrapper = styled<BoxComponent>(Box)`
  // Styling changes to SingleSelect component don't work, so adding wrapper to target SingleSelect
  div[role='combobox'] {
    border: none;
    cursor: pointer;
    min-height: unset;
    padding-top: 6px;
    padding-bottom: 6px;

    &[aria-disabled='false']:hover {
      cursor: pointer;
      background: ${({ theme }) => theme.colors.primary100};
    }

    &[aria-disabled] {
      background: transparent;
      cursor: inherit;

      // Select text and icons should also have disabled color
      span {
        color: ${({ theme }) => theme.colors.neutral600};
      }
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

const BlocksDropdown = () => {
  const { editor, blocks, disabled } = useBlocksEditorContext('BlocksDropdown');
  const { formatMessage } = useIntl();
  const { modalElement, handleConversionResult } = useConversionModal();

  const blockKeysToInclude: SelectorBlockKey[] = getEntries(blocks).reduce<
    ReturnType<typeof getEntries>
  >((currentKeys, entry) => {
    const [key, block] = entry;

    return block.isInBlocksSelector ? [...currentKeys, key] : currentKeys;
  }, []);

  const [blockSelected, setBlockSelected] =
    React.useState<SelectorBlockKey>('paragraph');

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

    setBlockSelected(optionKey);
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

  // Listen to the selection change and update the selected block in the dropdown
  React.useEffect(() => {
    if (editor.selection) {
      let selectedNode: Ancestor;

      // If selection anchor is a list-item, get its parent
      const currentListEntry = Editor.above(editor, {
        match: (node) =>
          !Editor.isEditor(node) && 'type' in node && node.type === 'list',
        at: editor.selection.anchor,
      });

      if (currentListEntry) {
        const [currentList] = currentListEntry;
        selectedNode = currentList;
      } else {
        // Get the parent node of the anchor other than list-item
        const [anchorNode] = Editor.parent(editor, editor.selection.anchor, {
          edge: 'start',
          depth: 2,
        });

        // @ts-expect-error slate's delete behaviour creates an exceptional type
        if (anchorNode.type === 'list-item') {
          // When the last node in the selection is a list item,
          // slate's default delete operation leaves an empty list-item instead of converting it into a paragraph.
          // Issue: https://github.com/ianstormtaylor/slate/issues/2500

          Transforms.setNodes(editor, {
            type: 'paragraph',
          } as Block<'paragraph'>);
          // @ts-expect-error convert explicitly type to paragraph
          selectedNode = { ...anchorNode, type: 'paragraph' };
        } else {
          selectedNode = anchorNode;
        }
      }

      // Find the block key that matches the anchor node
      const anchorBlockKey = getKeys(blocks).find(
        (blockKey) =>
          !Editor.isEditor(selectedNode) &&
          blocks[blockKey].matchNode(selectedNode as never)
      );

      // Change the value selected in the dropdown if it doesn't match the anchor block key
      if (anchorBlockKey && anchorBlockKey !== blockSelected) {
        setBlockSelected(anchorBlockKey as SelectorBlockKey);
      }
    }
  }, [editor.selection, editor, blocks, blockSelected]);

  const Icon = blocks[blockSelected].icon;

  return (
    <>
      <SelectWrapper>
        <SingleSelect
          startIcon={<Icon />}
          onChange={handleSelect}
          placeholder={formatMessage(blocks[blockSelected].label)}
          value={blockSelected}
          onCloseAutoFocus={preventSelectFocus}
          aria-label={formatMessage({
            id: 'components.Blocks.blocks.selectBlock',
            defaultMessage: 'Select a block',
          })}
          disabled={disabled}
        >
          {blockKeysToInclude.map((key) => (
            <BlockOption
              key={key}
              value={key}
              label={blocks[key].label}
              icon={blocks[key].icon}
              blockSelected={blockSelected}
            />
          ))}
        </SingleSelect>
      </SelectWrapper>
      {modalElement}
    </>
  );
};

interface BlockOptionProps {
  value: string;
  icon: React.ComponentType<React.SVGProps<SVGElement>>;
  label: MessageDescriptor;
  blockSelected: string;
}

const BlockOption = ({
  value,
  icon: Icon,
  label,
  blockSelected,
}: BlockOptionProps) => {
  const { formatMessage } = useIntl();

  const isSelected = value === blockSelected;

  return (
    <SingleSelectOption
      startIcon={<Icon fill={isSelected ? 'primary600' : 'neutral600'} />}
      value={value}
    >
      {formatMessage(label)}
    </SingleSelectOption>
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
  }

  svg {
    fill: ${({ theme, $isActive }) =>
      $isActive ? theme.colors.primary600 : theme.colors.neutral600};
  }
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

const InsertTableButton = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('InsertTableButton');
  const { formatMessage } = useIntl();

  const label = formatMessage({
    id: 'components.Blocks.insertTable',
    defaultMessage: 'Insert table',
  });

  return (
    <Tooltip label={label}>
      <Toolbar.ToggleItem
        value="insertTable"
        data-state="off"
        onMouseDown={(e) => {
          e.preventDefault();
          insertTable(editor);
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
          <GridNine fill={disabled ? 'neutral300' : 'neutral600'} />
        </FlexButton>
      </Toolbar.ToggleItem>
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
    if (mediaUrl && isMediaUrl(mediaUrl)) {
      insertMediaEmbed(editor, mediaUrl);
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
    <Popover.Root open={showInput} onOpenChange={setShowInput}>
      <Popover.Trigger>
        <Tooltip label={label}>
          <FlexButton
            tag="button"
            alignItems="center"
            justifyContent="center"
            width={7}
            height={7}
            hasRadius
            aria-disabled={disabled}
            aria-label={label}
            onClick={() => !disabled && setShowInput(true)}
          >
            <Play fill={disabled ? 'neutral300' : 'neutral600'} />
          </FlexButton>
        </Tooltip>
      </Popover.Trigger>
      <Popover.Content>
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
              disabled={!mediaUrl || !isMediaUrl(mediaUrl)}
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
    if (['code', 'image', 'horizontal-line'].includes(selectedNode.type)) {
      return true;
    }

    return false;
  };

  const isButtonDisabled = checkButtonDisabled();

  /**
   * Observed components are ones that may or may not be visible in the toolbar, depending on the
   * available space. They provide two render props:
   * - renderInToolbar: for when we try to render the component in the toolbar (may be hidden)
   * - renderInMenu: for when the component didn't fit in the toolbar and is relegated
   *   to the "more" menu
   */
  const observedComponents: ObservedComponent[] = [
    ...Object.entries(modifiers).map(([name, modifier]) => {
      const Icon = (
        modifier as { icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }
      ).icon;
      const isActive = (
        modifier as { checkIsActive: (editor: Editor) => boolean }
      ).checkIsActive(editor);
      const handleSelect = () =>
        (modifier as { handleToggle: (editor: Editor) => void }).handleToggle(
          editor
        );

      return {
        toolbar: (
          <ToolbarButton
            key={name}
            name={name}
            icon={
              (
                modifier as {
                  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
                }
              ).icon
            }
            label={(modifier as { label: MessageDescriptor }).label}
            isActive={(
              modifier as { checkIsActive: (editor: Editor) => boolean }
            ).checkIsActive(editor)}
            handleClick={handleSelect}
            disabled={isButtonDisabled}
          />
        ),
        menu: (
          <StyledMenuItem onSelect={handleSelect} $isActive={isActive}>
            <Icon />
            {formatMessage((modifier as { label: MessageDescriptor }).label)}
          </StyledMenuItem>
        ),
        key: `modifier.${name}`,
      };
    }),
    {
      toolbar: <LinkButton disabled={isButtonDisabled} location="toolbar" />,
      menu: <LinkButton disabled={isButtonDisabled} location="menu" />,
      key: 'block.link',
    },
    {
      // List buttons can only be rendered together when in the toolbar
      toolbar: (
        <Flex direction="row" gap={1}>
          <ToolbarSeparator />
          <Toolbar.ToggleGroup type="single" asChild>
            <Flex gap={1}>
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
            </Flex>
          </Toolbar.ToggleGroup>
        </Flex>
      ),
      menu: (
        <>
          <Menu.Separator />
          <ListButton
            block={blocks['list-unordered']}
            format={'unordered' as never}
            location="menu"
          />
          <ListButton
            block={blocks['list-ordered']}
            format={'ordered' as never}
            location="menu"
          />
          <ListButton
            block={blocks['list-todo']}
            format={'todo' as never}
            location="menu"
          />
        </>
      ),
      key: 'block.list',
    },
  ];

  return (
    <Toolbar.Root aria-disabled={disabled} asChild>
      <ToolbarWrapper gap={2} padding={2} width="100%">
        <Toolbar.ToggleGroup type="multiple" asChild>
          <Flex direction="row" gap={1}>
            <UndoButton disabled={disabled} />
            <RedoButton disabled={disabled} />
          </Flex>
        </Toolbar.ToggleGroup>
        <ToolbarSeparator />
        <BlocksDropdown />
        <ToolbarSeparator />
        <InlineColorPicker />
        <ToolbarSeparator />
        <Toolbar.ToggleGroup type="multiple" asChild>
          <Flex direction="row" gap={1} grow={1} overflow="hidden">
            <EditorToolbarObserver observedComponents={observedComponents} />
          </Flex>
        </Toolbar.ToggleGroup>
        <ToolbarSeparator />
        <TextAlignButton disabled={isButtonDisabled} />
        <ToolbarSeparator />
        <Toolbar.ToggleGroup type="multiple" asChild>
          <Flex direction="row" gap={1}>
            <InsertTableButton disabled={disabled} />
            <InsertMediaButton disabled={disabled} />
            <HorizontalLineButton disabled={disabled} />
            <RemoveFormattingButton disabled={isButtonDisabled} />
          </Flex>
        </Toolbar.ToggleGroup>
      </ToolbarWrapper>
    </Toolbar.Root>
  );
};

export { BlocksToolbar, useConversionModal };
