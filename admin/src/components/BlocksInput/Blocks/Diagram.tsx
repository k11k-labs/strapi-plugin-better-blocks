import * as React from 'react';

import {
  Button,
  Field,
  Flex,
  Popover,
  Typography,
} from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { Editor, Path, Transforms } from 'slate';
import { type RenderElementProps, ReactEditor } from 'slate-react';
import { styled, useTheme } from 'styled-components';

import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import { baseHandleConvert } from '../utils/conversions';
import {
  type CustomElement,
  type DiagramElement,
  isDiagramNode,
} from '../utils/types';

/* ---------------------------------------------------------------------------
 * Icon (no diagram glyph ships with @strapi/icons, so we provide our own).
 * Resolves theme color names (e.g. "neutral600") like the built-in icons do.
 * -------------------------------------------------------------------------*/

interface DiagramIconProps extends React.SVGProps<SVGSVGElement> {
  fill?: string;
}

const DiagramIcon = ({ fill = 'currentColor', ...rest }: DiagramIconProps) => {
  const theme = useTheme();
  const colors = theme?.colors as unknown as Record<string, string> | undefined;
  const resolved = colors && fill in colors ? colors[fill] : fill;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke={resolved}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <rect x="8.5" y="2.5" width="7" height="5" rx="1" />
      <rect x="2.5" y="16.5" width="7" height="5" rx="1" />
      <rect x="14.5" y="16.5" width="7" height="5" rx="1" />
      <path d="M12 7.5v4" />
      <path d="M6 16.5v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
    </svg>
  );
};

/* ---------------------------------------------------------------------------
 * Mermaid renderer (mermaid is heavy, so it is imported lazily on first use).
 * -------------------------------------------------------------------------*/

// Monotonic counter for unique render ids (Slate/StrictMode may render twice).
let diagramRenderSeq = 0;

// Rough luminance check on the editor background so the diagram theme matches
// Strapi's light/dark mode without needing a configuration option.
const isDarkBackground = (color: string | undefined): boolean => {
  if (!color) return false;
  const hex = color.trim().replace('#', '');
  if (hex.length !== 3 && hex.length !== 6) return false;
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Relative luminance (perceptual weights); < 0.5 -> dark surface.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
};

const MermaidContent = ({
  value,
  isDark,
}: {
  value: string;
  isDark: boolean;
}) => {
  const { formatMessage } = useIntl();
  const [svg, setSvg] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    if (value.trim() === '') {
      setSvg(null);
      setError(false);
      return undefined;
    }

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          // Block scripts/event handlers embedded in diagram definitions.
          securityLevel: 'strict',
        });
        // Validate first so a syntax error doesn't leave stray DOM behind.
        await mermaid.parse(value);
        diagramRenderSeq += 1;
        const { svg: rendered } = await mermaid.render(
          `bb-mermaid-${diagramRenderSeq}`,
          value
        );
        if (!cancelled) {
          setSvg(rendered);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setSvg(null);
          setError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value, isDark]);

  if (error) {
    return (
      <Typography variant="pi" textColor="danger600">
        {formatMessage({
          id: 'components.Blocks.diagram.invalid',
          defaultMessage: 'Invalid diagram',
        })}
      </Typography>
    );
  }

  if (svg === null) {
    return (
      <Typography variant="pi" textColor="neutral400">
        …
      </Typography>
    );
  }

  // eslint-disable-next-line react/no-danger
  return <span dangerouslySetInnerHTML={{ __html: svg }} />;
};

/* ---------------------------------------------------------------------------
 * Insert / convert helper (shared by toolbar selector, slash command,
 * auto-transform)
 * -------------------------------------------------------------------------*/

/**
 * Convert the currently selected block into a (block) diagram node.
 * Re-inserts a clean node so no stale text is left in the void's children.
 */
