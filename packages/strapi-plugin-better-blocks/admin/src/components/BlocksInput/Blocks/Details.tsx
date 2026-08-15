import * as React from 'react';

import {
  Button,
  Field,
  Flex,
  Popover,
  Typography,
} from '@strapi/design-system';
import { CaretDown } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { Editor, Element, Node, Path, Range, Text, Transforms } from 'slate';
import { type RenderElementProps, ReactEditor } from 'slate-react';
import { styled } from 'styled-components';

import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import { type CustomElement, type DetailsElement } from '../utils/types';

/* ---------------------------------------------------------------------------
 * Constants & config helpers
 * -------------------------------------------------------------------------*/

const DEFAULT_SUMMARY = 'Click to expand';

type DetailsStyle = 'github' | 'custom';

/** Read the admin-configured default summary text from the editor instance. */
const getDefaultSummary = (editor: Editor): string => {
  const options = (
    editor as unknown as { pluginOptions?: Record<string, unknown> }
  ).pluginOptions;
  const configured = options?.detailsDefaultSummary;
  return typeof configured === 'string' && configured.trim()
    ? configured.trim()
    : DEFAULT_SUMMARY;
};

/* ---------------------------------------------------------------------------
 * Insert / convert helper (shared by toolbar selector + slash commands)
 * -------------------------------------------------------------------------*/

/**
 * Wrap the current block in a collapsible details section. Nesting is allowed,
 * so we wrap any block that is a direct child of the editor or of another
 * details node. Normalization guarantees at least one block child.
 */
const insertDetails = (editor: Editor, summary?: string) => {
  if (!editor.selection) {
    Transforms.select(editor, Editor.end(editor, []));
  }

  Transforms.wrapNodes(
    editor,
    {
      type: 'details',
      summary: summary ?? getDefaultSummary(editor),
      defaultOpen: true,
      children: [],
    } as unknown as CustomElement,
    {
      match: (node, path) => {
        if (Editor.isEditor(node) || !Element.isElement(node)) return false;
        if (editor.isInline(node as Element)) return false;
        if ((node as CustomElement).type === 'details') return false;
        const parentEntry = Editor.parent(editor, path);
        const parent = parentEntry?.[0];
        return (
          !!parent &&
          (Editor.isEditor(parent) ||
            (Element.isElement(parent) &&
              (parent as CustomElement).type === 'details'))
        );
      },
      split: true,
    }
  );
};

/**
 * Pressing Enter on an empty trailing block exits the details by inserting a
 * fresh paragraph after it. Returns true when it handled the key.
 */
const exitDetailsOnEmptyEnter = (editor: Editor): boolean => {
  const { selection } = editor;
  if (!selection || !Range.isCollapsed(selection)) return false;

  const detailsEntry = Editor.above(editor, {
    match: (node) =>
      !Editor.isEditor(node) &&
      Element.isElement(node) &&
      (node as CustomElement).type === 'details',
  });
  if (!detailsEntry) return false;
  const [details, detailsPath] = detailsEntry;

  // The lowest block the cursor is in (a direct child of the details node)
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
    (details as Element).children.length - 1;
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
      { at: Path.next(detailsPath), select: true }
    );
    return true;
  }

  return false;
};

/* ---------------------------------------------------------------------------
 * Styled components
 * -------------------------------------------------------------------------*/

const DetailsContainer = styled.div<{ $style: DetailsStyle }>`
  margin: ${({ theme }) => theme.spaces[3]} 0;
  ${({ theme, $style }) =>
    $style === 'custom'
      ? `
    border: 1px solid ${theme.colors.neutral200};
    border-radius: ${theme.borderRadius};
    overflow: hidden;
  `
      : ''}
`;

/*
 * `github` style mirrors GitHub's rendered markdown <details>: no background bar,
 * just a small disclosure triangle + bold clickable summary, content indented below.
 * `custom` wraps it in a bordered box with a tinted (#f6f8fa-style) header bar.
 */
