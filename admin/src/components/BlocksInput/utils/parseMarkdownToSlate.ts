import type {
  AlignType,
  Blockquote,
  Break,
  Code,
  Definition,
  Delete,
  Emphasis,
  FootnoteDefinition,
  FootnoteReference,
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
  PhrasingContent,
  Root,
  RootContent,
  Strong,
  Table,
  Text,
  ThematicBreak,
} from 'mdast';
import type { Descendant } from 'slate';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import type { CustomElement, CustomText, TableCellAlign } from './types';

type InlineMathNode = {
  type: 'inlineMath';
  value: string;
};

type MathNode = {
  type: 'math';
  value: string;
};

type MarkdownInlineNode = PhrasingContent | InlineMathNode;
type MarkdownBlockNode = RootContent | MathNode;

type DefinitionMap = Map<string, Definition>;

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkMath)
  .use(remarkGfm);

const text = (
  value: string,
  marks: Partial<Omit<CustomText, 'type' | 'text'>> = {}
): CustomText => ({
  type: 'text',
  text: value,
  ...marks,
});

const emptyText = (): CustomText => text('');

const paragraph = (children: Descendant[] = [emptyText()]): CustomElement => ({
  type: 'paragraph',
  children: ensureChildren(children),
});

const math = (value: string, format: 'inline' | 'block'): CustomElement => ({
  type: 'math',
  format,
  value,
  children: [emptyText()],
});

const ensureChildren = (children: Descendant[]): Descendant[] => {
  return children.length > 0 ? children : [emptyText()];
};

const normalizeIdentifier = (identifier: string): string => {
  return identifier.trim().replace(/\s+/g, ' ').toLowerCase();
};

const collectDefinitions = (tree: Root): DefinitionMap => {
  const definitions: DefinitionMap = new Map();

  tree.children.forEach((node) => {
    if (node.type === 'definition') {
      definitions.set(normalizeIdentifier(node.identifier), node);
    }
  });

  return definitions;
};

const normalizeUrl = (url: string): string => {
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(url)) {
    return `mailto:${url}`;
  }

  return url;
};

const mapInlineChildren = (
  children: readonly MarkdownInlineNode[] = [],
  definitions: DefinitionMap,
  marks: Partial<Omit<CustomText, 'type' | 'text'>> = {}
): Descendant[] => {
  return children.flatMap((node) => mapInlineNode(node, definitions, marks));
};

const mapInlineNode = (
  node: MarkdownInlineNode,
  definitions: DefinitionMap,
  marks: Partial<Omit<CustomText, 'type' | 'text'>>
): Descendant[] => {
  switch (node.type) {
    case 'text':
      return [text((node as Text).value, marks)];
    case 'break':
      return [text('\n', marks)];
    case 'emphasis':
      return mapInlineChildren(
        (node as Emphasis).children as MarkdownInlineNode[],
        definitions,
        {
          ...marks,
          italic: true,
        } as never
      );
    case 'strong':
      return mapInlineChildren(
        (node as Strong).children as MarkdownInlineNode[],
        definitions,
        {
          ...marks,
          bold: true,
        } as never
      );
    case 'delete':
      return mapInlineChildren(
        (node as Delete).children as MarkdownInlineNode[],
        definitions,
        {
          ...marks,
          strikethrough: true,
        } as never
      );
    case 'inlineCode':
      return [
        text((node as InlineCode).value, { ...marks, code: true } as never),
      ];
    case 'inlineMath':
      return [math((node as InlineMathNode).value, 'inline')];
    case 'link': {
      const link = node as Link;

      return [
        {
          type: 'link',
          url: normalizeUrl(link.url),
          children: ensureChildren(
            mapInlineChildren(
              link.children as MarkdownInlineNode[],
              definitions,
              marks
            )
          ),
        } as CustomElement,
      ];
    }
    case 'linkReference': {
      const reference = node as LinkReference;
      const definition = definitions.get(
        normalizeIdentifier(reference.identifier)
      );
      const children = ensureChildren(
        mapInlineChildren(
          reference.children as MarkdownInlineNode[],
          definitions,
          marks
        )
      );

      return definition
        ? [
            {
              type: 'link',
              url: normalizeUrl(definition.url),
              children,
            } as CustomElement,
          ]
        : children;
    }
    case 'image': {
      const image = node as Image;
      const label = image.alt || image.url;

      return [
        {
          type: 'link',
          url: image.url,
          children: [text(label, marks)],
        } as CustomElement,
      ];
    }
    case 'imageReference': {
      const image = node as ImageReference;
      const definition = definitions.get(normalizeIdentifier(image.identifier));
      const label = image.alt || definition?.title || definition?.url || '';

      return definition
        ? [
            {
              type: 'link',
              url: definition.url,
              children: [text(label, marks)],
            } as CustomElement,
          ]
        : [text(label, marks)];
    }
    case 'footnoteReference':
      return [text(`[^${(node as FootnoteReference).identifier}]`, marks)];
    case 'html':
      return [text((node as Html).value, marks)];
    default:
      return [];
  }
};