const setBlockDiagram = (editor: Editor) => {
  const path = baseHandleConvert<DiagramElement>(editor, {
    type: 'diagram',
    format: 'mermaid',
    value: '',
    children: [{ type: 'text', text: '' }],
  });

  if (path) {
    Transforms.removeNodes(editor, { at: path });
    Transforms.insertNodes(
      editor,
      {
        type: 'diagram',
        format: 'mermaid',
        value: '',
        children: [{ type: 'text', text: '' }],
      } as unknown as CustomElement,
      { at: path, select: true }
    );
  }
};

/* ---------------------------------------------------------------------------
 * Styled components
 * -------------------------------------------------------------------------*/

const BlockDiagramWrapper = styled.div<{ $selected: boolean; $empty: boolean }>`
  margin: ${({ theme }) => theme.spaces[2]} 0;
  padding: ${({ theme }) => theme.spaces[4]};
  text-align: center;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borderRadius};
  border: 1px solid
    ${({ theme, $selected }) =>
      $selected ? theme.colors.primary600 : theme.colors.neutral200};
  background: ${({ theme }) => theme.colors.neutral100};
  color: ${({ theme, $empty }) =>
    $empty ? theme.colors.neutral500 : theme.colors.neutral800};
  overflow-x: auto;

  svg {
    max-width: 100%;
    height: auto;
  }

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary600};
  }
`;

const SourceTextarea = styled.textarea`
  width: 100%;
  min-height: 120px;
  resize: vertical;
  font-family:
    'SF Mono', SFMono-Regular, ui-monospace, Menlo, Consolas, monospace;
  font-size: ${({ theme }) => theme.fontSizes[1]};
  line-height: 1.5;
  padding: ${({ theme }) => theme.spaces[2]};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral0};
  color: ${({ theme }) => theme.colors.neutral800};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary600};
  }
`;

const PreviewBox = styled.div`
  padding: ${({ theme }) => theme.spaces[3]};
  border: 1px solid ${({ theme }) => theme.colors.neutral150};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral100};
  text-align: center;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: auto;

  svg {
    max-width: 100%;
    height: auto;
  }
`;

/* ---------------------------------------------------------------------------
 * Element component (renders + edits block diagrams)
 * -------------------------------------------------------------------------*/

