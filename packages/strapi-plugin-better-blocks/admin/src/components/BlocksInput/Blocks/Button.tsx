import * as React from 'react';

import { Box } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { type Path, Editor, Transforms } from 'slate';
import { type RenderElementProps, ReactEditor, useSelected } from 'slate-react';
import { styled, useTheme } from 'styled-components';

import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import { baseHandleConvert } from '../utils/conversions';
import {
  type ButtonElement,
  type ButtonPresets,
  type ButtonStyle,
  type CustomElement,
  isButtonNode,
} from '../utils/types';

import {
  ButtonEditorModal,
  formatFileSize,
  getFileIcon,
} from './ButtonEditorModal';

/* ---------------------------------------------------------------------------
 * Icon (no button glyph ships with @strapi/icons, so we provide our own).
 * -------------------------------------------------------------------------*/

interface ButtonIconProps extends React.SVGProps<SVGSVGElement> {
  fill?: string;
}

const ButtonIcon = ({ fill = 'currentColor', ...rest }: ButtonIconProps) => {
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
      {...rest}
    >
      <rect
        x="2.5"
        y="7.5"
        width="19"
        height="9"
        rx="3"
        fill={resolved}
        opacity="0.18"
        stroke={resolved}
        strokeWidth="1.5"
      />
      <rect x="7" y="11" width="10" height="2" rx="1" fill={resolved} />
    </svg>
  );
};

/* ---------------------------------------------------------------------------
 * Defaults (overridable via plugin/field config)
 * -------------------------------------------------------------------------*/

const getButtonDefaults = (editor: Editor): ButtonStyle => {
  const options = (
    editor as unknown as { pluginOptions?: Record<string, unknown> }
  ).pluginOptions;
  const bg =
    typeof options?.buttonDefaultBackgroundColor === 'string'
      ? (options.buttonDefaultBackgroundColor as string)
      : '#4945ff';
  const text =
    typeof options?.buttonDefaultTextColor === 'string'
      ? (options.buttonDefaultTextColor as string)
      : '#ffffff';

  return {
    backgroundColor: bg,
    textColor: text,
    borderRadius: '4px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
  };
};

const getButtonPresets = (editor: Editor): ButtonPresets | undefined => {
  const options = (
    editor as unknown as { pluginOptions?: Record<string, unknown> }
  ).pluginOptions;
  const presets = options?.buttonPresets;
  return presets && typeof presets === 'object'
    ? (presets as ButtonPresets)
    : undefined;
};

/* ---------------------------------------------------------------------------
 * Insert / convert helper
 * -------------------------------------------------------------------------*/

const makeButtonNode = (editor: Editor): ButtonElement => ({
  type: 'button',
  buttonType: 'link',
  label: '',
  alignment: 'center',
  link: { url: '', target: '_self' },
  showFileSize: true,
  showFileIcon: true,
  style: getButtonDefaults(editor),
  children: [{ type: 'text', text: '' }],
});

const insertButton = (editor: Editor) => {
  // baseHandleConvert turns the current block into the button; re-insert a
  // clean node so no stale text lingers inside the void's children (mirrors Math).
  const path = baseHandleConvert<ButtonElement>(editor, makeButtonNode(editor));
  if (path) {
    Transforms.removeNodes(editor, { at: path });
    Transforms.insertNodes(
      editor,
      makeButtonNode(editor) as unknown as CustomElement,
      {
        at: path,
        select: true,
      }
    );
  }
};

/* ---------------------------------------------------------------------------
 * Styled in-editor preview
 * -------------------------------------------------------------------------*/

const AlignWrapper = styled.div`
  margin: ${({ theme }) => theme.spaces[2]} 0;
`;

const EditorButton = styled.span<{
  $selected: boolean;
  $bg?: string;
  $text?: string;
  $hoverBg?: string;
  $hoverText?: string;
  $radius?: string;
  $fontSize?: string;
  $fontWeight?: string;
  $padding?: string;
  $border?: string;
}>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  transition:
    background-color 0.15s,
    color 0.15s,
    box-shadow 0.15s;
  background-color: ${({ $bg }) => $bg || '#4945ff'};
  color: ${({ $text }) => $text || '#ffffff'};
  border-radius: ${({ $radius }) => $radius || '4px'};
  font-size: ${({ $fontSize }) => $fontSize || '16px'};
  font-weight: ${({ $fontWeight }) => $fontWeight || '600'};
  padding: ${({ $padding }) => $padding || '12px 24px'};
  border: ${({ $border }) => $border || 'none'};
  box-shadow: ${({ theme, $selected }) =>
    $selected ? `0 0 0 3px ${theme.colors.primary600}` : 'none'};

  &:hover {
    ${({ $hoverBg }) => ($hoverBg ? `background-color: ${$hoverBg};` : '')}
    ${({ $hoverText }) => ($hoverText ? `color: ${$hoverText};` : '')}
  }
