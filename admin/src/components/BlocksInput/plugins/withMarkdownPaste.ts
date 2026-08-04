import { Editor, Range, Transforms, type BaseEditor } from 'slate';

import { parseMarkdownToSlate } from '../utils/parseMarkdownToSlate';

type DataTransferEditor = BaseEditor & {
  insertData: (data: DataTransfer) => void;
};

const STANDALONE_URL_REGEX = /^https?:\/\/\S+$/;
const MARKDOWN_REGEX =
  /(^#{1,6}\s)|(^\s{0,3}([-*+])\s)|(^\s{0,3}\d+[.)]\s)|(^\s{0,3}[-*+]\s+\[[ xX]\]\s)|(^\s{0,3}>\s)|(^\s{0,3}(```|~~~))|(^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$)|(\[[^\]]+\]\([^)]+\))|(!\[[^\]]*\]\([^)]+\))|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~\n]+~~)|(`[^`\n]+`)|(^\s*\|.+\|\s*$)/m;

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
  return MARKDOWN_REGEX.test(text) || hasMarkdownTable(text);
};

const shouldParseMarkdownPaste = (text: string): boolean => {
  const trimmedText = text.trim();

  return (
    Boolean(trimmedText) &&
    !STANDALONE_URL_REGEX.test(trimmedText) &&
    isLikelyMarkdown(text)
  );
};

const withMarkdownPaste = (editor: BaseEditor): BaseEditor => {
  const markdownEditor = editor as DataTransferEditor;
  const { insertData } = markdownEditor;

  markdownEditor.insertData = (data: DataTransfer) => {
    const text = data.getData('text/plain');

    if (shouldParseMarkdownPaste(text)) {
      const fragment = parseMarkdownToSlate(text);

      if (fragment && fragment.length > 0) {
        Editor.withoutNormalizing(editor, () => {
          if (editor.selection && !Range.isCollapsed(editor.selection)) {
            Transforms.delete(markdownEditor);
          }

          Transforms.insertNodes(markdownEditor, fragment as never);
        });
        return;
      }
    }

    insertData(data);
  };

  return markdownEditor;
};

export { withMarkdownPaste, isLikelyMarkdown, shouldParseMarkdownPaste };
