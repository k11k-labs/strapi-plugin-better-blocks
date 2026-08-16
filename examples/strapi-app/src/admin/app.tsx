/**
 * Demonstrates adding a block type to the Better Blocks editor from outside the
 * plugin — the same `registerBlock` call another Strapi plugin would make from
 * its own `register()`.
 *
 * The block here is deliberately trivial: a big number with a caption. What it
 * shows is the shape of a registration, not the block itself.
 *
 * The front end needs its own half of this: a renderer given no plugin for a
 * type draws nothing for it. See `blockPlugins` in either renderer's README —
 * the example apps do not register one, so a `key-figure` authored here is
 * stored and round-trips, but does not appear on the rendered pages.
 */

import { registerBlock } from '@qkix/strapi-plugin-better-blocks/strapi-admin';
import { chartBlockDefinition } from '@qkix/chartkit-editor/block';
import { Transforms } from 'slate';

const KeyFigureIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <rect
      x="1"
      y="3"
      width="14"
      height="10"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M4.5 9.5V6.5L6.5 9.5V6.5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M9 6.5h2.5M9 9.5h2.5M9 8h2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export default {
  register() {
    registerBlock({
      type: 'key-figure',
      // Renders from its own attributes, so Slate treats it as a void.
      content: 'void',
      icon: KeyFigureIcon,
      label: 'Key figure',

      // Runs in `validateDocument`/`migrateDocument` when the core is given
      // this definition — the editor never calls it.
      validate: (node, { path, fail }) => {
        if (typeof node.value !== 'string') {
          fail(`${path}.value`, 'key-figure value must be a string');
        }
      },

      insert: (editor) => {
        Transforms.insertNodes(editor, {
          type: 'key-figure',
          value: '42',
          caption: 'things measured',
          // Slate refuses a document whose nodes are not elements, and an
          // element is something with a children array — see the core's
          // BlockContentModel docs.
          children: [{ type: 'text', text: '' }],
        } as never);
      },

      renderElement: ({ attributes, children, element }) => {
        const { value, caption } = element as unknown as {
          value?: string;
          caption?: string;
        };

        return (
          <div
            {...attributes}
            contentEditable={false}
            style={{
              border: '1px solid #dcdce4',
              borderRadius: '4px',
              padding: '16px',
              margin: '8px 0',
              textAlign: 'center',
              background: '#f6f6f9',
            }}
          >
            <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1.1 }}>
              {value}
            </div>
            <div style={{ fontSize: '12px', color: '#666687' }}>{caption}</div>
            {children}
          </div>
        );
      },
    });

    /**
     * Chartkit as a Better Blocks block.
     *
     * Everything this used to spell out by hand — the icon, the starter chart,
     * finding the node's path and writing the edited spec back through Slate —
     * now ships in `@qkix/chartkit-editor/block`. What is left is the choice a
     * host actually has to make: the locale its numbers are formatted in.
     */
    registerBlock(chartBlockDefinition({ locale: 'en-US' }));
  },

  bootstrap() {},
};
