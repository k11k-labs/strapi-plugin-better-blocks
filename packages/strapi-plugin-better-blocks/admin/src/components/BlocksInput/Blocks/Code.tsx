import * as React from 'react';

import { Box, SingleSelect, SingleSelectOption } from '@strapi/design-system';
import { CodeBlock as CodeBlockIcon } from '@strapi/icons';
import { useIntl } from 'react-intl';
import {
  BaseRange,
  Element,
  Editor,
  Node,
  NodeEntry,
  Text,
  Transforms,
} from 'slate';
import { type RenderElementProps, ReactEditor } from 'slate-react';
import { styled } from 'styled-components';

import { useBlocksEditorContext, type BlocksStore } from '../BlocksEditor';
import { codeLanguages } from '../utils/constants';
import { baseHandleConvert } from '../utils/conversions';
import { pressEnterTwiceToExit } from '../utils/enterKey';
import {
  DARK_THEME,
  LIGHT_THEME,
  ensureLanguage,
  getShiki,
  normalizeLang,
  tokenizeCode,
} from '../utils/shiki';
import { CustomElement, CustomText, type Block } from '../utils/types';

// Add custom type definitions
interface CodeElement extends CustomElement {
  type: 'code';
  language?: string;
  children: CustomText[];
}

interface CodeEditorProps extends RenderElementProps {
  element: CodeElement;
}

type BaseRangeCustom = BaseRange & { color: string };

const isCodeElement = (node: Node): node is CodeElement => {
  return (
    !Editor.isEditor(node) &&
    Element.isElement(node) &&
    'type' in node &&
    node.type === 'code'
  );
};

/**
 * Syntax highlighting via Shiki.
 *
 * Returns a factory so the editor can pass in its current `editor` (to resolve
 * the parent code element + language) and `isDark` (to pick the matching Shiki
 * theme). Decoration runs on the code block's text node, mapping each Shiki
 * token to a Slate range carrying a `color`, which `renderLeaf` turns into an
 * inline style. Shiki loads asynchronously: until it (and the requested
 * grammar) are ready, this returns no ranges and a subscriber re-decorates.
 */
export const decorateCode =
  (editor: Editor, isDark: boolean) =>
  ([node, path]: NodeEntry): BaseRangeCustom[] => {
    const ranges: BaseRangeCustom[] = [];

    if (!Text.isText(node) || path.length === 0) {
      return ranges;
    }

    let parent: Node;
    try {
      parent = Node.parent(editor, path);
    } catch {
      return ranges;
    }
    if (!isCodeElement(parent)) {
      return ranges;
    }

    const lang = normalizeLang(parent.language);
    if (!lang) {
      return ranges;
    }

    if (!getShiki() || !ensureLanguage(lang)) {
      return ranges;
    }

    const theme = isDark ? DARK_THEME : LIGHT_THEME;
    const result = tokenizeCode(node.text, lang, theme);
    if (!result) {
      return ranges;
    }

    for (const line of result.tokens) {
      for (const token of line) {
        if (!token.color || token.content.length === 0) {
          continue;
        }
        ranges.push({
          anchor: { path, offset: token.offset },
          focus: { path, offset: token.offset + token.content.length },
          color: token.color,
        });
      }
    }

    return ranges;
  };

const CodeBlock = styled.pre`
  border-radius: ${({ theme }) => theme.borderRadius};
  background-color: ${({ theme }) => theme.colors.neutral150};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  max-width: 100%;
  overflow: auto;
  /* Extra top padding leaves room for the language pill in the top-right. */
  padding: ${({ theme }) =>
    `${theme.spaces[6]} ${theme.spaces[4]} ${theme.spaces[3]}`};
  flex-shrink: 1;

  & > code {
    font-family:
      'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono', Menlo,
      Consolas, monospace;
    color: ${({ theme }) => theme.colors.neutral800};
    overflow: auto;
    max-width: 100%;
  }
`;

const LanguagePill = styled(Box)`
  position: absolute;
  top: ${({ theme }) => theme.spaces[1]};
  right: ${({ theme }) => theme.spaces[1]};
  z-index: 1;

  /* Shrink the inner select so it reads as a compact, colored badge. */
  button {
    background: ${({ theme }) => theme.colors.primary100};
    border-color: ${({ theme }) => theme.colors.primary200};
    color: ${({ theme }) => theme.colors.primary600};
  }

  span,
  svg {
    color: ${({ theme }) => theme.colors.primary600};
  }
`;

const CodeEditor = (props: CodeEditorProps) => {
  const { editor } = useBlocksEditorContext('CodeEditor');
  const { formatMessage } = useIntl();

  return (
    <Box position="relative" width="100%">
      <CodeBlock {...props.attributes}>
        <code>{props.children}</code>
      </CodeBlock>
      {/* Always-visible, colored language selector in the top-right corner. */}
      <LanguagePill contentEditable={false} hasRadius>
        <SingleSelect
          size="S"
          onChange={(open: string | number) => {
            // Target this block by path: the pill lives in a
            // contentEditable={false} container, so the editor may have no
            // selection to fall back on.
            const path = ReactEditor.findPath(
              editor as ReactEditor,
              props.element
            );
            Transforms.setNodes<CodeElement>(
              editor,
              { language: open.toString() },
              {
                at: path,
                match: (node): node is CodeElement => isCodeElement(node),
              }
            );
          }}
          value={
            (isCodeElement(props.element) && props.element.language) ||
            'plaintext'
          }
          onOpenChange={(open: boolean) => {
            // Focus the editor again when closing the select so the user can continue typing
            if (!open) {
              ReactEditor.focus(editor as ReactEditor);
            }
          }}
          onCloseAutoFocus={(e: Event) => e.preventDefault()}
          aria-label={formatMessage({
            id: 'components.Blocks.blocks.code.languageLabel',
            defaultMessage: 'Select a language',
          })}
        >
          {codeLanguages.map(({ value, label }) => (
            <SingleSelectOption value={value} key={value}>
              {label}
            </SingleSelectOption>
          ))}
        </SingleSelect>
      </LanguagePill>
    </Box>
  );
};

const codeBlocks: Pick<BlocksStore, 'code'> = {
  code: {
    renderElement: (props: RenderElementProps) => (
      <CodeEditor {...(props as CodeEditorProps)} />
    ),
    icon: CodeBlockIcon,
    label: {
      id: 'components.Blocks.blocks.code',
      defaultMessage: 'Code block',
    },
    // Update the matchNode function to accept Node type
    matchNode: (node: Node): node is CodeElement => {
      return (
        !Editor.isEditor(node) &&
        Element.isElement(node) &&
        'type' in node &&
        node.type === 'code'
      );
    },
    isInBlocksSelector: true,
    handleConvert(editor) {
      baseHandleConvert<CodeElement>(editor, {
        type: 'code',
        language: 'plaintext',
        children: [{ type: 'text', text: '' } as CustomText],
      });
    },
    handleEnterKey(editor) {
      pressEnterTwiceToExit(editor);
    },
    snippets: ['```'],
  },
};

export { codeBlocks };
