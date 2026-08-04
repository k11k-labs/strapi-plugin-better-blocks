import type {
  Blockquote,
  Break,
  Code,
  Definition,
  Delete,
  Emphasis,
  FootnoteDefinition,
  Heading,
  Html,
  Image,
  ImageReference,
  InlineCode,
  Link,
  LinkReference,
  List,
  ListItem,
  Paragraph,
  RootContent,
  Strong,
  Table,
  Text,
  ThematicBreak,
} from 'mdast';
import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { remarkToSlate } from 'remark-slate-transformer';
import type { Descendant } from 'slate';

import type { CustomElement, CustomText, TableCellAlign } from './types';

type InlineNode =
  | Text
  | Emphasis
  | Strong
  | Delete
  | InlineCode
  | Link
  | LinkReference
  | Image
  | ImageReference
  | Html
  | Break;

type BlockNode =
  | Paragraph
  | Heading
  | Blockquote
  | Code
  | List
  | Table
  | ThematicBreak
  | FootnoteDefinition
  | Definition
  | Html;

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkToSlate);

const text = (
  value: string,
  marks: Partial<Omit<CustomText, 'type' | 'text'>> = {}
): CustomText => ({
  type: 'text',
  text: value,
  ...marks,
});

const paragraph = (children: Descendant[] = [text('')]): CustomElement => ({
  type: 'paragraph',
  children: ensureInlineChildren(children),
});

const ensureInlineChildren = (children: Descendant[]): Descendant[] => {
  return children.length > 0 ? children : [text('')];
};

const plainTextFromInline = (nodes: readonly InlineNode[]): string => {
  return nodes
    .map((node) => {
      if ('value' in node && typeof node.value === 'string') return node.value;
      if ('alt' in node && typeof node.alt === 'string') return node.alt;
      if ('children' in node)
        return plainTextFromInline(node.children as InlineNode[]);
      return '';
    })
    .join('');
};

const normalizeUrl = (url: string): string => {
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(url)) {
    return `mailto:${url}`;
  }

  return url;
};

const mapInlineChildren = (
  children: readonly InlineNode[] = [],
  marks: Partial<Omit<CustomText, 'type' | 'text'>> = {}
): Descendant[] => {
  return children.flatMap((node) => mapInlineNode(node, marks));
};

const mapInlineNode = (
  node: InlineNode,
  marks: Partial<Omit<CustomText, 'type' | 'text'>>
): Descendant[] => {
  switch (node.type) {
    case 'text':
      return [text(node.value, marks)];
    case 'emphasis':
      return mapInlineChildren(
        node.children as InlineNode[],
        {
          ...marks,
          italic: true,
        } as never
      );
    case 'strong':
      return mapInlineChildren(
        node.children as InlineNode[],
        {
          ...marks,
          bold: true,
        } as never
      );
    case 'delete':
      return mapInlineChildren(
        node.children as InlineNode[],
        {
          ...marks,
          strikethrough: true,
        } as never
      );
    case 'inlineCode':
      return [text(node.value, { ...marks, code: true } as never)];
    case 'link':
      return [
        {
          type: 'link',
          url: normalizeUrl(node.url),
          children: ensureInlineChildren(
            mapInlineChildren(node.children as InlineNode[], marks)
          ),
        } as CustomElement,
      ];
    case 'linkReference':
      return mapInlineChildren(node.children as InlineNode[], marks);
    case 'image': {
      const label = node.alt || node.url;
      return [
        {
          type: 'link',
          url: node.url,
          children: [text(label, marks)],
        } as CustomElement,
      ];
    }
    case 'imageReference':
      return [text(node.alt || '', marks)];
    case 'break':
      return [text('\n', marks)];
    case 'html':
      return [text(node.value, marks)];
    default:
      return [];
  }
};

const mapBlockquote = (node: Blockquote, depth: number): CustomElement => ({
  type: 'quote',
  children: ensureInlineChildren(
    node.children.flatMap((child) => {
      if (child.type === 'paragraph') {
        return mapInlineChildren(child.children as InlineNode[]);
      }

      return [text(blockToPlainText(child as BlockNode))];
    })
  ),
});

const mapList = (node: List, depth: number): CustomElement => {
  const isTodo = node.children.some(
    (item) => typeof item.checked === 'boolean'
  );

  return {
    type: 'list',
    format: isTodo ? 'todo' : node.ordered ? 'ordered' : 'unordered',
    indentLevel: depth,
    children: node.children.map((item) => mapListItem(item, depth)),
  };
};

const mapListItem = (node: ListItem, depth: number): CustomElement => {
  const children: Descendant[] = [];

  node.children.forEach((child) => {
    if (child.type === 'paragraph') {
      children.push(...mapInlineChildren(child.children as InlineNode[]));
      return;
    }

    if (child.type === 'list') {
      children.push(mapList(child, depth + 1));
      return;
    }

    children.push(text(blockToPlainText(child as BlockNode)));
  });

  return {
    type: 'list-item',
    ...(typeof node.checked === 'boolean' ? { checked: node.checked } : {}),
    children: ensureInlineChildren(children),
  };
};

