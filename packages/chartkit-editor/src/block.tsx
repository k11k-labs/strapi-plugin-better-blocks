/**
 * Chartkit as a ready-made Better Blocks block.
 *
 * `chartBlock` in `@qkix/chartkit-core` carries the framework-free half — the
 * type, the validator, the migrator. This adds the half that only the Strapi
 * admin can supply: an icon, a menu label, something to insert, and a component
 * that draws a chart in a document and opens the editor when clicked.
 *
 * Without this, every app wanting charts in its rich text wrote the same eighty
 * lines: find the node's path, `Transforms.setNodes` the edited spec back,
 * remember `contentEditable={false}`, remember the empty text child Slate
 * demands of a void. All of it identical, and all of it a chance to get one
 * detail wrong.
 *
 * **A separate entry point on purpose.** It is reached as
 * `@qkix/chartkit-editor/block`, not from the package root, because it is the
 * only thing here that imports Slate. The standalone custom field uses this
 * package too and has no Slate anywhere near it; a root-level import would make
 * every consumer install an editor framework to get a data grid.
 *
 * ```ts
 * import { registerBlock } from '@qkix/strapi-plugin-better-blocks/strapi-admin';
 * import { chartBlockDefinition } from '@qkix/chartkit-editor/block';
 *
 * registerBlock(chartBlockDefinition());
 * ```
 */

import { CHART_SPEC_VERSION, chartBlock, createChartBlock } from '@qkix/chartkit-core';
import type { ChartSpec } from '@qkix/chartkit-core';
import * as React from 'react';
import { Transforms, type Editor } from 'slate';
import { ReactEditor, useSlateStatic, type RenderElementProps } from 'slate-react';

import { ChartEditorDialog } from './ChartEditorDialog';
import { ChartPreview } from './ChartPreview';

export type ChartBlockDefinitionOptions = {
  /** Number formatting in the in-document preview and the editor. */
  locale?: string;
  /** Menu label. Defaults to "Chart". */
  label?: string;
  /** Overrides the icon shown in the Insert menu and the slash command. */
  icon?: React.ComponentType;
  /**
   * The chart a freshly inserted block starts from.
   *
   * Defaults to four empty quarters — categories to type over, and no invented
   * numbers. A block that arrives carrying data an author did not enter is a
   * block that can be published without anyone noticing they never edited it.
   */
  starter?: ChartSpec;
};

/** The default starter: shaped like a chart, empty of readings. */
function defaultStarter(): ChartSpec {
  return {
    version: CHART_SPEC_VERSION,
    type: 'bar',
    data: {
      source: 'inline',
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      series: [{ name: 'Series 1', values: [null, null, null, null] }],
    },
  };
}

const ChartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 14V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M2 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="4" y="7" width="2.5" height="5" fill="currentColor" />
    <rect x="8" y="4" width="2.5" height="8" fill="currentColor" />
    <rect x="12" y="9" width="2.5" height="3" fill="currentColor" />
  </svg>
);

/**
 * A chart inside a document: the preview, and the editor behind it.
 *
 * Slate owns the document, so a save goes back through it with
 * `Transforms.setNodes` at this element's path rather than into React state —
 * anything else and the edit is invisible to undo, to the save button, and to
 * the next render.
 */
function ChartElement({
  attributes,
  children,
  element,
  locale,
}: RenderElementProps & { locale?: string }) {
  // `useSlateStatic` is typed as the base editor, but anything rendering this
  // went through `withReact` — that is what makes `renderElement` run at all —
  // so the react methods `findPath` needs are there. The cast says so once,
  // rather than every call site pretending the props are `any`.
  const editor = useSlateStatic() as ReactEditor;
  const [open, setOpen] = React.useState(false);

  const spec = (element as { spec?: ChartSpec }).spec;

  const save = (next: ChartSpec) => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.setNodes(editor, { spec: next } as never, { at: path });
  };

  return (
    // `contentEditable={false}` is not optional: without it Slate lets the
    // caret into a block that has no text to edit, and typing corrupts it.
    <div {...attributes} contentEditable={false} style={{ margin: '8px 0' }}>
      {spec && (
        <>
          <ChartPreview
            spec={spec}
            locale={locale}
            idPrefix="chartkit-block"
            onClick={() => setOpen(true)}
          />
          <ChartEditorDialog
            spec={spec}
            open={open}
            onOpenChange={setOpen}
            onSave={save}
            locale={locale}
          />
        </>
      )}
      {/* Slate requires the children even for a void, which renders as the
        empty text node the block carries. Dropping it takes the editor down. */}
      {children}
    </div>
  );
}

/**
 * Builds the registration to hand to Better Blocks' `registerBlock`.
 *
 * A function rather than a constant so a locale can be passed in — a chart
 * needs one to format its numbers and a block does not otherwise carry one.
 *
 * Structurally an `EditorBlockDefinition` without importing Better Blocks,
 * which would make Chartkit's editor depend on a rich-text plugin it has no
 * business knowing about. The host's `registerBlock` call is where the two
 * shapes actually meet, and where TypeScript checks them against each other.
 */
export function chartBlockDefinition(options: ChartBlockDefinitionOptions = {}) {
  const { locale, label = 'Chart', icon = ChartIcon, starter } = options;

  return {
    ...chartBlock,
    icon,
    label,
    insert: (editor: Editor) => {
      Transforms.insertNodes(editor, createChartBlock(starter ?? defaultStarter()) as never);
    },
    renderElement: (props: RenderElementProps) => <ChartElement {...props} locale={locale} />,
  };
}
