import * as React from 'react';
import {
  Paragraph,
  HeadingOne,
  HeadingTwo,
  HeadingThree,
  BulletList,
  NumberList,
  Quotes,
  Code,
  Image,
  Check,
  Minus,
  GridNine,
} from '@strapi/icons';
import { Editor, Range, Transforms } from 'slate';
import { ReactEditor, useSlate } from 'slate-react';
import { styled } from 'styled-components';

import { useBlocksEditorContext } from './BlocksEditor';
import { insertHorizontalLine } from './Blocks/HorizontalLine';
import { insertTable } from './Blocks/Table';

interface SlashCommand {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  action: (editor: Editor) => void;
}

const COMMANDS: SlashCommand[] = [
  {
    id: 'paragraph',
    label: 'Text',
    icon: Paragraph,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'paragraph' } as any);
    },
  },
  {
    id: 'heading-1',
    label: 'Heading 1',
    icon: HeadingOne,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'heading', level: 1 } as any);
    },
  },
  {
    id: 'heading-2',
    label: 'Heading 2',
    icon: HeadingTwo,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'heading', level: 2 } as any);
    },
  },
  {
    id: 'heading-3',
    label: 'Heading 3',
    icon: HeadingThree,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'heading', level: 3 } as any);
    },
  },
  {
    id: 'bulleted-list',
    label: 'Bulleted list',
    icon: BulletList,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'list-item' } as any);
      Transforms.wrapNodes(editor, {
        type: 'list',
        format: 'unordered',
        children: [],
      } as any);
    },
  },
  {
    id: 'numbered-list',
    label: 'Numbered list',
    icon: NumberList,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'list-item' } as any);
      Transforms.wrapNodes(editor, {
        type: 'list',
        format: 'ordered',
        children: [],
      } as any);
    },
  },
  {
    id: 'todo-list',
    label: 'To-do list',
    icon: Check,
    action: (editor) => {
      Transforms.setNodes(editor, {
        type: 'list-item',
        checked: false,
      } as any);
      Transforms.wrapNodes(editor, {
        type: 'list',
        format: 'todo',
        children: [],
      } as any);
    },
  },
  {
    id: 'quote',
    label: 'Quote',
    icon: Quotes,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'quote' } as any);
    },
  },
  {
    id: 'code',
    label: 'Code block',
    icon: Code,
    action: (editor) => {
      Transforms.setNodes(editor, { type: 'code' } as any);
    },
  },
  {
    id: 'horizontal-line',
    label: 'Horizontal line',
    icon: Minus,
    action: (editor) => {
      insertHorizontalLine(editor);
    },
  },
  {
    id: 'table',
    label: 'Table',
    icon: GridNine,
    action: (editor) => {
      insertTable(editor);
    },
  },
];

/* ---------------------------------------------------------------------------
 * Styled components
 * -------------------------------------------------------------------------*/

const MenuWrapper = styled.div`
  position: absolute;
  z-index: 10;
  background: ${({ theme }) => theme.colors.neutral0};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: ${({ theme }) => theme.shadows.filterShadow};
  max-height: 260px;
  overflow-y: auto;
  width: 220px;
  padding: 4px;
`;

const MenuItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary100 : 'transparent'};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary600 : theme.colors.neutral800};

  &:hover {
    background: ${({ theme }) => theme.colors.primary100};
    color: ${({ theme }) => theme.colors.primary600};
  }

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
`;

/* ---------------------------------------------------------------------------
 * Component
 * -------------------------------------------------------------------------*/

const SlashCommandMenu = () => {
  const editor = useSlate();
  const { blocks } = useBlocksEditorContext('SlashCommandMenu');
  const [show, setShow] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const menuRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(
    () =>
      search
        ? COMMANDS.filter((c) =>
            c.label.toLowerCase().includes(search.toLowerCase())
          )
        : COMMANDS,
    [search]
  );

  // Detect "/" at start of empty block
  React.useEffect(() => {
    const { selection } = editor;
    if (!selection || !Range.isCollapsed(selection)) {
      setShow(false);
      return;
    }

    const [node] = Editor.parent(editor, selection.anchor);
    const text =
      node.children?.length === 1 && 'text' in node.children[0]
        ? (node.children[0] as any).text
        : '';

    if (text.startsWith('/')) {
      setSearch(text.slice(1));
      setShow(true);
      setActiveIndex(0);

      // Position the menu
      try {
        const domRange = ReactEditor.toDOMRange(
          editor as ReactEditor,
          selection
        );
        const rect = domRange.getBoundingClientRect();
        const editorEl = ReactEditor.toDOMNode(editor as ReactEditor, editor);
        const editorRect = editorEl.getBoundingClientRect();
        setPosition({
          top: rect.bottom - editorRect.top + 4,
          left: rect.left - editorRect.left,
        });
      } catch {
        // DOM range might be invalid
      }
    } else {
      setShow(false);
    }
  }, [editor.selection, editor.children]);

  const executeCommand = React.useCallback(
    (command: SlashCommand) => {
      // Delete the "/" text first
      const { selection } = editor;
      if (selection) {
        const [, parentPath] = Editor.parent(editor, selection.anchor);
        const start = Editor.start(editor, parentPath);
        Transforms.select(editor, {
          anchor: start,
          focus: selection.anchor,
        });
        Transforms.delete(editor);
      }
      command.action(editor);
      setShow(false);
      ReactEditor.focus(editor as ReactEditor);
    },
    [editor]
  );

  React.useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIndex]) {
          executeCommand(filtered[activeIndex]);
        }
      } else if (e.key === 'Escape') {
        setShow(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show, filtered, activeIndex, executeCommand]);

  if (!show || filtered.length === 0) return null;

  return (
    <MenuWrapper
      ref={menuRef}
      contentEditable={false}
      style={{ top: position.top, left: position.left }}
    >
      {filtered.map((cmd, i) => {
        const Icon = cmd.icon;
        return (
          <MenuItem
            key={cmd.id}
            $active={i === activeIndex}
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand(cmd);
            }}
            onMouseEnter={() => setActiveIndex(i)}
          >
            <Icon />
            {cmd.label}
          </MenuItem>
        );
      })}
    </MenuWrapper>
  );
};

export { SlashCommandMenu };
