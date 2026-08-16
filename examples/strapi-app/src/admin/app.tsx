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
import { chartBlock, createChartBlock } from '@qkix/chartkit-core';
import type { ChartSpec } from '@qkix/chartkit-core';
import { ChartEditorDialog, ChartPreview } from '@qkix/chartkit-editor';
import * as React from 'react';
import { Transforms } from 'slate';
import { useSlateStatic, ReactEditor } from 'slate-react';

const ChartIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M2 14V2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M2 14h12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <rect x="4" y="7" width="2.5" height="5" fill="currentColor" />
    <rect x="8" y="4" width="2.5" height="8" fill="currentColor" />
    <rect x="12" y="9" width="2.5" height="3" fill="currentColor" />
  </svg>
);

/** A chart to start from, so a new block shows something rather than an empty box. */
const STARTER: ChartSpec = {
  version: 1,
  type: 'bar',
  title: 'New chart',
  description: 'Revenue by quarter.',
  data: {
    source: 'inline',
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [{ name: 'Revenue', values: [420, 610, 385, 720] }],
  },
};

/**
 * The chart block: a preview in the document, an editor in a dialog.
 *
 * The same shape every other rich block in Better Blocks uses — math, video,
 * embed. A chart editor inline would be most of a screen for something the
 * author is usually only reading.
 *
 * Slate owns the document, so a save goes back through it with
 * `Transforms.setNodes` at this element's path rather than into React state.
 */
const ChartElement = ({ attributes, children, element }: any) => {
  const editor = useSlateStatic();
  const spec = (element as { spec?: ChartSpec }).spec;

  // A block just inserted has nothing worth looking at, so it opens straight
  // into the editor.
  const [open, setOpen] = React.useState(false);

  const save = (next: ChartSpec) => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.setNodes(editor, { spec: next } as never, { at: path });
  };

  return (
    <div {...attributes} contentEditable={false} style={{ margin: '8px 0' }}>
      {spec && (
        <>
          <ChartPreview
            spec={spec}
            locale="en-US"
            onClick={() => setOpen(true)}
          />
          <ChartEditorDialog
            spec={spec}
            open={open}
            onOpenChange={setOpen}
            onSave={save}
            locale="en-US"
          />
        </>
      )}
      {children}
    </div>
  );
};

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
     * Chartkit as a Better Blocks block, with the real editor.
     *
     * `chartBlock` from chartkit-core carries the type, the validator and the
     * migrator; `@qkix/chartkit-editor` carries the editing surface; and the
     * preview inside it is `renderChart` — the same function the front-end
     * renderers call, so the editor and the page cannot disagree.
     */
    registerBlock({
      ...chartBlock,
      icon: ChartIcon,
      label: 'Chart',
      insert: (editor) => {
        Transforms.insertNodes(editor, createChartBlock(STARTER) as never);
      },
      renderElement: (props) => <ChartElement {...props} />,
    });
  },

  bootstrap() {},
};
