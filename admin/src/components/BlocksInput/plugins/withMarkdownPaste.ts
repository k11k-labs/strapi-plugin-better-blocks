import { Editor, Element, Transforms, type BaseEditor } from 'slate';

import { parseMarkdownToSlate } from '../utils/parseMarkdownToSlate';

type DataTransferEditor = BaseEditor & {
  insertData: (data: DataTransfer) => void;
};

const STANDALONE_URL_REGEX = /^https?:\/\/\S+$/;
const STRUCTURAL_MARKDOWN_REGEX =
  /(^#{1,6}\s)|(^\s{0,3}([-*+])\s)|(^\s{0,3}\d+[.)]\s)|(^\s{0,3}[-*+]\s+\[[ xX]\]\s)|(^\s{0,3}>\s)|(^\s{0,3}(```|~~~))|(^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$)|(^|\n)\s*\$\$[\s\S]+?\$\$\s*(?=\n|$)/m;
const INLINE_MARKDOWN_REGEX =
  /(^|[^\w\\])\$[^$\n]*[A-Za-z\\_^=+\-*/{}][^$\n]*\$(?!\d)|(\[[^\]]+\]\([^)]+\))|(!\[[^\]]*\]\([^)]+\))|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(^|[^\w*])\*[^*\s][^*\n]*[^*\s]\*(?=$|[^\w*])|(^|[^\w_])_[^_\s][^_\n]*[^_\s]_(?=$|[^\w_])|(~~[^~\n]+~~)|(`[^`\n]+`)/m;

const hasMarkdownTable = (text: string): boolean => {
  const lines = text.split(/\r?\n/);

  return lines.some((line, index) => {
    const nextLine = lines[index + 1];

    return Boolean(
      line.includes('|') &&
      nextLine &&
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(nextLine)
    );
  });
};

const isLikelyMarkdown = (text: string): boolean => {
  return (
    STRUCTURAL_MARKDOWN_REGEX.test(text) ||
    INLINE_MARKDOWN_REGEX.test(text) ||
    hasMarkdownTable(text)
  );
};

const hasStrongMarkdownSignal = (text: string): boolean => {
  return STRUCTURAL_MARKDOWN_REGEX.test(text) || hasMarkdownTable(text);
};

const shouldParseMarkdownPaste = (text: string, html?: string): boolean => {
  const trimmedText = text.trim();

  return (
    Boolean(trimmedText) &&
    !STANDALONE_URL_REGEX.test(trimmedText) &&
    (html ? hasStrongMarkdownSignal(text) : isLikelyMarkdown(text))
  );
};

const shouldUseNativePaste = (editor: BaseEditor): boolean => {
  if (!editor.selection) return false;

  const protectedEntry = Editor.above(editor, {
    match: (node) =>
      !Editor.isEditor(node) &&
      Element.isElement(node) &&
      ['code', 'table-cell', 'table-header-cell'].includes(
        (node as unknown as { type: string }).type
      ),
  });

  return Boolean(protectedEntry);
};

const withMarkdownPaste = (editor: BaseEditor): BaseEditor => {
  const markdownEditor = editor as DataTransferEditor;
  const { insertData } = markdownEditor;

  markdownEditor.insertData = (data: DataTransfer) => {
    const text = data.getData('text/plain');
    const html = data.getData('text/html');

    if (
      shouldParseMarkdownPaste(text, html) &&
      !shouldUseNativePaste(markdownEditor)
    ) {
      const fragment = parseMarkdownToSlate(text);

      if (fragment && fragment.length > 0) {
        Editor.withoutNormalizing(editor, () => {
          Transforms.insertFragment(markdownEditor, fragment as never);
        });
        return;
      }
    }

    insertData(data);
  };

  return markdownEditor;
};

export { withMarkdownPaste };