const DetailsHeader = styled.div<{ $style: DetailsStyle; $open: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spaces[1]};
  cursor: pointer;
  user-select: none;
  font-weight: ${({ theme }) => theme.fontWeights.semiBold};
  color: ${({ theme }) => theme.colors.neutral800};

  ${({ theme, $style, $open }) =>
    $style === 'custom'
      ? `
    padding: ${theme.spaces[2]} ${theme.spaces[3]};
    background: ${theme.colors.neutral100};
    ${$open ? `border-bottom: 1px solid ${theme.colors.neutral200};` : ''}
  `
      : `
    padding: ${theme.spaces[1]} 0;
  `}
`;

const Triangle = styled.button<{ $open: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: inherit;
  flex-shrink: 0;

  svg {
    width: 10px;
    height: 10px;
    transition: transform 0.2s ease;
    transform: rotate(${({ $open }) => ($open ? '0deg' : '-90deg')});
  }
  svg path {
    fill: ${({ theme }) => theme.colors.neutral600};
  }
`;

/* Rendered as a <button> (the popover trigger) but should look like plain text */
const SummaryLabel = styled.span`
  flex: 1;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  font: inherit;
  font-weight: inherit;
  color: inherit;
  cursor: pointer;
`;

/** Smooth expand/collapse using the grid-rows 0fr/1fr technique. */
const DetailsBody = styled.div<{ $open: boolean }>`
  display: grid;
  grid-template-rows: ${({ $open }) => ($open ? '1fr' : '0fr')};
  transition: grid-template-rows 0.2s ease;
`;

/*
 * The clip layer MUST carry overflow:hidden + min-height:0 and NO padding, or a
 * grid item's default `min-height: auto` keeps it from collapsing to zero (the
 * "sliver" bug). Padding lives on the inner wrapper so it is clipped when closed.
 */
const DetailsBodyClip = styled.div`
  overflow: hidden;
  min-height: 0;
`;

const DetailsBodyInner = styled.div<{ $style: DetailsStyle }>`
  padding: ${({ theme, $style }) =>
    $style === 'custom'
      ? `${theme.spaces[3]}`
      : `${theme.spaces[2]} 0 ${theme.spaces[2]} ${theme.spaces[5]}`};

  & > *:first-child {
    margin-top: 0;
  }
  & > *:last-child {
    margin-bottom: 0;
  }
`;

const SummaryInput = styled.input`
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

/* Segmented control button for the style selector (GitHub / Custom) */
const StyleButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: ${({ theme }) => theme.spaces[2]};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.primary600 : theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary100 : theme.colors.neutral0};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary600 : theme.colors.neutral800};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes[1]};

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary600};
  }
`;

/* A small on/off switch (used for "Open by default") */
const SwitchTrack = styled.button<{ $on: boolean }>`
  position: relative;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
  border: none;
  border-radius: 999px;
  padding: 0;
  cursor: pointer;
  background: ${({ theme, $on }) =>
    $on ? theme.colors.primary600 : theme.colors.neutral200};
  transition: background 0.15s ease;
`;

const SwitchKnob = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 2px;
  left: ${({ $on }) => ($on ? '20px' : '2px')};
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.neutral0};
  transition: left 0.15s ease;
