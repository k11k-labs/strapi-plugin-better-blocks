import * as React from 'react';

import { Typography, TypographyComponent } from '@strapi/design-system';
import { Bold, Italic, Underline, StrikeThrough, Code } from '@strapi/icons';
import { Subsscript, Superscript, Uppercase } from './FontModifiersIcons';
import { type MessageDescriptor } from 'react-intl';
import { Editor, Text, Transforms } from 'slate';
import { styled, css } from 'styled-components';

const stylesToInherit = css`
  font-size: inherit;
  color: inherit;
  line-height: inherit;
`;

const UppercaseText = styled<TypographyComponent>(Typography).attrs({
  textTransform: 'uppercase',
})`
  ${stylesToInherit}
`;

const SuperscriptText = styled<TypographyComponent>(Typography)`
  vertical-align: super;
  font-size: smaller !important;
  ${stylesToInherit}
`;

const SubscriptText = styled<TypographyComponent>(Typography)`
  vertical-align: sub;
  font-size: smaller !important;
  ${stylesToInherit}
`;

const BoldText = styled<TypographyComponent>(Typography).attrs({
  fontWeight: 'bold',
})`
  ${stylesToInherit}
`;

const ItalicText = styled<TypographyComponent>(Typography)`
  font-style: italic;
  ${stylesToInherit}
`;

const UnderlineText = styled<TypographyComponent>(Typography).attrs({
  textDecoration: 'underline',
})`
  ${stylesToInherit}
`;

const StrikeThroughText = styled<TypographyComponent>(Typography).attrs({
  textDecoration: 'line-through',
})`
  ${stylesToInherit}
`;

const InlineCode = styled.code`
  background-color: ${({ theme }) => theme.colors.neutral150};
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: ${({ theme }) => `0 ${theme.spaces[2]}`};
  font-family:
    'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono', Menlo,
    Consolas, monospace;
  color: inherit;
`;

type ModifierKey = Exclude<keyof Text, 'type' | 'text'>;

type ModifiersStore = {
  [K in ModifierKey]: {
    icon: React.ComponentType;
    isValidEventKey: (event: React.KeyboardEvent<HTMLElement>) => boolean;
    label: MessageDescriptor;
    checkIsActive: (editor: Editor) => boolean;
    handleToggle: (editor: Editor) => void;
    renderLeaf: (children: React.JSX.Element | string) => React.JSX.Element;
  };
};

/**
 * The default handler for checking if a modifier is active
 */
const baseCheckIsActive = (editor: Editor, name: ModifierKey) => {
  const marks = Editor.marks(editor);
  if (!marks) return false;

  return Boolean(marks[name]);
};

/**
 * The default handler for toggling a modifier
 */
const baseHandleToggle = (editor: Editor, name: ModifierKey) => {
  const marks = Editor.marks(editor);

  // If there is no selection, set selection to the end of line
  if (!editor.selection) {
    const endOfEditor = Editor.end(editor, []);
    Transforms.select(editor, endOfEditor);
  }

  // Toggle the modifier
  if (marks?.[name]) {
    Editor.removeMark(editor, name);
  } else {
    Editor.addMark(editor, name, true);
  }
};

