import * as React from 'react';

import { Typography } from '@strapi/design-system';
import { BulletList, Check, NumberList } from '@strapi/icons';
import { type Text, Editor, Node, Transforms, Path } from 'slate';
import {
  type RenderElementProps,
  ReactEditor,
  useSlateStatic,
} from 'slate-react';
import { styled, type CSSProperties, css } from 'styled-components';

import { type BlocksStore } from '../BlocksEditor';
import { baseHandleConvert } from '../utils/conversions';
import {
  CustomElement,
  isListNode,
  ListNode,
  type Block,
} from '../utils/types';

const listStyle = css`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spaces[2]};
  margin-inline-start: ${({ theme }) => theme.spaces[0]};
  margin-inline-end: ${({ theme }) => theme.spaces[0]};
  padding-inline-start: ${({ theme }) => theme.spaces[2]};

  ol,
  ul {
    margin-block-start: ${({ theme }) => theme.spaces[0]};
    margin-block-end: ${({ theme }) => theme.spaces[0]};
  }

  li {
    margin-inline-start: ${({ theme }) => theme.spaces[3]};
  }
`;

const Orderedlist = styled.ol<{
  $listStyleType: CSSProperties['listStyleType'];
}>`
  list-style-type: ${(props) => props.$listStyleType};
  ${listStyle}
`;

const Unorderedlist = styled.ul<{
  $listStyleType: CSSProperties['listStyleType'];
}>`
  list-style-type: ${(props) => props.$listStyleType};
  ${listStyle}
`;

const orderedStyles = ['decimal', 'lower-alpha', 'upper-roman'];
const unorderedStyles = ['disc', 'circle', 'square'];

const List = ({ attributes, children, element }: RenderElementProps) => {
  if (!isListNode(element as unknown as CustomElement)) {
    return null;
  }

  // Decide the subsequent style by referencing the given styles according to the format,
  // allowing for infinite nested lists
  const listNode = element as ListNode;
  const listStyles =
    listNode.format === 'ordered' ? orderedStyles : unorderedStyles;
  const nextIndex = (listNode.indentLevel || 0) % listStyles!.length;
  const listStyleType = listStyles![nextIndex];

  if (listNode.format === 'ordered') {
    return (
      <Orderedlist $listStyleType={listStyleType} {...attributes}>
        {children}
      </Orderedlist>
    );
  }

  if (listNode.format === 'todo') {
    return <TodoListWrapper {...attributes}>{children}</TodoListWrapper>;
  }

  return (
    <Unorderedlist $listStyleType={listStyleType} {...attributes}>
      {children}
    </Unorderedlist>
  );
};

const TodoListWrapper = styled.ul`
  list-style-type: none;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spaces[2]};
  margin-inline-start: ${({ theme }) => theme.spaces[0]};
  margin-inline-end: ${({ theme }) => theme.spaces[0]};
  padding-inline-start: ${({ theme }) => theme.spaces[2]};
`;

const TodoItemLi = styled.li<{ $checked: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spaces[2]};
  list-style: none;
  margin-inline-start: 0;

  & > span:last-child {
    flex: 1;
    text-decoration: ${({ $checked }) => ($checked ? 'line-through' : 'none')};
    opacity: ${({ $checked }) => ($checked ? 0.6 : 1)};
  }
`;

const TodoCheckbox = styled.input.attrs({ type: 'checkbox' })`
  margin-top: 4px;
  cursor: pointer;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
