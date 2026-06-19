import * as React from 'react';

import {
  Button,
  Field,
  Flex,
  Popover,
  Typography,
} from '@strapi/design-system';
import {
  Information,
  Lightbulb,
  Bell,
  WarningCircle,
  Stop,
} from '@strapi/icons';
import { useIntl, type MessageDescriptor } from 'react-intl';
import { Editor, Element, Node, Path, Range, Text, Transforms } from 'slate';
import { type RenderElementProps, ReactEditor } from 'slate-react';
import { styled } from 'styled-components';

import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import {
  type CalloutElement,
  type CalloutVariant,
  type CustomElement,
} from '../utils/types';

/* ---------------------------------------------------------------------------
 * Variant metadata: icon, Strapi design-token family (light/dark safe) and label
 * -------------------------------------------------------------------------*/

interface VariantMeta {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  /** Strapi color family; we use `${family}600` (accent) and `${family}100` (tint) */
  family: 'secondary' | 'success' | 'alternative' | 'warning' | 'danger';
  label: MessageDescriptor;
}

const VARIANTS: Record<CalloutVariant, VariantMeta> = {
  note: {
    icon: Information,
    family: 'secondary',
    label: { id: 'components.Blocks.callout.note', defaultMessage: 'Note' },
  },
  tip: {
    icon: Lightbulb,
    family: 'success',
    label: { id: 'components.Blocks.callout.tip', defaultMessage: 'Tip' },
  },
  important: {
    icon: Bell,
    family: 'alternative',
    label: {
      id: 'components.Blocks.callout.important',
      defaultMessage: 'Important',
    },
  },
  warning: {
    icon: WarningCircle,
    family: 'warning',
    label: {
      id: 'components.Blocks.callout.warning',
      defaultMessage: 'Warning',
    },
  },
  caution: {
    icon: Stop,
    family: 'danger',
    label: {
      id: 'components.Blocks.callout.caution',
      defaultMessage: 'Caution',
    },
  },
};

const VARIANT_ORDER: CalloutVariant[] = [
  'note',
  'tip',
  'important',
  'warning',
  'caution',
];

const accent = (family: string) => `${family}600`;
const tint = (family: string) => `${family}100`;

/* ---------------------------------------------------------------------------
 * Insert / convert helper (shared by toolbar selector + slash commands)
 * -------------------------------------------------------------------------*/

/**
 * Wrap the current top-level block in a callout of the given variant.
 * Normalization guarantees the callout ends up with at least one block child.
 */
const insertCallout = (editor: Editor, variant: CalloutVariant = 'note') => {
  if (!editor.selection) {
    Transforms.select(editor, Editor.end(editor, []));
  }

  Transforms.wrapNodes(
    editor,
    {
      type: 'callout',
      variant,
      children: [],
    } as unknown as CustomElement,
    {
      // Only wrap top-level blocks, and never wrap a callout inside a callout
      match: (node, path) =>
        !Editor.isEditor(node) &&
        Element.isElement(node) &&
        path.length === 1 &&
        (node as CustomElement).type !== 'callout',
      split: true,
    }
  );
};

/**
 * Pressing Enter on an empty trailing paragraph exits the callout by inserting a
 * fresh paragraph after it. Returns true when it handled the key.
 */
const exitCalloutOnEmptyEnter = (editor: Editor): boolean => {
  const { selection } = editor;
  if (!selection || !Range.isCollapsed(selection)) return false;

  const calloutEntry = Editor.above(editor, {
    match: (node) =>
      !Editor.isEditor(node) &&
      Element.isElement(node) &&
      (node as CustomElement).type === 'callout',
  });
  if (!calloutEntry) return false;
  const [callout, calloutPath] = calloutEntry;

  // The lowest block the cursor is in (a direct child of the callout)
  const blockEntry = Editor.above(editor, {
    match: (node) =>
      !Editor.isEditor(node) &&
      Element.isElement(node) &&
      !editor.isInline(node as Element),
    mode: 'lowest',
  });
  if (!blockEntry) return false;
  const [block, blockPath] = blockEntry;

  const isLastChild =
    blockPath[blockPath.length - 1] ===
    (callout as Element).children.length - 1;
  const isEmpty = Editor.isEmpty(editor, block as Element);
  const atEnd = Editor.isEnd(editor, selection.anchor, blockPath);

  if (isLastChild && isEmpty && atEnd) {
    Transforms.removeNodes(editor, { at: blockPath });
    Transforms.insertNodes(
      editor,
      {
        type: 'paragraph',
        children: [{ type: 'text', text: '' }],
      } as unknown as CustomElement,
      { at: Path.next(calloutPath), select: true }
    );
    return true;
  }

  return false;
};