const modifiers: ModifiersStore = {
  uppercase: {
    icon: Uppercase,
    isValidEventKey: (event: React.KeyboardEvent<HTMLElement>) =>
      event.key === 'A',
    label: {
      id: 'components.Blocks.modifiers.uppercase',
      defaultMessage: 'Uppercase',
    },
    checkIsActive: (editor: Editor) =>
      baseCheckIsActive(editor, 'uppercase' as never),
    handleToggle: (editor: Editor) =>
      baseHandleToggle(editor, 'uppercase' as never),
    renderLeaf: (children: React.JSX.Element | string) => (
      <UppercaseText>{children}</UppercaseText>
    ),
  },
  superscript: {
    icon: Superscript,
    isValidEventKey: (event: React.KeyboardEvent<HTMLElement>) =>
      event.key === 'A',
    label: {
      id: 'components.Blocks.modifiers.superscript',
      defaultMessage: 'Superscript',
    },
    checkIsActive: (editor: Editor) =>
      baseCheckIsActive(editor, 'superscript' as never),
    handleToggle: (editor: Editor) =>
      baseHandleToggle(editor, 'superscript' as never),
    renderLeaf: (children: React.JSX.Element | string) => (
      <SuperscriptText>{children}</SuperscriptText>
    ),
  },
  subscript: {
    icon: Subsscript,
    isValidEventKey: (event: React.KeyboardEvent<HTMLElement>) =>
      event.key === 'A',
    label: {
      id: 'components.Blocks.modifiers.subscript',
      defaultMessage: 'Subscript',
    },
    checkIsActive: (editor: Editor) =>
      baseCheckIsActive(editor, 'subscript' as never),
    handleToggle: (editor: Editor) =>
      baseHandleToggle(editor, 'subscript' as never),
    renderLeaf: (children: React.JSX.Element | string) => (
      <SubscriptText>{children}</SubscriptText>
    ),
  },
  bold: {
    icon: Bold,
    isValidEventKey: (event: React.KeyboardEvent<HTMLElement>) =>
      event.key === 'b',
    label: { id: 'components.Blocks.modifiers.bold', defaultMessage: 'Bold' },
    checkIsActive: (editor: Editor) =>
      baseCheckIsActive(editor, 'bold' as never),
    handleToggle: (editor: Editor) => baseHandleToggle(editor, 'bold' as never),
    renderLeaf: (children: React.JSX.Element | string) => (
      <BoldText>{children}</BoldText>
    ),
  },
  italic: {
    icon: Italic,
    isValidEventKey: (event: React.KeyboardEvent<HTMLElement>) =>
      event.key === 'i',
    label: {
      id: 'components.Blocks.modifiers.italic',
      defaultMessage: 'Italic',
    },
    checkIsActive: (editor: Editor) =>
      baseCheckIsActive(editor, 'italic' as never),
    handleToggle: (editor: Editor) =>
      baseHandleToggle(editor, 'italic' as never),
    renderLeaf: (children: React.JSX.Element | string) => (
      <ItalicText>{children}</ItalicText>
    ),
  },
  underline: {
    icon: Underline,
    isValidEventKey: (event: React.KeyboardEvent<HTMLElement>) =>
      event.key === 'u',
    label: {
      id: 'components.Blocks.modifiers.underline',
      defaultMessage: 'Underline',
    },
    checkIsActive: (editor: Editor) =>
      baseCheckIsActive(editor, 'underline' as never),
    handleToggle: (editor: Editor) =>
      baseHandleToggle(editor, 'underline' as never),
    renderLeaf: (children: React.JSX.Element | string) => (
      <UnderlineText>{children}</UnderlineText>
    ),
  },
  strikethrough: {
    icon: StrikeThrough,
    isValidEventKey: (event: React.KeyboardEvent<HTMLElement>) =>
      event.key === 'S' && event.shiftKey,
    label: {
      id: 'components.Blocks.modifiers.strikethrough',
      defaultMessage: 'Strikethrough',
    },
    checkIsActive: (editor: Editor) =>
      baseCheckIsActive(editor, 'strikethrough' as never),
    handleToggle: (editor: Editor) =>
      baseHandleToggle(editor, 'strikethrough' as never),
    renderLeaf: (children: React.JSX.Element | string) => (
      <StrikeThroughText>{children}</StrikeThroughText>
    ),
  },
  code: {
    icon: Code,
    isValidEventKey: (event: React.KeyboardEvent<HTMLElement>) =>
      event.key === 'e',
    label: {
      id: 'components.Blocks.modifiers.code',
      defaultMessage: 'Inline code',
    },
    checkIsActive: (editor: Editor) =>
      baseCheckIsActive(editor, 'code' as never),
    handleToggle: (editor: Editor) => baseHandleToggle(editor, 'code' as never),
    renderLeaf: (children: React.JSX.Element | string) => (
      <InlineCode>{children}</InlineCode>
    ),
  },
};

export { type ModifiersStore, modifiers };