`;

const TodoListItem = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const checked = Boolean((element as any).checked);
  const editor = useSlateStatic();

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const path = ReactEditor.findPath(
      editor as unknown as ReactEditor,
      element
    );
    Transforms.setNodes(editor, { checked: e.target.checked } as any, {
      at: path,
    });
  };

  return (
    <TodoItemLi {...attributes} $checked={checked}>
      <span contentEditable={false}>
        <TodoCheckbox checked={checked} onChange={handleToggle} />
      </span>
      <span>{children}</span>
    </TodoItemLi>
  );
};

const replaceListWithEmptyBlock = (editor: Editor, currentListPath: Path) => {
  // Delete the empty list
  Transforms.removeNodes(editor, { at: currentListPath });

  if (currentListPath[0] === 0) {
    // If the list was the only (or first) block element then insert empty paragraph as editor needs default value
    Transforms.insertNodes(
      editor,
      {
        type: 'paragraph',
        children: [{ type: 'text', text: '' }],
      } as Block<'paragraph'>,
      { at: currentListPath }
    );
    Transforms.select(editor, currentListPath);
  }
};

const isText = (node: unknown): node is Text => {
  return (
    Node.isNode(node) &&
    !Editor.isEditor(node) &&
    'type' in node &&
    node.type === 'text'
  );
};

/**
 * Common handler for the backspace event on ordered and unordered lists
 */
const handleBackspaceKeyOnList = (
  editor: Editor,
  event: React.KeyboardEvent<HTMLElement>
) => {
  if (!editor.selection) return;

  const [currentListItem, currentListItemPath] = Editor.parent(
    editor,
    editor.selection.anchor
  );
  const [currentList, currentListPath] = Editor.parent(
    editor,
    currentListItemPath
  );
  const isListEmpty =
    currentList.children.length === 1 &&
    isText(currentListItem.children[0]) &&
    currentListItem.children[0].text === '';
  const isListItemEmpty =
    currentListItem.children.length === 1 &&
    isText(currentListItem.children[0]) &&
    currentListItem.children[0].text === '';
  const isFocusAtTheBeginningOfAChild =
    editor.selection.focus.offset === 0 &&
    editor.selection.focus.path.at(-2) === 0;

  if (isListEmpty) {
    const parentListEntry = Editor.above(editor, {
      at: currentListPath,
      match: (node) =>
        !Editor.isEditor(node) && 'type' in node && node.type === 'list',
    });
    if (!parentListEntry) {
      event.preventDefault();
      replaceListWithEmptyBlock(editor, currentListPath);
    }
  } else if (isFocusAtTheBeginningOfAChild) {
    // If the focus is at the beginning of a child node we need to replace it with a paragraph
    Transforms.liftNodes(editor, {
      match: (node) =>
        !Editor.isEditor(node) && 'type' in node && node.type === 'list-item',
    });
    Transforms.setNodes(editor, { type: 'paragraph' } as Block<'paragraph'>);
  } else if (isListItemEmpty) {
    const previousEntry = Editor.previous(editor, {
      at: currentListItemPath,
    });
    const nextEntry = Editor.next(editor, {
      at: currentListItemPath,
    });

    if (previousEntry && nextEntry) {
      // If previous and next nodes are lists or list-items, delete empty list item
      event.preventDefault();
      Transforms.removeNodes(editor, {
        at: currentListItemPath,
      });

      // If previous and next nodes are lists with same format and indent Levels, then merge the nodes
      const [previousList] = previousEntry;
      const [nextList] = nextEntry;
      if (
        !Editor.isEditor(previousList) &&
        !isText(previousList) &&
        isListNode(previousList as CustomElement) &&
        !Editor.isEditor(nextList) &&
        !isText(nextList) &&
        isListNode(nextList as CustomElement)
      ) {
        if (
          (previousList as ListNode).type === 'list' &&
          (nextList as ListNode).type === 'list' &&
          (previousList as ListNode).format === (nextList as ListNode).format &&
          (previousList as ListNode).indentLevel ===
            (nextList as ListNode).indentLevel
        ) {
          Transforms.mergeNodes(editor, {
            at: currentListItemPath,
          });
        }
      }
    }
  }
};

/**
 * Common handler for the enter key on ordered and unordered lists
 */
const handleEnterKeyOnList = (editor: Editor) => {
  const currentListItemEntry = Editor.above(editor, {
    match: (node) =>
      !Editor.isEditor(node) && 'type' in node && node.type === 'list-item',
  });

  if (!currentListItemEntry || !editor.selection) {
    return;
  }

  const [currentListItem, currentListItemPath] = currentListItemEntry;
  const [currentList, currentListPath] = Editor.parent(
    editor,
    currentListItemPath
  );

  // Check if parent list is a todo list — new items need `checked: false`
  const isTodoList =
    !Editor.isEditor(currentList) &&
    'type' in currentList &&
    currentList.type === 'list' &&
    (currentList as any).format === 'todo';
  const newListItemAttrs: any = { type: 'list-item' };
  if (isTodoList) {
    newListItemAttrs.checked = false;
  }
  const isListEmpty =
    currentList.children.length === 1 &&
    isText(currentListItem.children[0]) &&
    currentListItem.children[0].text === '';
  const isListItemEmpty =
    currentListItem.children.length === 1 &&
    isText(currentListItem.children[0]) &&
    currentListItem.children[0].text === '';
  const isFocusAtTheBeginningOfAChild =
    editor.selection.focus.offset === 0 &&
    editor.selection.focus.path.at(-1) === 0;

  if (isListEmpty) {
    replaceListWithEmptyBlock(editor, currentListPath);
  } else if (isFocusAtTheBeginningOfAChild && !isListItemEmpty) {
    // If the focus is at the beginning of a child node, shift below the list item and create a new list-item
    const currentNode = Editor.above(editor, { at: editor.selection.anchor });
    Transforms.insertNodes(editor, {
      ...newListItemAttrs,
      children: [{ type: 'text', text: '' }],
    } as Block<'list-item'>);
    if (currentNode) {
      const path = currentNode[1];
      const updatedPath = [...path.slice(0, -1), path[path.length - 1] + 1];
      Transforms.select(editor, {
        anchor: { path: updatedPath.concat(0), offset: 0 },
        focus: { path: updatedPath.concat(0), offset: 0 },
      });
    }
  } else if (isListItemEmpty) {
    // Check if there is a list above the current list and shift list-item under it
    if (
      !Editor.isEditor(currentList) &&
      isListNode(currentList as CustomElement) &&
      (currentList as ListNode)?.indentLevel !== undefined &&
      (currentList as ListNode).indentLevel > 0
    ) {
      const previousIndentLevel = (currentList as ListNode).indentLevel - 1;

      const parentListNodeEntry = Editor.above(editor, {
        match: (node) =>
          !Editor.isEditor(node) &&
          'type' in node &&
          node.type === 'list' &&
          (node as ListNode).indentLevel === previousIndentLevel,
      });

      if (parentListNodeEntry) {
        // Get the parent list path and add 1 to it to exit from the current list
        const modifiedPath = currentListItemPath.slice(0, -1);
        if (modifiedPath.length > 0) {
          modifiedPath[modifiedPath.length - 1] += 1;
        }

        // Shift list-item under parent list
        Transforms.moveNodes(editor, {
          at: currentListItemPath,
          to: modifiedPath,
        });
        return;
      }
    }

    // Otherwise delete the empty list item and create a new paragraph below the parent list
    Transforms.removeNodes(editor, { at: currentListItemPath });

    const createdParagraphPath = Path.next(currentListPath);
    Transforms.insertNodes(
      editor,
      {
        type: 'paragraph',
        children: [{ type: 'text', text: '' }],
      } as Block<'paragraph'>,
      { at: createdParagraphPath }
    );

    // Move the selection to the newly created paragraph
    Transforms.select(editor, createdParagraphPath);
  } else {
    // Check if the cursor is at the end of the list item
    const isNodeEnd = Editor.isEnd(
      editor,
      editor.selection.anchor,
      currentListItemPath
    );

    if (isNodeEnd) {
      // If there was nothing after the cursor, create a fresh new list item,
      // in order to avoid carrying over the modifiers from the previous list item
      Transforms.insertNodes(editor, {
        ...newListItemAttrs,
        children: [{ type: 'text', text: '' }],
      } as Block<'list-item'>);
    } else {
      // If there is something after the cursor, split the current list item,
      // so that we keep the content and the modifiers
      Transforms.splitNodes(editor);
      // For todo lists, reset the new (split) item to unchecked
      if (isTodoList) {
        Transforms.setNodes(editor, { checked: false } as any, {
          match: (n) =>
            !Editor.isEditor(n) && 'type' in n && n.type === 'list-item',
        });
      }
    }
  }
};

/**
 * Common handler for converting a node to a list
 */
const handleConvertToList = (
  editor: Editor,
  format: Block<'list'>['format']
) => {
  const listItemAttrs: any = { type: 'list-item' };
  if (format === 'todo') {
    listItemAttrs.checked = false;
  }

  const convertedPath = baseHandleConvert<Block<'list-item'>>(
    editor,
    listItemAttrs as Block<'list-item'>
  );

  if (!convertedPath) return;

  Transforms.wrapNodes(
    editor,
    { type: 'list', format, children: [] } as Block<'list'>,
    { at: convertedPath }
  );
};

/**
 * Handler for Shift+Tab: outdent/un-nest a list item to the parent list level
 */
const handleShiftTabOnList = (editor: Editor) => {
  const currentListItemEntry = Editor.above(editor, {
    match: (node) =>
      !Editor.isEditor(node) && 'type' in node && node.type === 'list-item',
  });

  if (!currentListItemEntry || !editor.selection) {
    return;
  }

  const [, currentListItemPath] = currentListItemEntry;
  const [currentList, currentListPath] = Editor.parent(
    editor,
    currentListItemPath
  );

  if (
    !Editor.isEditor(currentList) &&
    isListNode(currentList as CustomElement)
  ) {
    // Check if there's a parent list above the current list (i.e. we're nested)
    const parentListEntry = Editor.above(editor, {
      at: currentListPath,
      match: (node) =>
        !Editor.isEditor(node) && 'type' in node && node.type === 'list',
    });

    if (parentListEntry) {
      // We're in a nested list: move the list-item out to the parent list
      const targetPath = Path.next(currentListPath);

      Transforms.moveNodes(editor, {
        at: currentListItemPath,
        to: targetPath,
      });

      // If the nested list is now empty, remove it
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
    } else {
      // At top level: lift list-item out of list and convert to paragraph
      Transforms.liftNodes(editor, {
        at: currentListItemPath,
      });
      Transforms.setNodes(editor, { type: 'paragraph' } as Block<'paragraph'>, {
        at: [currentListItemPath[0]],
      });
    }
  }
};

/**
 * Common handler for the tab key on ordered and unordered lists
 */
const handleTabOnList = (
  editor: Editor,
  event: React.KeyboardEvent<HTMLElement>
) => {
  if (event.shiftKey) {
    handleShiftTabOnList(editor);
    return;
  }

  const currentListItemEntry = Editor.above(editor, {
    match: (node) =>
      !Editor.isEditor(node) && 'type' in node && node.type === 'list-item',
  });

  if (!currentListItemEntry || !editor.selection) {
    return;
  }

  const [currentListItem, currentListItemPath] = currentListItemEntry;
  const [currentList] = Editor.parent(editor, currentListItemPath);

  // Skip tabbing if list-item is the first item in the list
  if (currentListItem === currentList.children[0]) return;

  const currentListItemIndex = currentList.children.findIndex(
    (item) => item === currentListItem
  );
  const previousNode = currentList.children[currentListItemIndex - 1];

  // If previous node is a list block then move the list-item under it
  if ((previousNode as ListNode).type === 'list') {
    const nodePath = ReactEditor.findPath(editor as ReactEditor, previousNode);
    const insertAtPath = (previousNode as ListNode).children.length;

    Transforms.moveNodes(editor, {
      at: currentListItemPath,
      to: nodePath.concat(insertAtPath),
    });
    return;
  }

  if (
    !Editor.isEditor(currentList) &&
    isListNode(currentList as Block<'paragraph'>)
  ) {
    // Wrap list-item with list block on tab
    Transforms.wrapNodes(editor, {
      type: 'list',
      format: (currentList as ListNode).format,
      indentLevel: (currentList as ListNode).indentLevel + 1,
      children: [],
    } as Block<'list'>);
  }
};

const listBlocks: Pick<
  BlocksStore,
  'list-ordered' | 'list-unordered' | 'list-todo' | 'list-item'
> = {
  'list-ordered': {
    renderElement: (props) => <List {...props} />,
    label: {
      id: 'components.Blocks.blocks.orderedList',
      defaultMessage: 'Numbered list',
    },
    icon: NumberList,
    matchNode: (node) => node.type === 'list' && node.format === 'ordered',
    isInBlocksSelector: true,
    handleConvert: (editor) => handleConvertToList(editor, 'ordered' as never),
    handleEnterKey: handleEnterKeyOnList,
    handleBackspaceKey: handleBackspaceKeyOnList,
    handleTab: handleTabOnList,
    snippets: ['1.'],
  },
  'list-unordered': {
    renderElement: (props) => <List {...props} />,
    label: {
      id: 'components.Blocks.blocks.unorderedList',
      defaultMessage: 'Bulleted list',
    },
    icon: BulletList,
    matchNode: (node) => node.type === 'list' && node.format === 'unordered',
    isInBlocksSelector: true,
    handleConvert: (editor) =>
      handleConvertToList(editor, 'unordered' as never),
    handleEnterKey: handleEnterKeyOnList,
    handleBackspaceKey: handleBackspaceKeyOnList,
    handleTab: handleTabOnList,
    snippets: ['-', '*', '+'],
  },
  'list-todo': {
    renderElement: (props) => <List {...props} />,
    label: {
      id: 'components.Blocks.blocks.todoList',
      defaultMessage: 'To-do list',
    },
    icon: Check,
    matchNode: (node) =>
      node.type === 'list' && (node as any).format === 'todo',
    isInBlocksSelector: true,
    handleConvert: (editor) => handleConvertToList(editor, 'todo' as never),
    handleEnterKey: handleEnterKeyOnList,
    handleBackspaceKey: handleBackspaceKeyOnList,
    handleTab: handleTabOnList,
    snippets: ['[]', '[x]'],
  },
  'list-item': {
    renderElement: (props) => {
      const element = props.element as any;
      // If the element has a 'checked' property, render as a todo item
      if (typeof element.checked === 'boolean') {
        return <TodoListItem {...props} />;
      }
      return (
        <Typography tag="li" {...props.attributes}>
          {props.children}
        </Typography>
      );
    },
    // No handleConvert, list items are created when converting to the parent list
    matchNode: (node) => node.type === 'list-item',
    isInBlocksSelector: false,
    dragHandleTopMargin: '-2px',
  },
};

export { listBlocks };
