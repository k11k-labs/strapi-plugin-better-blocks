import * as React from 'react';

import {
  Button,
  Field,
  Flex,
  Popover,
  Typography,
} from '@strapi/design-system';
import katex from 'katex';
import { useIntl } from 'react-intl';
import { Editor, Path, Transforms } from 'slate';
import { type RenderElementProps, ReactEditor } from 'slate-react';
import { styled, useTheme } from 'styled-components';

import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import { baseHandleConvert } from '../utils/conversions';
import {
  type CustomElement,
  type MathElement,
  isMathNode,
} from '../utils/types';

import 'katex/dist/katex.min.css';

/* ---------------------------------------------------------------------------
 * Icon (no math glyph ships with @strapi/icons, so we provide our own).
 * Resolves theme color names (e.g. "neutral600") like the built-in icons do.
 * -------------------------------------------------------------------------*/

interface MathIconProps extends React.SVGProps<SVGSVGElement> {
  fill?: string;
}

const MathIcon = ({ fill = 'currentColor', ...rest }: MathIconProps) => {
  const theme = useTheme();
  const colors = theme?.colors as unknown as Record<string, string> | undefined;
  const resolved = colors && fill in colors ? colors[fill] : fill;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={16}
      height={16}
      fill={resolved}
      {...rest}
    >
      <text
        x="16"
        y="23"
        fontSize="22"
        fontFamily="KaTeX_Main, Cambria Math, Times New Roman, serif"
        fontWeight="600"
        textAnchor="middle"
      >
        Σ
      </text>
    </svg>
  );
};

/* ---------------------------------------------------------------------------
 * KaTeX renderer
 * -------------------------------------------------------------------------*/

const KatexContent = ({
  value,
  displayMode,
}: {
  value: string;
  displayMode: boolean;
}) => {
  const html = React.useMemo(() => {
    try {
      return katex.renderToString(value, {
        displayMode,
        throwOnError: false,
        output: 'htmlAndMathml',
        errorColor: '#d02b20',
      });
    } catch {
      return null;
    }
  }, [value, displayMode]);

  if (html === null) {
    return <span style={{ color: '#d02b20' }}>Invalid formula</span>;
  }

  // eslint-disable-next-line react/no-danger
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};

/* ---------------------------------------------------------------------------
 * Insert / convert helpers (shared by toolbar, slash command, auto-transform)
 * -------------------------------------------------------------------------*/

const insertInlineMath = (editor: Editor, value = '') => {
  // Make sure we have a selection to insert at (e.g. toolbar click without focus)
  if (!editor.selection) {
    Transforms.select(editor, Editor.end(editor, []));
  }

  const node: MathElement = {
    type: 'math',
    format: 'inline',
    value,
    children: [{ type: 'text', text: '' }],
  };
  Transforms.insertNodes(editor, node as unknown as CustomElement);
};

/**
 * Convert the currently selected block into a (block) math node.
 * Re-inserts a clean node so no stale text is left in the void's children.
 */