const inlinePlainText = (
  children: readonly MarkdownInlineNode[] = [],
  definitions: DefinitionMap
): string => {
  return children
    .map((node) => {
      switch (node.type) {
        case 'text':
        case 'inlineCode':
        case 'inlineMath':
        case 'html':
          return (node as Text | InlineCode | InlineMathNode | Html).value;
        case 'break':
          return '\n';
        case 'image':
          return (node as Image).alt || (node as Image).url;
        case 'imageReference': {
          const image = node as ImageReference;
          const definition = definitions.get(
            normalizeIdentifier(image.identifier)
          );
          return image.alt || definition?.url || '';
        }
        case 'footnoteReference':
          return `[^${(node as FootnoteReference).identifier}]`;
        default:
          return 'children' in node
            ? inlinePlainText(
                (node.children || []) as MarkdownInlineNode[],
                definitions
              )
            : '';
      }
    })
    .join('');
};

const blockPlainText = (
  node: MarkdownBlockNode,
  definitions: DefinitionMap
): string => {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return inlinePlainText(
        (node as Paragraph | Heading).children as MarkdownInlineNode[],
        definitions
      );
    case 'blockquote':
      return (node as Blockquote).children
        .map((child) => blockPlainText(child as MarkdownBlockNode, definitions))
        .join('\n');
    case 'code':
    case 'math':
    case 'html':
      return (node as Code | MathNode | Html).value;
    case 'list':
      return listPlainText(node as List, definitions);
    case 'footnoteDefinition':
      return footnoteDefinitionText(node as FootnoteDefinition, definitions);
    case 'definition':
      return definitionText(node as Definition);
    case 'thematicBreak':
      return '---';
    default:
      return '';
  }
};

const listPlainText = (node: List, definitions: DefinitionMap): string => {
  return node.children
    .flatMap((item, index) => {
      const marker = node.ordered ? `${index + (node.start || 1)}. ` : '- ';
      const lines = item.children.map((child) =>
        blockPlainText(child as MarkdownBlockNode, definitions)
      );

      return lines.map((line, lineIndex) =>
        lineIndex === 0 ? `${marker}${line}` : `  ${line}`
      );
    })
    .join('\n');
};

const definitionText = (node: Definition): string => {
  return `[${node.identifier}]: ${node.url}`;
};

const footnoteDefinitionText = (
  node: FootnoteDefinition,
  definitions: DefinitionMap
): string => {
  const content = node.children
    .map((child) => blockPlainText(child as MarkdownBlockNode, definitions))
    .join('\n');

  return `[^${node.identifier}]: ${content}`;
};

const joinInlineGroups = (groups: Descendant[][]): Descendant[] => {
  return groups.flatMap((group, index) =>
    index === 0 ? group : [text('\n'), ...group]
  );
};

const mapBlockquote = (
  node: Blockquote,
  definitions: DefinitionMap
): CustomElement => {
  const groups = node.children.map((child) => {
    if (child.type === 'paragraph') {
      return mapInlineChildren(
        child.children as MarkdownInlineNode[],
        definitions
      );
    }

    return [text(blockPlainText(child as MarkdownBlockNode, definitions))];
  });

  return {
    type: 'quote',
    children: ensureChildren(joinInlineGroups(groups)),
  };
};

const mapList = (
  node: List,
  definitions: DefinitionMap,
  depth: number
): CustomElement => {
  const isTodo = node.children.some(
    (item) => typeof item.checked === 'boolean'
  );
  const format = isTodo ? 'todo' : node.ordered ? 'ordered' : 'unordered';

  return {
    type: 'list',
    format,
    indentLevel: depth,
    children: node.children.flatMap((item) =>
      mapListItem(item, definitions, depth, isTodo)
    ),
  };
};