const mapTable = (node: Table): CustomElement => ({
  type: 'table',
  children: node.children.map((row, rowIndex) => ({
    type: 'table-row',
    children: row.children.map((cell, cellIndex) => {
      const align = node.align?.[cellIndex] as
        | TableCellAlign
        | null
        | undefined;

      return {
        type: rowIndex === 0 ? 'table-header-cell' : 'table-cell',
        ...(align ? { align } : {}),
        children: ensureInlineChildren(
          mapInlineChildren(cell.children as InlineNode[])
        ),
      } as CustomElement;
    }),
  })) as CustomElement[],
});

const blockToPlainText = (node: BlockNode): string => {
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('children' in node) {
    return (node.children as RootContent[])
      .map((child) => {
        if ('value' in child && typeof child.value === 'string')
          return child.value;
        if ('children' in child) {
          return plainTextFromInline(child.children as InlineNode[]);
        }
        return '';
      })
      .join('\n');
  }

  return '';
};

const mapBlockNode = (node: RootContent, depth = 0): CustomElement[] => {
  switch (node.type) {
    case 'paragraph':
      return [paragraph(mapInlineChildren(node.children as InlineNode[]))];
    case 'heading':
      return [
        {
          type: 'heading',
          level: Math.min(Math.max((node as Heading).depth, 1), 6),
          children: ensureInlineChildren(
            mapInlineChildren(node.children as InlineNode[])
          ),
        } as CustomElement,
      ];
    case 'blockquote':
      return [mapBlockquote(node, depth)];
    case 'code':
      return [
        {
          type: 'code',
          language: node.lang || 'plaintext',
          children: [text(node.value || '')],
        } as CustomElement,
      ];
    case 'list':
      return [mapList(node, depth)];
    case 'table':
      return [mapTable(node)];
    case 'thematicBreak':
      return [
        {
          type: 'horizontal-line',
          children: [text('')],
        } as CustomElement,
      ];
    case 'footnoteDefinition':
      return [
        paragraph([
          text(`[${node.identifier}]: `),
          ...node.children.flatMap((child) => {
            if (child.type === 'paragraph') {
              return mapInlineChildren(child.children as InlineNode[]);
            }

            return [text(blockToPlainText(child as BlockNode))];
          }),
        ]),
      ];
    case 'definition':
      return [
        paragraph([
          text(`[${node.identifier}]: `),
          {
            type: 'link',
            url: node.url,
            children: [text(node.title || node.url)],
          } as CustomElement,
        ]),
      ];
    case 'html':
      return [paragraph([text(node.value)])];
    default:
      return [];
  }
};

const normalizeTopLevelNodes = (nodes: Descendant[]): CustomElement[] => {
  return nodes.flatMap((node) => {
    if ('type' in node && node.type !== 'text') {
      return [node as CustomElement];
    }

    return [paragraph([node])];
  });
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object');
};

const normalizeTransformedText = (
  node: Record<string, unknown>
): CustomText => ({
  type: 'text',
  text: typeof node.text === 'string' ? node.text : '',
  ...(node.strong ? { bold: true } : {}),
  ...(node.emphasis ? { italic: true } : {}),
  ...(node.delete ? { strikethrough: true } : {}),
  ...(node.inlineCode ? { code: true } : {}),
});

const normalizeTransformedInline = (node: unknown): Descendant[] => {
  if (!isRecord(node)) return [];

  if ('text' in node) {
    return [normalizeTransformedText(node)];
  }

  if (node.type === 'link') {
    return [
      {
        type: 'link',
        url: normalizeUrl(typeof node.url === 'string' ? node.url : ''),
        children: ensureInlineChildren(
          (Array.isArray(node.children) ? node.children : []).flatMap(
            normalizeTransformedInline
          )
        ),
      } as CustomElement,
    ];
  }

  if (node.type === 'image') {
    const url = typeof node.url === 'string' ? node.url : '';
    const label = typeof node.alt === 'string' && node.alt ? node.alt : url;

    return [
      {
        type: 'link',
        url,
        children: [text(label)],
      } as CustomElement,
    ];
  }

  return 'children' in node && Array.isArray(node.children)
    ? node.children.flatMap(normalizeTransformedInline)
    : [];
};