const setBlockMath = (editor: Editor) => {
  const path = baseHandleConvert<MathElement>(editor, {
    type: 'math',
    format: 'block',
    value: '',
    children: [{ type: 'text', text: '' }],
  });

  if (path) {
    Transforms.removeNodes(editor, { at: path });
    Transforms.insertNodes(
      editor,
      {
        type: 'math',
        format: 'block',
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

const BlockMathWrapper = styled.div<{ $selected: boolean; $empty: boolean }>`
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

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary600};
  }
`;

const InlineMathWrapper = styled.span<{ $selected: boolean; $empty: boolean }>`
  display: inline-block;
  vertical-align: middle;
  padding: 0 ${({ theme }) => theme.spaces[1]};
  margin: 0 1px;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.primary100 : theme.colors.neutral100};
  color: ${({ theme, $empty }) =>
    $empty ? theme.colors.neutral500 : theme.colors.neutral800};

  &:hover {
    background: ${({ theme }) => theme.colors.primary100};
  }
`;

const SourceTextarea = styled.textarea`
  width: 100%;
  min-height: 80px;
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
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: auto;
`;

/* ---------------------------------------------------------------------------
 * Element component (renders + edits both inline and block math)
 * -------------------------------------------------------------------------*/

const MathElementComponent = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const math = element as unknown as MathElement;
  const isBlock = math.format === 'block';
  const { formatMessage } = useIntl();
  const { editor, disabled } = useBlocksEditorContext('Math');

  const [open, setOpen] = React.useState(math.value.trim() === '' && !disabled);
  const [source, setSource] = React.useState(math.value);
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
      return ReactEditor.findPath(editor as ReactEditor, math);
    } catch {
      return null;
    }
  };

  const removeNode = () => {
    const path = getPath();
    if (!path) return;
    if (isBlock) {
      // Replace with an empty paragraph so the editor never ends up empty
      Transforms.setNodes(
        editor,
        { type: 'paragraph' } as Partial<CustomElement>,
        {
          at: path,
        }
      );
      Transforms.unsetNodes(editor, ['value', 'format'], { at: path });
    } else {
      Transforms.removeNodes(editor, { at: path });
    }
  };

  const handleSave = () => {
    const path = getPath();
    if (path) {
      Transforms.setNodes(editor, { value: source } as Partial<MathElement>, {
        at: path,
      });
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
    if (math.value.trim() === '') {
      removeNode();
    } else {
      setSource(math.value);
    }
    setOpen(false);
  };

  const isEmpty = math.value.trim() === '';

  const preview = isEmpty ? (
    <Typography variant="pi" textColor="neutral500">
      {formatMessage(
        isBlock
          ? {
              id: 'components.Blocks.math.block.placeholder',
              defaultMessage: 'Add a math formula',
            }
          : {
              id: 'components.Blocks.math.inline.placeholder',
              defaultMessage: 'ƒ(x)',
            }
      )}
    </Typography>
  ) : (
    <KatexContent value={math.value} displayMode={isBlock} />
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
        width="420px"
        alignItems="stretch"
      >
        <Field.Root>
          <Flex direction="column" gap={1} alignItems="stretch">
            <Field.Label>
              {formatMessage({
                id: 'components.Blocks.math.label',
                defaultMessage: 'LaTeX',
              })}
            </Field.Label>
            <SourceTextarea
              ref={textareaRef}
              value={source}
              spellCheck={false}
              placeholder={
                isBlock ? '\\int_0^\\infty e^{-x^2}\\,dx' : 'E = mc^2'
              }
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setSource(e.target.value)
              }
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                // Cmd/Ctrl+Enter saves; plain Enter is allowed for multiline block math
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
              id: 'components.Blocks.math.preview',
              defaultMessage: 'Preview',
            })}
          </Typography>
          <PreviewBox>
            {source.trim() ? (
              <KatexContent value={source} displayMode={isBlock} />
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

  if (isBlock) {
    return (
      <div {...attributes} contentEditable={false}>
        <Popover.Root open={open && !disabled}>
          <Popover.Trigger>
            <BlockMathWrapper
              $selected={open}
              $empty={isEmpty}
              onClick={() => !disabled && setOpen(true)}
            >
              {preview}
            </BlockMathWrapper>
          </Popover.Trigger>
          {editorUi}
        </Popover.Root>
        <span style={{ display: 'none' }}>{children}</span>
      </div>
    );
  }

  return (
    <span {...attributes} contentEditable={false}>
      <Popover.Root open={open && !disabled}>
        <Popover.Trigger>
          <InlineMathWrapper
            $selected={open}
            $empty={isEmpty}
            onClick={() => !disabled && setOpen(true)}
          >
            {preview}
          </InlineMathWrapper>
        </Popover.Trigger>
        {editorUi}
      </Popover.Root>
      <span style={{ display: 'none' }}>{children}</span>
    </span>
  );
};

/* ---------------------------------------------------------------------------
 * Plugin: math nodes are void; inline-format math nodes are also inline
 * -------------------------------------------------------------------------*/

const withMath = (editor: Editor): Editor => {
  const { isVoid, isInline } = editor;

  editor.isVoid = (element) =>
    isMathNode(element as CustomElement) ? true : isVoid(element);

  editor.isInline = (element) =>
    isMathNode(element as CustomElement) &&
    (element as unknown as MathElement).format === 'inline'
      ? true
      : isInline(element);

  return editor;
};

/* ---------------------------------------------------------------------------
 * Block definition
 * -------------------------------------------------------------------------*/

const mathBlocks: Pick<BlocksStore, 'math'> = {
  math: {
    renderElement: (props) => <MathElementComponent {...props} />,
    icon: MathIcon,
    label: { id: 'components.Blocks.blocks.math', defaultMessage: 'Math' },
    matchNode: (node) => (node as { type?: string }).type === 'math',
    isInBlocksSelector: true,
    handleConvert(editor) {
      setBlockMath(editor);
    },
    snippets: ['$$'],
  },
};

export { mathBlocks, withMath, insertInlineMath, setBlockMath, MathIcon };