const mapListItem = (
  node: ListItem,
  definitions: DefinitionMap,
  depth: number,
  parentIsTodo: boolean
): CustomElement[] => {
  const inlineGroups: Descendant[][] = [];
  const nestedLists: CustomElement[] = [];

  node.children.forEach((child) => {
    if (child.type === 'list') {
      nestedLists.push(mapList(child as List, definitions, depth + 1));
      return;
    }

    if (child.type === 'paragraph') {
      inlineGroups.push(
        mapInlineChildren(
          (child as Paragraph).children as MarkdownInlineNode[],
          definitions
        )
      );
      return;
    }

    inlineGroups.push([
      text(blockPlainText(child as MarkdownBlockNode, definitions)),
    ]);
  });

  const listItem: CustomElement = {
    type: 'list-item',
    ...(parentIsTodo ? { checked: node.checked === true } : {}),
    children: ensureChildren(joinInlineGroups(inlineGroups)),
  };

  return [listItem, ...nestedLists];
};

const mapTableAlign = (
  align: AlignType | undefined
): TableCellAlign | undefined => {
  return align === 'left' || align === 'center' || align === 'right'
    ? align
    : undefined;
};

const mapTable = (node: Table, definitions: DefinitionMap): CustomElement => ({
  type: 'table',
  children: node.children.map((row, rowIndex) => ({
    type: 'table-row',
    children: row.children.map((cell, cellIndex) => {
      const align = mapTableAlign(node.align?.[cellIndex] ?? undefined);

      return {
        type: rowIndex === 0 ? 'table-header-cell' : 'table-cell',
        ...(align ? { align } : {}),
        children: ensureChildren(
          mapInlineChildren(cell.children as MarkdownInlineNode[], definitions)
        ),
      } as CustomElement;
    }),
  })) as CustomElement[],
});

const mapBlockNode = (
  node: MarkdownBlockNode,
  definitions: DefinitionMap,
  includeDefinitions: boolean
): CustomElement[] => {
  switch (node.type) {
    case 'paragraph':
      return [
        paragraph(
          mapInlineChildren(
            (node as Paragraph).children as MarkdownInlineNode[],
            definitions
          )
        ),
      ];
    case 'heading':
      return [
        {
          type: 'heading',
          level: Math.min(Math.max((node as Heading).depth, 1), 6),
          children: ensureChildren(
            mapInlineChildren(
              (node as Heading).children as MarkdownInlineNode[],
              definitions
            )
          ),
        } as CustomElement,
      ];
    case 'blockquote':
      return [mapBlockquote(node as Blockquote, definitions)];
    case 'code':
      return [
        {
          type: 'code',
          language: (node as Code).lang || 'plaintext',
          children: [text((node as Code).value || '')],
        } as CustomElement,
      ];
    case 'math':
      return [math((node as MathNode).value, 'block')];
    case 'list':
      return [mapList(node as List, definitions, 0)];
    case 'table':
      return [mapTable(node as Table, definitions)];
    case 'thematicBreak':
      return [
        {
          type: 'horizontal-line',
          children: [emptyText()],
        } as CustomElement,
      ];
    case 'footnoteDefinition':
      return [
        paragraph([
          text(footnoteDefinitionText(node as FootnoteDefinition, definitions)),
        ]),
      ];
    case 'definition':
      return includeDefinitions
        ? [paragraph([text(definitionText(node as Definition))])]
        : [];
    case 'html':
      return [paragraph([text((node as Html).value)])];
    default:
      return [];
  }
};

export const parseMarkdownToSlate = (
  markdownText: string
): CustomElement[] | null => {
  if (!markdownText || typeof markdownText !== 'string') return null;

  try {
    const tree = markdownProcessor.parse(markdownText) as Root;
    const parsedTree = markdownProcessor.runSync(tree) as Root;
    const definitions = collectDefinitions(parsedTree);
    const hasRenderableContent = parsedTree.children.some(
      (node) => node.type !== 'definition'
    );

    const nodes = parsedTree.children.flatMap((node) =>
      mapBlockNode(
        node as MarkdownBlockNode,
        definitions,
        !hasRenderableContent
      )
    );

    return nodes.length > 0 ? nodes : null;
  } catch (error) {
    console.error('[Better Blocks] Markdown parsing failed:', error);
    return null;
  }
};