/* ---------------------------------------------------------------------------
 * Styled components
 * -------------------------------------------------------------------------*/

const colorOf = (theme: { colors: unknown }, token: string): string => {
  const colors = theme.colors as Record<string, string>;
  return colors[token] ?? token;
};

const CalloutAside = styled.aside<{ $family: string }>`
  margin: ${({ theme }) => theme.spaces[3]} 0;
  padding: ${({ theme }) => theme.spaces[3]} ${({ theme }) => theme.spaces[4]};
  border-radius: ${({ theme }) => theme.borderRadius};
  border-left: 4px solid
    ${({ theme, $family }) => colorOf(theme, accent($family))};
  background: ${({ theme, $family }) => colorOf(theme, tint($family))};
`;

const CalloutHeader = styled.div<{ $family: string }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spaces[2]};
  margin-bottom: ${({ theme }) => theme.spaces[2]};
  cursor: pointer;
  user-select: none;
  color: ${({ theme, $family }) => colorOf(theme, accent($family))};
  font-weight: ${({ theme }) => theme.fontWeights.bold};

  svg {
    width: 16px;
    height: 16px;
  }
  svg path {
    fill: ${({ theme, $family }) => colorOf(theme, accent($family))};
  }
`;

const CalloutBody = styled.div`
  & > *:first-child {
    margin-top: 0;
  }
  & > *:last-child {
    margin-bottom: 0;
  }
`;

const VariantButton = styled.button<{ $family: string; $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spaces[2]};
  width: 100%;
  padding: ${({ theme }) => theme.spaces[2]};
  border: 1px solid
    ${({ theme, $family, $active }) =>
      $active ? colorOf(theme, accent($family)) : theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme, $family, $active }) =>
    $active ? colorOf(theme, tint($family)) : theme.colors.neutral0};
  color: ${({ theme }) => theme.colors.neutral800};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes[1]};

  svg {
    width: 16px;
    height: 16px;
  }
  svg path {
    fill: ${({ theme, $family }) => colorOf(theme, accent($family))};
  }

  &:hover {
    border-color: ${({ theme, $family }) => colorOf(theme, accent($family))};
  }
`;

const TitleInput = styled.input`
  width: 100%;
  padding: ${({ theme }) => theme.spaces[2]};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral0};
  color: ${({ theme }) => theme.colors.neutral800};
  font-size: ${({ theme }) => theme.fontSizes[1]};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary600};
  }
`;

/* ---------------------------------------------------------------------------
 * Element component (renders + edits a callout)
 * -------------------------------------------------------------------------*/

