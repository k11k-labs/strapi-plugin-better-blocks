import * as React from 'react';

import { Box, SingleSelect, SingleSelectOption } from '@strapi/design-system';
import { CodeBlock as CodeBlockIcon } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { BaseRange, Element, Editor, Node, NodeEntry, Transforms } from 'slate';
import {
  useSelected,
  type RenderElementProps,
  useFocused,
  ReactEditor,
} from 'slate-react';
import { styled } from 'styled-components';

import { useBlocksEditorContext, type BlocksStore } from '../BlocksEditor';
import { codeLanguages } from '../utils/constants';
import { baseHandleConvert } from '../utils/conversions';
import { pressEnterTwiceToExit } from '../utils/enterKey';
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

type BaseRangeCustom = BaseRange & { className: string };

const isCodeElement = (node: Node): node is CodeElement => {
  return (
    !Editor.isEditor(node) &&
    Element.isElement(node) &&
    'type' in node &&
    node.type === 'code'
  );
};

// Simplified decorateCode without Prism syntax highlighting
export const decorateCode = ([node, path]: NodeEntry) => {
  const ranges: BaseRangeCustom[] = [];
  // No syntax highlighting - just return empty ranges
  return ranges;
};

const CodeBlock = styled.pre`
  border-radius: ${({ theme }) => theme.borderRadius};
  background-color: ${({ theme }) => theme.colors.neutral100};
  max-width: 100%;
  overflow: auto;
  padding: ${({ theme }) => `${theme.spaces[3]} ${theme.spaces[4]}`};
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

const CodeEditor = (props: CodeEditorProps) => {
  const { editor } = useBlocksEditorContext('CodeEditor');
  const editorIsFocused = useFocused();
  const imageIsSelected = useSelected();
  const { formatMessage } = useIntl();
  const [isSelectOpen, setIsSelectOpen] = React.useState(false);
  const shouldDisplayLanguageSelect =
    (editorIsFocused && imageIsSelected) || isSelectOpen;

  return (
    <Box position="relative" width="100%">
      <CodeBlock {...props.attributes}>
        <code>{props.children}</code>
      </CodeBlock>
      {shouldDisplayLanguageSelect && (
        <Box
          position="absolute"
          background="neutral0"
          borderColor="neutral150"
          borderStyle="solid"
          borderWidth="0.5px"
          shadow="tableShadow"
          top="100%"
          marginTop={1}
          right={0}
          padding={1}
          hasRadius
        >
          <SingleSelect
            onChange={(open: string | number) => {
              Transforms.setNodes<CodeElement>(
                editor,
                { language: open.toString() },
                {
                  match: (node): node is CodeElement => isCodeElement(node),
                }
              );
            }}
            value={
              (isCodeElement(props.element) && props.element.language) ||
              'plaintext'
            }
            onOpenChange={(open: boolean) => {
              setIsSelectOpen(open);

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
        </Box>
      )}
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
