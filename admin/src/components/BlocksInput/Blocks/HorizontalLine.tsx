import * as React from 'react';
import { Minus } from '@strapi/icons';
import { Editor, Transforms } from 'slate';
import { styled } from 'styled-components';

import { type BlocksStore } from '../BlocksEditor';
import { CustomElement } from '../utils/types';

const withHorizontalLine = (editor: Editor): Editor => {
  const { isVoid } = editor;
  editor.isVoid = (element) => {
    return (element as unknown as { type: string }).type === 'horizontal-line'
      ? true
      : isVoid(element);
  };
  return editor;
};

const StyledHr = styled.div`
  width: 100%;
  padding: ${({ theme }) => theme.spaces[2]} 0;
  cursor: pointer;
  user-select: none;

  hr {
    border: none;
    border-top: 2px solid ${({ theme }) => theme.colors.neutral200};
    margin: 0;
  }

  &[data-selected='true'] hr {
    border-top-color: ${({ theme }) => theme.colors.primary600};
  }
`;

/**
 * Insert a horizontal line block after the current selection,
 * followed by an empty paragraph so the user can keep typing.
 */
const insertHorizontalLine = (editor: Editor) => {
  const hr = {
    type: 'horizontal-line',
    children: [{ type: 'text', text: '' }],
  };
  const paragraph = {
    type: 'paragraph',
    children: [{ type: 'text', text: '' }],
  };

  Transforms.insertNodes(editor, [hr as any, paragraph as any]);
};

const horizontalLineBlocks: Pick<BlocksStore, 'horizontal-line'> = {
  'horizontal-line': {
    renderElement: (props) => {
      return (
        <div {...props.attributes} contentEditable={false}>
          <StyledHr data-selected={false}>
            <hr />
          </StyledHr>
          {/* Slate requires at least one text child for void elements */}
          <span style={{ display: 'none' }}>{props.children}</span>
        </div>
      );
    },
    matchNode: (node) => (node as any).type === 'horizontal-line',
    isInBlocksSelector: false,
  },
};

export { horizontalLineBlocks, withHorizontalLine, insertHorizontalLine };