const CalloutElementComponent = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const callout = element as unknown as CalloutElement;
  const variant: CalloutVariant = VARIANTS[callout.variant]
    ? callout.variant
    : 'note';
  const meta = VARIANTS[variant];
  const Icon = meta.icon;
  const { formatMessage } = useIntl();
  const { editor, disabled } = useBlocksEditorContext('Callout');

  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState(callout.title ?? '');

  React.useEffect(() => {
    setTitle(callout.title ?? '');
  }, [callout.title]);

  const getPath = (): Path | null => {
    try {
      return ReactEditor.findPath(editor as ReactEditor, callout);
    } catch {
      return null;
    }
  };

  const setVariant = (next: CalloutVariant) => {
    const path = getPath();
    if (!path) return;
    Transforms.setNodes(editor, { variant: next } as Partial<CalloutElement>, {
      at: path,
    });
  };

  const commitTitle = () => {
    const path = getPath();
    if (!path) return;
    const trimmed = title.trim();
    if (trimmed) {
      Transforms.setNodes(
        editor,
        { title: trimmed } as Partial<CalloutElement>,
        {
          at: path,
        }
      );
    } else {
      Transforms.unsetNodes(editor, 'title', { at: path });
    }
  };

  // Dissolve the callout but keep its content (lifts children to the parent level)
  const handleRemove = () => {
    const path = getPath();
    if (!path) return;
    Transforms.unwrapNodes(editor, {
      at: path,
      match: (node) =>
        !Editor.isEditor(node) &&
        Element.isElement(node) &&
        (node as CustomElement).type === 'callout',
      split: true,
    });
    setOpen(false);
    ReactEditor.focus(editor as ReactEditor);
  };

  const headerLabel = callout.title?.trim()
    ? callout.title
    : formatMessage(meta.label);

  return (
    <CalloutAside {...attributes} $family={meta.family} role="note">
      <div contentEditable={false}>
        <Popover.Root open={open && !disabled}>
          <Popover.Trigger>
            <CalloutHeader
              $family={meta.family}
              onClick={() => !disabled && setOpen(true)}
            >
              <Icon />
              <span>{headerLabel}</span>
            </CalloutHeader>
          </Popover.Trigger>
          <Popover.Content
            onPointerDownOutside={() => {
              commitTitle();
              setOpen(false);
            }}
            onEscapeKeyDown={() => {
              commitTitle();
              setOpen(false);
            }}
          >
            <Flex
              direction="column"
              gap={3}
              padding={4}
              width="320px"
              alignItems="stretch"
            >
              <Flex direction="column" gap={1} alignItems="stretch">
                <Typography variant="pi" textColor="neutral600">
                  {formatMessage({
                    id: 'components.Blocks.callout.type',
                    defaultMessage: 'Type',
                  })}
                </Typography>
                {VARIANT_ORDER.map((key) => {
                  const v = VARIANTS[key];
                  const VIcon = v.icon;
                  return (
                    <VariantButton
                      key={key}
                      type="button"
                      $family={v.family}
                      $active={key === variant}
                      onClick={() => setVariant(key)}
                    >
                      <VIcon />
                      {formatMessage(v.label)}
                    </VariantButton>
                  );
                })}
              </Flex>

              <Field.Root>
                <Flex direction="column" gap={1} alignItems="stretch">
                  <Field.Label>
                    {formatMessage({
                      id: 'components.Blocks.callout.title',
                      defaultMessage: 'Custom title (optional)',
                    })}
                  </Field.Label>
                  <TitleInput
                    value={title}
                    placeholder={formatMessage(meta.label)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setTitle(e.target.value)
                    }
                    onBlur={commitTitle}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitTitle();
                        setOpen(false);
                      }
                    }}
                  />
                </Flex>
              </Field.Root>

              <Flex justifyContent="flex-end">
                <Button variant="danger-light" onClick={handleRemove}>
                  {formatMessage({
                    id: 'components.Blocks.popover.remove',
                    defaultMessage: 'Remove',
                  })}
                </Button>
              </Flex>
            </Flex>
          </Popover.Content>
        </Popover.Root>
      </div>
      <CalloutBody>{children}</CalloutBody>
    </CalloutAside>
  );
};

/* ---------------------------------------------------------------------------
 * Plugin: callouts are non-void containers that must hold block children
 * -------------------------------------------------------------------------*/

const withCallout = (editor: Editor): Editor => {
  const { normalizeNode } = editor;

  editor.normalizeNode = (entry) => {
    const [node, path] = entry;

    if (Element.isElement(node) && (node as CustomElement).type === 'callout') {
      // A callout must always contain at least one block child
      if (node.children.length === 0) {
        Transforms.insertNodes(
          editor,
          {
            type: 'paragraph',
            children: [{ type: 'text', text: '' }],
          } as unknown as CustomElement,
          { at: [...path, 0] }
        );
        return;
      }

      for (const [child, childPath] of Node.children(editor, path)) {
        // Wrap stray text / inline children in a paragraph
        if (Text.isText(child) || editor.isInline(child as Element)) {
          Transforms.wrapNodes(
            editor,
            { type: 'paragraph', children: [] } as unknown as CustomElement,
            { at: childPath }
          );
          return;
        }
        // Never allow a callout nested directly inside a callout
        if (
          Element.isElement(child) &&
          (child as CustomElement).type === 'callout'
        ) {
          Transforms.unwrapNodes(editor, { at: childPath });
          return;
        }
      }
    }

    normalizeNode(entry);
  };

  return editor;
};

/* ---------------------------------------------------------------------------
 * Block definition
 * -------------------------------------------------------------------------*/

const calloutBlocks: Pick<BlocksStore, 'callout'> = {
  callout: {
    renderElement: (props) => <CalloutElementComponent {...props} />,
    icon: Information,
    label: {
      id: 'components.Blocks.blocks.callout',
      defaultMessage: 'Callout',
    },
    matchNode: (node) => (node as { type?: string }).type === 'callout',
    isInBlocksSelector: true,
    handleConvert(editor) {
      insertCallout(editor, 'note');
    },
    handleEnterKey(editor) {
      if (exitCalloutOnEmptyEnter(editor)) return;
      editor.insertBreak();
    },
  },
};

export { calloutBlocks, withCallout, insertCallout, VARIANTS, VARIANT_ORDER };