`;

/* ---------------------------------------------------------------------------
 * Element component
 * -------------------------------------------------------------------------*/

const ButtonElementComponent = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const el = element as unknown as ButtonElement;
  const { formatMessage } = useIntl();
  const { editor, disabled } = useBlocksEditorContext('Button');
  const selected = useSelected();

  // A freshly inserted button (empty label) opens its editor immediately.
  const [open, setOpen] = React.useState(
    (el.label ?? '').trim() === '' && !disabled
  );

  const getPath = (): Path | null => {
    try {
      return ReactEditor.findPath(editor as ReactEditor, el);
    } catch {
      return null;
    }
  };

  const removeNode = () => {
    const path = getPath();
    if (!path) return;
    if (editor.children.length === 1) {
      // Never leave the editor empty: fall back to a paragraph.
      Transforms.setNodes(
        editor,
        { type: 'paragraph' } as Partial<CustomElement>,
        { at: path }
      );
      Transforms.unsetNodes(
        editor,
        [
          'buttonType',
          'label',
          'alignment',
          'link',
          'file',
          'showFileSize',
          'showFileIcon',
          'filePreview',
          'style',
          'cssClass',
        ],
        { at: path }
      );
    } else {
      Transforms.removeNodes(editor, { at: path });
    }
  };

  const handleSave = (patch: Partial<ButtonElement>) => {
    const path = getPath();
    if (path) {
      Transforms.setNodes(editor, patch as Partial<CustomElement>, {
        at: path,
      });
      // Drop the keys that belong to the other mode so the JSON stays clean.
      Transforms.unsetNodes(
        editor,
        patch.buttonType === 'link'
          ? ['file', 'showFileSize', 'showFileIcon', 'filePreview']
          : ['link'],
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
    // Discard a button that was never given a label.
    if ((el.label ?? '').trim() === '') {
      removeNode();
    }
    setOpen(false);
  };

  const align = el.alignment ?? 'center';
  const isFile = el.buttonType === 'file';
  const label =
    (el.label ?? '').trim() ||
    formatMessage({
      id: 'components.Blocks.button.preview.placeholder',
      defaultMessage: 'Button',
    });

  return (
    <Box {...attributes}>
      {children}
      <AlignWrapper style={{ textAlign: align }} contentEditable={false}>
        <EditorButton
          className={el.cssClass || undefined}
          $selected={selected}
          $bg={el.style?.backgroundColor}
          $text={el.style?.textColor}
          $hoverBg={el.style?.hoverBackgroundColor}
          $hoverText={el.style?.hoverTextColor}
          $radius={el.style?.borderRadius}
          $fontSize={el.style?.fontSize}
          $fontWeight={el.style?.fontWeight}
          $padding={el.style?.padding}
          $border={el.style?.border}
          onMouseDown={(e) => {
            // Don't steal the Slate selection before opening the editor.
            e.preventDefault();
            if (!disabled) setOpen(true);
          }}
        >
          {isFile && el.showFileIcon && el.file ? (
            <span>{getFileIcon(el.file.ext)}</span>
          ) : null}
          <span>{label}</span>
          {isFile && el.showFileSize && el.file?.size ? (
            <span>({formatFileSize(el.file.size)})</span>
          ) : null}
        </EditorButton>
      </AlignWrapper>
      {open && !disabled ? (
        <ButtonEditorModal
          open
          element={el}
          presets={getButtonPresets(editor)}
          onSave={handleSave}
          onRemove={handleRemove}
          onClose={handleClose}
        />
      ) : null}
    </Box>
  );
};

/* ---------------------------------------------------------------------------
 * Plugin: button nodes are void blocks
 * -------------------------------------------------------------------------*/

const withButtons = (editor: Editor): Editor => {
  const { isVoid } = editor;
  editor.isVoid = (element) =>
    isButtonNode(element as CustomElement) ? true : isVoid(element);
  return editor;
};

/* ---------------------------------------------------------------------------
 * Block definition
 * -------------------------------------------------------------------------*/

const buttonBlocks: Pick<BlocksStore, 'button'> = {
  button: {
    renderElement: (props) => <ButtonElementComponent {...props} />,
    icon: ButtonIcon,
    label: {
      id: 'components.Blocks.blocks.button',
      defaultMessage: 'Button',
    },
    matchNode: (node) => (node as { type?: string }).type === 'button',
    isInBlocksSelector: true,
    handleConvert(editor) {
      insertButton(editor);
    },
    handleBackspaceKey(editor) {
      if (editor.children.length === 1) {
        Transforms.setNodes(editor, {
          type: 'paragraph',
        } as Partial<CustomElement>);
      } else {
        Transforms.removeNodes(editor);
      }
    },
    handleEnterKey(editor) {
      Transforms.insertNodes(editor, {
        type: 'paragraph',
        children: [{ type: 'text', text: '' }],
      } as unknown as CustomElement);
    },
    snippets: ['[button]'],
  },
};

export { buttonBlocks, withButtons, insertButton, ButtonIcon };