`;

/* ---------------------------------------------------------------------------
 * Element component (renders + edits a details section)
 * -------------------------------------------------------------------------*/

const DetailsElementComponent = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const details = element as unknown as DetailsElement;
  const { formatMessage } = useIntl();
  const { editor, disabled, pluginOptions } = useBlocksEditorContext('Details');

  // Effective style: per-block override > field/global config > 'github'
  const configStyle = pluginOptions?.detailsStyle as DetailsStyle | undefined;
  const style: DetailsStyle =
    details.style === 'github' || details.style === 'custom'
      ? details.style
      : configStyle === 'custom'
        ? 'custom'
        : 'github';
  // `defaultOpen` is the PERSISTED option (the frontend's initial state); it is
  // only ever changed via the "Open by default" toggle in the popover.
  const isDefaultOpen = details.defaultOpen !== false;

  // `previewOpen` is LOCAL editor-only state: expanding/collapsing in the editor
  // is just a preview and must never mutate the stored `defaultOpen`. It follows
  // `defaultOpen` whenever that option changes (e.g. via the toggle or undo).
  const [previewOpen, setPreviewOpen] = React.useState(isDefaultOpen);

  React.useEffect(() => {
    setPreviewOpen(isDefaultOpen);
  }, [isDefaultOpen]);

  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [summary, setSummary] = React.useState(details.summary ?? '');

  React.useEffect(() => {
    setSummary(details.summary ?? '');
  }, [details.summary]);

  const getPath = (): Path | null => {
    try {
      return ReactEditor.findPath(editor as ReactEditor, details);
    } catch {
      return null;
    }
  };

  const setDefaultOpen = (next: boolean) => {
    const path = getPath();
    if (!path) return;
    Transforms.setNodes(
      editor,
      { defaultOpen: next } as Partial<DetailsElement>,
      {
        at: path,
      }
    );
  };

  // Header triangle: preview-only. Never writes to the node.
  const togglePreview = (event: React.MouseEvent) => {
    event.stopPropagation();
    setPreviewOpen((prev) => !prev);
  };

  const setStyle = (next: DetailsStyle) => {
    const path = getPath();
    if (!path) return;
    Transforms.setNodes(editor, { style: next } as Partial<DetailsElement>, {
      at: path,
    });
  };

  const commitSummary = () => {
    const path = getPath();
    if (!path) return;
    const trimmed = summary.trim() || getDefaultSummaryFromContext();
    Transforms.setNodes(
      editor,
      { summary: trimmed } as Partial<DetailsElement>,
      {
        at: path,
      }
    );
    setSummary(trimmed);
  };

  const getDefaultSummaryFromContext = (): string => {
    const configured = pluginOptions?.detailsDefaultSummary;
    return typeof configured === 'string' && configured.trim()
      ? configured.trim()
      : DEFAULT_SUMMARY;
  };

  // Dissolve the details but keep its content (lifts children to the parent level)
  const handleRemove = () => {
    const path = getPath();
    if (!path) return;
    Transforms.unwrapNodes(editor, {
      at: path,
      match: (node) =>
        !Editor.isEditor(node) &&
        Element.isElement(node) &&
        (node as CustomElement).type === 'details',
      split: true,
    });
    setPopoverOpen(false);
    ReactEditor.focus(editor as ReactEditor);
  };

  const headerLabel = details.summary?.trim()
    ? details.summary
    : getDefaultSummaryFromContext();

  return (
    <DetailsContainer {...attributes} $style={style}>
      <div contentEditable={false}>
        <DetailsHeader $style={style} $open={previewOpen}>
          <Triangle
            type="button"
            $open={previewOpen}
            aria-expanded={previewOpen}
            aria-label={formatMessage({
              id: 'components.Blocks.details.toggle',
              defaultMessage: 'Toggle section',
            })}
            onClick={togglePreview}
          >
            <CaretDown />
          </Triangle>
          <Popover.Root open={popoverOpen && !disabled}>
            <Popover.Trigger>
              <SummaryLabel
                as="button"
                type="button"
                onClick={() => !disabled && setPopoverOpen(true)}
              >
                {headerLabel}
              </SummaryLabel>
            </Popover.Trigger>
            <Popover.Content
              onPointerDownOutside={() => {
                commitSummary();
                setPopoverOpen(false);
              }}
              onEscapeKeyDown={() => {
                commitSummary();
                setPopoverOpen(false);
              }}
            >
              <Flex
                direction="column"
                gap={3}
                padding={4}
                width="320px"
                alignItems="stretch"
              >
                <Field.Root>
                  <Flex direction="column" gap={1} alignItems="stretch">
                    <Field.Label>
                      {formatMessage({
                        id: 'components.Blocks.details.summary',
                        defaultMessage: 'Summary text',
                      })}
                    </Field.Label>
                    <SummaryInput
                      value={summary}
                      placeholder={formatMessage({
                        id: 'components.Blocks.details.summary.placeholder',
                        defaultMessage: 'Enter summary text…',
                      })}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSummary(e.target.value)
                      }
                      onBlur={commitSummary}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitSummary();
                          setPopoverOpen(false);
                        }
                      }}
                    />
                  </Flex>
                </Field.Root>

                <Flex direction="column" gap={1} alignItems="stretch">
                  <Typography variant="pi" textColor="neutral600">
                    {formatMessage({
                      id: 'components.Blocks.details.style',
                      defaultMessage: 'Style',
                    })}
                  </Typography>
                  <Flex gap={2}>
                    <StyleButton
                      type="button"
                      $active={style === 'github'}
                      onClick={() => setStyle('github')}
                    >
                      {formatMessage({
                        id: 'components.Blocks.details.style.github',
                        defaultMessage: 'GitHub',
                      })}
                    </StyleButton>
                    <StyleButton
                      type="button"
                      $active={style === 'custom'}
                      onClick={() => setStyle('custom')}
                    >
                      {formatMessage({
                        id: 'components.Blocks.details.style.custom',
                        defaultMessage: 'Custom',
                      })}
                    </StyleButton>
                  </Flex>
                </Flex>

                <Flex justifyContent="space-between" alignItems="center">
                  <Typography variant="omega">
                    {formatMessage({
                      id: 'components.Blocks.details.openByDefault',
                      defaultMessage: 'Open by default',
                    })}
                  </Typography>
                  <SwitchTrack
                    type="button"
                    role="switch"
                    aria-checked={isDefaultOpen}
                    $on={isDefaultOpen}
                    onClick={() => setDefaultOpen(!isDefaultOpen)}
                  >
                    <SwitchKnob $on={isDefaultOpen} />
                  </SwitchTrack>
                </Flex>

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
        </DetailsHeader>
      </div>
      <DetailsBody $open={previewOpen}>
        <DetailsBodyClip>
          <DetailsBodyInner $style={style}>{children}</DetailsBodyInner>
        </DetailsBodyClip>
      </DetailsBody>
    </DetailsContainer>
  );
};

/* ---------------------------------------------------------------------------
 * Plugin: details are non-void containers that must hold block children.
 * Nested details are allowed (unlike callouts).
 * -------------------------------------------------------------------------*/

const withDetails = (editor: Editor): Editor => {
  const { normalizeNode } = editor;

  editor.normalizeNode = (entry) => {
    const [node, path] = entry;

    if (Element.isElement(node) && (node as CustomElement).type === 'details') {
      // A details section must always contain at least one block child
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
      }
    }

    normalizeNode(entry);
  };

  return editor;
};

/* ---------------------------------------------------------------------------
 * Block definition
 * -------------------------------------------------------------------------*/

const detailsBlocks: Pick<BlocksStore, 'details'> = {
  details: {
    renderElement: (props) => <DetailsElementComponent {...props} />,
    icon: CaretDown,
    label: {
      id: 'components.Blocks.blocks.details',
      defaultMessage: 'Details (collapsible)',
    },
    matchNode: (node) => (node as { type?: string }).type === 'details',
    isInBlocksSelector: true,
    handleConvert(editor) {
      insertDetails(editor);
    },
    handleEnterKey(editor) {
      if (exitDetailsOnEmptyEnter(editor)) return;
      editor.insertBreak();
    },
  },
};

export { detailsBlocks, withDetails, insertDetails, DEFAULT_SUMMARY };
