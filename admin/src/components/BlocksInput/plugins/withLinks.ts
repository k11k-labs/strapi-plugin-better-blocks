import {
  type BaseEditor,
  Path,
  Transforms,
  Range,
  Point,
  Editor,
  type NodeEntry,
  type BaseElement,
  type Operation,
} from 'slate';
import { type ReactEditor } from 'slate-react';
import { insertLink } from '../utils/links';
import { CustomElement, CustomText } from '../utils/types';

// Define the LinkEditor interface
interface LinkEditor extends BaseEditor, ReactEditor {
  lastInsertedLinkPath: Path | null;
  shouldSaveLinkPath: boolean;
}

// Update the withLinks function to accept BaseEditor
const withLinks = (editor: BaseEditor) => {
  const linkEditor = editor as LinkEditor;
  const { isInline, apply, insertText } = linkEditor;

  // Initialize the custom properties
  linkEditor.lastInsertedLinkPath = null;
  linkEditor.shouldSaveLinkPath = true;

  // Links are inline elements
  linkEditor.isInline = (element: BaseElement) => {
    return 'type' in element && element.type === 'link'
      ? true
      : isInline(element);
  };

  // Track operations to properly handle link paths
  linkEditor.apply = (operation: Operation) => {
    if (
      operation.type === 'insert_node' &&
      'type' in operation.node &&
      operation.node.type === 'link' &&
      linkEditor.shouldSaveLinkPath
    ) {
      linkEditor.lastInsertedLinkPath = operation.path;
    }

    apply(operation);
  };

  // Handle automatic link creation when pasting URLs
  linkEditor.insertText = (text) => {
    const { selection } = linkEditor;

    if (selection && Range.isCollapsed(selection)) {
      const { anchor } = selection;
      const block = Editor.above(linkEditor, {
        match: (n) => 'type' in n && !Editor.isEditor(n) && n.type !== 'link',
      });
      const path = block ? block[1] : [];
      const start = Editor.start(linkEditor, path);
      const range = { anchor, focus: start };
      const beforeText = Editor.string(linkEditor, range);

      // Check for space before cursor
      const beforeTextTrimmed = beforeText.trim();

      // Regular expressions for URL detection
      const urlRegex = /https?:\/\/\S+$/;
      const match = beforeTextTrimmed.match(urlRegex);

      if (match) {
        const url = match[0];
        const urlStart = beforeText.lastIndexOf(url);
        const urlEnd = urlStart + url.length;
        const urlRange = {
          anchor: { path: anchor.path, offset: urlStart },
          focus: { path: anchor.path, offset: urlEnd },
        };

        Transforms.select(linkEditor, urlRange);

        linkEditor.shouldSaveLinkPath = true;
        insertLink(linkEditor, { url });
        return;
      }
    }

    insertText(text);
  };

  // Handle pasting URLs
  const { insertData } = linkEditor as unknown as {
    insertData: (data: DataTransfer) => void;
  };
  linkEditor.insertData = (data: DataTransfer) => {
    const text = data.getData('text/plain');
    const urlRegex = /^https?:\/\/\S+$/;

    if (text && urlRegex.test(text)) {
      if (!linkEditor.selection || Range.isCollapsed(linkEditor.selection)) {
        // If no selection, just insert the link
        linkEditor.shouldSaveLinkPath = true;
        insertLink(linkEditor, { url: text });
      } else {
        // If there's a selection, convert it to a link
        linkEditor.shouldSaveLinkPath = true;
        insertLink(linkEditor, { url: text });
      }
      return;
    }

    insertData(data);
  };

  return linkEditor;
};

export { withLinks, type LinkEditor };
