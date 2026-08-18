/**
 * How another Strapi plugin adds a block type to the Better Blocks editor.
 *
 * Unlike the renderers, which take their registrations as a prop, the editor
 * keeps a module-level registry. That is not an oversight: the Strapi admin is
 * a single browser application whose plugins register once at boot, exactly
 * like `app.customFields.register`. There is no second document being edited in
 * another request to leak into.
 *
 * Registering is the *only* supported way in. Adding a block by editing this
 * package is how the editor, the renderers and the validator ended up with
 * four separate hardcoded lists of block types in the first place.
 */

import { isBuiltInBlockType } from '@qkix/better-blocks-core';
import type { BlockDefinition } from '@qkix/better-blocks-core';
import type { Editor } from 'slate';
import type { MessageDescriptor } from 'react-intl';
import type { RenderElementProps } from 'slate-react';
import type { CSSProperties } from 'styled-components';

/**
 * A block type contributed by another package.
 *
 * Extends the core {@link BlockDefinition}, so a package writes `type` and
 * `content` once and the same object teaches the validator, the migrator and
 * every renderer about the block.
 */
export type EditorBlockDefinition = BlockDefinition & {
  /** Draws the block inside the editor. Slate calls this with its element props. */
  renderElement: (props: RenderElementProps) => React.JSX.Element;
  /**
   * Icon for the Insert menu and the slash command. Required to appear in
   * either - a block with no icon is still rendered, just not offered.
   */
  icon?: React.ComponentType;
  /** Menu label. A plain string is fine; a descriptor gets translated. */
  label?: MessageDescriptor | string;
  /**
   * Inserts an empty block of this type at the selection. Required for the
   * block to appear in the Insert menu or the slash command, since without it
   * there is nothing for those to do.
   */
  insert?: (editor: Editor) => void;
  /** Text that converts into this block as you type, e.g. '```mermaid'. */
  snippets?: string[];
  /**
   * Anything `isVoid` cannot express - custom normalization, paste handling,
   * key bindings. Applied when the editor is created.
   */
  withEditor?: (editor: Editor) => Editor;
  /** Nudges the drag handle down, for blocks whose first line is not text. */
  dragHandleTopMargin?: CSSProperties['marginTop'];
};

const registry = new Map<string, EditorBlockDefinition>();

/**
 * Adds a block type to the editor. Call from a Strapi plugin's `register()`.
 *
 * Throws on the two mistakes that would otherwise surface much later as a block
 * that mysteriously does not appear: shadowing a built-in type, and registering
 * the same type twice.
 */
export function registerBlock(definition: EditorBlockDefinition): void {
  const { type } = definition;

  if (typeof type !== 'string' || type.length === 0) {
    throw new Error('A block definition needs a non-empty string `type`.');
  }
  if (isBuiltInBlockType(type)) {
    throw new Error(
      `"${type}" is a built-in Better Blocks type and cannot be re-registered.`
    );
  }
  if (registry.has(type)) {
    throw new Error(`Block type "${type}" is registered twice.`);
  }

  registry.set(type, definition);
}

/** Every registered block, in registration order. */
export function getRegisteredBlocks(): EditorBlockDefinition[] {
  return [...registry.values()];
}

/**
 * Whether the block can be offered in the Insert menu and the slash command.
 *
 * All three are needed: something to draw, something to name it, and something
 * to do when it is picked. A block missing any of them still renders in a
 * document, it just is not offered as a thing to add.
 */
export function isOfferedInMenus(definition: EditorBlockDefinition): boolean {
  return Boolean(definition.icon && definition.label && definition.insert);
}

/**
 * The block's menu label as react-intl wants it. A plain string becomes the
 * default message under a generated id, so it shows as written until someone
 * ships a translation for it.
 */
export function blockLabelDescriptor(
  definition: EditorBlockDefinition
): MessageDescriptor {
  const { label, type } = definition;
  if (label && typeof label !== 'string') return label;

  return {
    id: `components.Blocks.blocks.${type}`,
    defaultMessage: label ?? type,
  };
}

/** Empties the registry. Exists for tests; the admin never needs it. */
export function clearRegisteredBlocks(): void {
  registry.clear();
}

/**
 * Teaches Slate about the registered blocks.
 *
 * Void-ness is derived from the declared content model rather than asked for
 * separately: a block that renders from its own attributes is exactly a Slate
 * void, and getting that wrong is the difference between a working block and an
 * uneditable one.
 */
export function withRegisteredBlocks(editor: Editor): Editor {
  const { isVoid } = editor;
  const voidTypes = new Set(
    getRegisteredBlocks()
      .filter((definition) => (definition.content ?? 'void') === 'void')
      .map((definition) => definition.type)
  );

  editor.isVoid = (element) =>
    voidTypes.has((element as { type?: string }).type ?? '') || isVoid(element);

  return getRegisteredBlocks().reduce(
    (current, definition) => definition.withEditor?.(current) ?? current,
    editor
  );
}
