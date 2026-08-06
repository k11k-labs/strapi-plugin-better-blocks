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

import { codeLanguages } from './constants';
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

/**
 * Definitions are only legal at the top level in CommonMark, but remark still
 * parses them inside blockquotes and list items — so walk the whole tree or a
 * `[ref]` used from one of those containers would lose its URL.
 */
const collectDefinitions = (tree: Root): DefinitionMap => {
  const definitions: DefinitionMap = new Map();

  const walk = (nodes: readonly RootContent[]): void => {
    nodes.forEach((node) => {
      if (node.type === 'definition') {
        definitions.set(normalizeIdentifier(node.identifier), node);
      }

      if ('children' in node) {
        walk(node.children as RootContent[]);
      }
    });
  };

  walk(tree.children);

  return definitions;
};

/**
 * remark-math treats every `$…$` pair as inline math, so shell-style prose like
 * `run $HOME/bin and $PATH` parses as a formula and would be swallowed by KaTeX.
 * Real LaTeX never pads its delimiters with whitespace, so a padded (or empty)
 * span is text the author never meant as math — keep it as literal `$…$`.
 */
const isLikelyInlineMath = (value: string): boolean => {
  return value.trim() !== '' && !/^\s|\s$/.test(value);
};

const inlineMathText = (value: string): string => {
  return isLikelyInlineMath(value) ? value : `$${value}$`;
};

/**
 * Fence info strings use short aliases (```ts, ```py, ```sh) while the plugin's
 * code block stores the canonical values from `codeLanguages`. Without this map
 * a pasted fence keeps an id the language dropdown cannot display, so the block
 * renders with no selectable language. Anything unrecognised falls back to
 * `plaintext` rather than persisting a value the UI does not know.
 */
const CODE_LANGUAGE_ALIASES: Record<string, string> = {
  'c++': 'cpp',
  'c#': 'csharp',
  'obj-c': 'objectivec',
  'objective-c': 'objectivec',
  sh: 'shell',
  'shell-session': 'shell',
  console: 'shell',
  zsh: 'shell',
  bat: 'powershell',
  cmd: 'powershell',
  ps1: 'powershell',
  docker: 'dockerfile',
  golang: 'go',
  htm: 'html',
  js: 'javascript',
  kt: 'kotlin',
  md: 'markdown',
  mdx: 'markdown',
  objc: 'objectivec',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  text: 'plaintext',
  txt: 'plaintext',
  ts: 'typescript',
  tex: 'latex',
  vb: 'vbnet',
  yml: 'yaml',
};

const supportedCodeLanguages = new Set(
  codeLanguages.map((language) => language.value)
);

const normalizeCodeLanguage = (lang: string | null | undefined): string => {
  if (!lang) return 'plaintext';

  const id = lang.trim().toLowerCase();
  const mapped = CODE_LANGUAGE_ALIASES[id] ?? id;

  return supportedCodeLanguages.has(mapped) ? mapped : 'plaintext';
};

const normalizeUrl = (url: string): string => {
  // remark already resolves `<hi@example.com>` to `mailto:hi@example.com`, and
  // that value still looks like a bare address to the test below — without this
  // guard it would be prefixed a second time (`mailto:mailto:…`).
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return url;
  }

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
    case 'inlineMath': {
      const value = (node as InlineMathNode).value;

      return isLikelyInlineMath(value)
        ? [math(value, 'inline')]
        : [text(inlineMathText(value), marks)];
    }
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
        case 'html':
          return (node as Text | InlineCode | Html).value;
        case 'inlineMath':
          return inlineMathText((node as InlineMathNode).value);
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
  // Only carry `start` when the list actually begins somewhere other than 1, so
  // the common case keeps the exact shape the editor produces on its own.
  const start =
    format === 'ordered' && typeof node.start === 'number' && node.start > 1
      ? node.start
      : undefined;

  return {
    type: 'list',
    format,
    indentLevel: depth,
    ...(start ? { start } : {}),
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

/**
 * A Markdown image is inline while the plugin's image is a block, so only an
 * image that is alone in its paragraph can become one — `see ![x](y) here` has
 * to stay an inline link or the sentence would be torn in two.
 */
const standaloneImage = (
  node: Paragraph,
  definitions: DefinitionMap
): { url: string; alt: string } | null => {
  const meaningful = node.children.filter(
    (child) => !(child.type === 'text' && child.value.trim() === '')
  );

  if (meaningful.length !== 1) return null;

  const only = meaningful[0];

  if (only.type === 'image') {
    return { url: only.url, alt: only.alt || '' };
  }

  if (only.type === 'imageReference') {
    const definition = definitions.get(normalizeIdentifier(only.identifier));

    return definition ? { url: definition.url, alt: only.alt || '' } : null;
  }

  return null;
};

const mapImageBlock = (image: { url: string; alt: string }): CustomElement => ({
  type: 'image',
  image: {
    url: image.url,
    alternativeText: image.alt,
  },
  children: [emptyText()],
});

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
    case 'paragraph': {
      const image = standaloneImage(node as Paragraph, definitions);

      if (image) return [mapImageBlock(image)];

      return [
        paragraph(
          mapInlineChildren(
            (node as Paragraph).children as MarkdownInlineNode[],
            definitions
          )
        ),
      ];
    }
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
          language: normalizeCodeLanguage((node as Code).lang),
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
