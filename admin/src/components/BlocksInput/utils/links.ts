import {
  Transforms,
  Editor,
  Element as SlateElement,
  Node,
  Range,
  Descendant,
} from 'slate';
import { CustomElement, CustomText, LinkNode } from './types';

const removeLink = (editor: Editor) => {
  Transforms.unwrapNodes(editor, {
    match: (node): node is CustomElement =>
      !Editor.isEditor(node) &&
      SlateElement.isElement(node) &&
      'type' in node &&
      node.type === 'link',
  });
};

const insertLink = (editor: Editor, { url }: { url: string }) => {
  if (editor.selection) {
    // We want to remove all link on the selection
    const linkNodes = Array.from(
      Editor.nodes(editor, {
        at: editor.selection,
        match: (node): node is LinkNode =>
          !Editor.isEditor(node) && 'type' in node && node.type === 'link',
      })
    );

    linkNodes.forEach(([, path]) => {
      Transforms.unwrapNodes(editor, { at: path });
    });

    if (Range.isCollapsed(editor.selection)) {
      const link: LinkNode = {
        type: 'link',
        url: url ?? '',
        children: [{ type: 'text', text: url } as CustomText],
      };

      Transforms.insertNodes(editor, link);
    } else {
      // Create a LinkNode with an empty children array
      const linkNode: LinkNode = {
        type: 'link',
        url: url ?? '',
        children: [],
      };

      // Use it with wrapNodes
      Transforms.wrapNodes(editor, linkNode, { split: true });
    }
  }
};

const editLink = (
  editor: Editor,
  link: { url: string; text: string; target?: '_blank'; rel?: string }
) => {
  const { url, text, target, rel } = link;

  if (!editor.selection) {
    return;
  }

  const linkEntry = Editor.above(editor, {
    match: (node): node is LinkNode =>
      !Editor.isEditor(node) && 'type' in node && node.type === 'link',
  });

  if (linkEntry) {
    const [, linkPath] = linkEntry;
    Transforms.setNodes<LinkNode>(
      editor,
      {
        url,
        target: target ?? null,
        rel: rel ?? null,
      } as Partial<LinkNode>,
      { at: linkPath }
    );

    // If link text is different, we remove the old text and insert the new one
    if (text !== '' && text !== Editor.string(editor, linkPath)) {
      const linkNodeChildrens = Array.from(
        Node.children(editor, linkPath, { reverse: true })
      );

      linkNodeChildrens.forEach(([, childPath]) => {
        Transforms.removeNodes(editor, { at: childPath });
      });

      Transforms.insertNodes(editor, [{ type: 'text', text } as CustomText], {
        at: linkPath.concat(0),
      });
    }
  }
};

export { insertLink, editLink, removeLink };