const normalizeTransformedListItem = (
  node: Record<string, unknown>,
  depth: number
): CustomElement => {
  const children: Descendant[] = [];

  (Array.isArray(node.children) ? node.children : []).forEach((child) => {
    if (!isRecord(child)) return;

    if (child.type === 'paragraph') {
      children.push(
        ...ensureInlineChildren(
          (Array.isArray(child.children) ? child.children : []).flatMap(
            normalizeTransformedInline
          )
        )
      );
      return;
    }

    if (child.type === 'list') {
      children.push(...normalizeTransformedBlock(child, depth + 1));
      return;
    }

    normalizeTransformedBlock(child, depth).forEach((block) => {
      children.push(...block.children);
    });
  });

  return {
    type: 'list-item',
    ...(typeof node.checked === 'boolean' ? { checked: node.checked } : {}),
    children: ensureInlineChildren(children),
  };
};

const normalizeTransformedTable = (
  node: Record<string, unknown>
): CustomElement => {
  const align = Array.isArray(node.align) ? node.align : [];

  return {
    type: 'table',
    children: (Array.isArray(node.children) ? node.children : []).map(
      (row, rowIndex) => ({
        type: 'table-row',
        children:
          isRecord(row) && Array.isArray(row.children)
            ? row.children.map((cell, cellIndex) => {
                const cellAlign = align[cellIndex] as
                  | TableCellAlign
                  | null
                  | undefined;

                return {
                  type: rowIndex === 0 ? 'table-header-cell' : 'table-cell',
                  ...(cellAlign ? { align: cellAlign } : {}),
                  children:
                    isRecord(cell) && Array.isArray(cell.children)
                      ? ensureInlineChildren(
                          cell.children.flatMap(normalizeTransformedInline)
                        )
                      : [text('')],
                } as CustomElement;
              })
            : [],
      })
    ) as CustomElement[],
  };
};

const normalizeTransformedBlock = (
  node: unknown,
  depth = 0
): CustomElement[] => {
  if (!isRecord(node)) return [];

  switch (node.type) {
    case 'paragraph':
      return [
        paragraph(
          (Array.isArray(node.children) ? node.children : []).flatMap(
            normalizeTransformedInline
          )
        ),
      ];
    case 'heading':
      return [
        {
          type: 'heading',
          level: Math.min(
            Math.max(typeof node.depth === 'number' ? node.depth : 1, 1),
            6
          ),
          children: ensureInlineChildren(
            (Array.isArray(node.children) ? node.children : []).flatMap(
              normalizeTransformedInline
            )
          ),
        } as CustomElement,
      ];
    case 'blockquote':
      return [
        {
          type: 'quote',
          children: ensureInlineChildren(
            (Array.isArray(node.children) ? node.children : [])
              .flatMap((child) => normalizeTransformedBlock(child, depth))
              .flatMap((block) => block.children)
          ),
        } as CustomElement,
      ];
    case 'code':
      return [
        {
          type: 'code',
          language:
            typeof node.lang === 'string' && node.lang
              ? node.lang
              : 'plaintext',
          children: [
            text(
              Array.isArray(node.children)
                ? node.children
                    .filter(isRecord)
                    .map((child) => child.text)
                    .filter(
                      (value): value is string => typeof value === 'string'
                    )
                    .join('\n')
                : ''
            ),
          ],
        } as CustomElement,
      ];
    case 'list': {
      const children = (
        Array.isArray(node.children) ? node.children : []
      ).filter(isRecord);
      const isTodo = children.some(
        (child) => typeof child.checked === 'boolean'
      );

      return [
        {
          type: 'list',
          format: isTodo ? 'todo' : node.ordered ? 'ordered' : 'unordered',
          indentLevel: depth,
          children: children.map((child) =>
            normalizeTransformedListItem(child, depth)
          ),
        } as CustomElement,
      ];
    }
    case 'table':
      return [normalizeTransformedTable(node)];
    case 'thematicBreak':
      return [
        {
          type: 'horizontal-line',
          children: [text('')],
        } as CustomElement,
      ];
    case 'footnoteDefinition':
    case 'definition':
    case 'html':
      return [
        paragraph([text(blockToPlainText(node as unknown as BlockNode))]),
      ];
    default:
      if ('text' in node) return [paragraph([normalizeTransformedText(node)])];
      return [];
  }
};

const normalizeTransformedNodes = (value: unknown): CustomElement[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((node) => normalizeTransformedBlock(node));
};

export const parseMarkdownToSlate = (
  markdownText: string
): CustomElement[] | null => {
  if (!markdownText || typeof markdownText !== 'string') return null;

  try {
    const transformed = markdownProcessor.processSync(markdownText).result;
    const transformedNodes = normalizeTransformedNodes(transformed);

    if (transformedNodes.length > 0) {
      return transformedNodes;
    }

    const tree = markdownProcessor.parse(markdownText);

    markdownProcessor.runSync(tree);

    const nodes = tree.children.flatMap((node) => mapBlockNode(node));
    const normalizedNodes = normalizeTopLevelNodes(nodes as Descendant[]);

    return normalizedNodes.length > 0 ? normalizedNodes : null;
  } catch (error) {
    console.error('[Better Blocks] Markdown parsing failed:', error);
    return null;
  }
};