const DiagramElementComponent = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const diagram = element as unknown as DiagramElement;
  const { formatMessage } = useIntl();
  const { editor, disabled } = useBlocksEditorContext('Diagram');
  const theme = useTheme();
  const isDark = isDarkBackground(theme?.colors?.neutral0 as string);

  const [open, setOpen] = React.useState(
    diagram.value.trim() === '' && !disabled
  );
  const [source, setSource] = React.useState(diagram.value);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (open) {
      // Defer so the popover is mounted before focusing
      const id = window.setTimeout(() => textareaRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  const getPath = (): Path | null => {
    try {
      return ReactEditor.findPath(editor as ReactEditor, diagram);
    } catch {
      return null;
    }
  };

  const removeNode = () => {
    const path = getPath();
    if (!path) return;
    // Replace with an empty paragraph so the editor never ends up empty
    Transforms.setNodes(
      editor,
      { type: 'paragraph' } as Partial<CustomElement>,
      {
        at: path,
      }
    );
    Transforms.unsetNodes(editor, ['value', 'format'], { at: path });
  };

  const handleSave = () => {
    const path = getPath();
    if (path) {
      Transforms.setNodes(
        editor,
        { value: source } as Partial<DiagramElement>,
        { at: path }
      );
    }
    setOpen(false);
    ReactEditor.focus(editor as ReactEditor);
  };

  const handleRemove = () => {
    removeNode();
    setOpen(false);
    ReactEditor.focus(editor as ReactEditor);
  };

  const handleClose = () => {
    // A node that was never committed (no saved value) is discarded on dismiss;
    // otherwise we just revert any unsaved edits to the source.
    if (diagram.value.trim() === '') {
      removeNode();
    } else {
      setSource(diagram.value);
    }
    setOpen(false);
  };

  const isEmpty = diagram.value.trim() === '';

  const preview = isEmpty ? (
    <Typography variant="pi" textColor="neutral500">
      {formatMessage({
        id: 'components.Blocks.diagram.placeholder',
        defaultMessage: 'Add a Mermaid diagram',
      })}
    </Typography>
  ) : (
    <MermaidContent value={diagram.value} isDark={isDark} />
  );

  const editorUi = (
    <Popover.Content
      onPointerDownOutside={handleClose}
      onEscapeKeyDown={handleClose}
    >
      <Flex
        direction="column"
        gap={3}
        padding={4}
        width="480px"
        alignItems="stretch"
      >
        <Field.Root>
          <Flex direction="column" gap={1} alignItems="stretch">
            <Field.Label>
              {formatMessage({
                id: 'components.Blocks.diagram.label',
                defaultMessage: 'Mermaid',
              })}
            </Field.Label>
            <SourceTextarea
              ref={textareaRef}
              value={source}
              spellCheck={false}
              placeholder={'graph TD\n    A[Start] --> B[End];'}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setSource(e.target.value)
              }
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                // Cmd/Ctrl+Enter saves; plain Enter is allowed for multiline diagrams
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSave();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleClose();
                }
              }}
            />
            <Field.Hint />
          </Flex>
        </Field.Root>

        <Flex direction="column" gap={1} alignItems="stretch">
          <Typography variant="pi" textColor="neutral600">
            {formatMessage({
              id: 'components.Blocks.diagram.preview',
              defaultMessage: 'Preview',
            })}
          </Typography>
          <PreviewBox>
            {source.trim() ? (
              <MermaidContent value={source} isDark={isDark} />
            ) : (
              <Typography variant="pi" textColor="neutral400">
                —
              </Typography>
            )}
          </PreviewBox>
        </Flex>

        <Flex justifyContent="space-between" width="100%">
          <Button variant="danger-light" onClick={handleRemove}>
            {formatMessage({
              id: 'components.Blocks.popover.remove',
              defaultMessage: 'Remove',
            })}
          </Button>
          <Flex gap={2}>
            <Button variant="tertiary" onClick={handleClose}>
              {formatMessage({ id: 'global.cancel', defaultMessage: 'Cancel' })}
            </Button>
            <Button onClick={handleSave}>
              {formatMessage({ id: 'global.save', defaultMessage: 'Save' })}
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </Popover.Content>
  );

  return (
    <div {...attributes} contentEditable={false}>
      <Popover.Root open={open && !disabled}>
        <Popover.Trigger>
          <BlockDiagramWrapper
            $selected={open}
            $empty={isEmpty}
            onClick={() => !disabled && setOpen(true)}
          >
            {preview}
          </BlockDiagramWrapper>
        </Popover.Trigger>
        {editorUi}
      </Popover.Root>
      <span style={{ display: 'none' }}>{children}</span>
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Plugin: diagram nodes are void blocks
 * -------------------------------------------------------------------------*/

const withDiagram = (editor: Editor): Editor => {
  const { isVoid } = editor;

  editor.isVoid = (element) =>
    isDiagramNode(element as CustomElement) ? true : isVoid(element);

  return editor;
};

/* ---------------------------------------------------------------------------
 * Block definition
 * -------------------------------------------------------------------------*/

const diagramBlocks: Pick<BlocksStore, 'diagram'> = {
  diagram: {
    renderElement: (props) => <DiagramElementComponent {...props} />,
    icon: DiagramIcon,
    label: {
      id: 'components.Blocks.blocks.diagram',
      defaultMessage: 'Diagram',
    },
    matchNode: (node) => (node as { type?: string }).type === 'diagram',
    isInBlocksSelector: true,
    handleConvert(editor) {
      setBlockDiagram(editor);
    },
    snippets: ['```mermaid'],
  },
};

export { diagramBlocks, withDiagram, setBlockDiagram, DiagramIcon };
