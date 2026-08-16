/**
 * The editor in a dialog.
 *
 * A chart editor is a preview plus a grid plus a row of settings, and inline in
 * a document that is most of a screen for something the author is usually not
 * editing. Every other rich block in Better Blocks — math, video, embed — shows
 * a compact preview and opens a modal to edit, so charts do the same.
 *
 * The dialog edits a **draft**. Cancel has to actually cancel, which it cannot
 * do if every keystroke has already been written into the document.
 */

import { Button, Modal } from '@strapi/design-system';
import type { ChartSpec } from '@qkix/chartkit-core';
import * as React from 'react';

import { ChartEditor } from './ChartEditor';
import { useDraftSpec } from './useDraftSpec';

export type ChartEditorDialogProps = {
  spec: ChartSpec;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the edited spec when the author saves. */
  onSave: (spec: ChartSpec) => void;
  locale?: string;
  disabled?: boolean;
  title?: string;
};

export function ChartEditorDialog({
  spec,
  open,
  onOpenChange,
  onSave,
  locale,
  disabled,
  title = 'Edit chart',
}: ChartEditorDialogProps) {
  const [draft, setDraft] = useDraftSpec(spec, open);

  return (
    <Modal.Root open={open} onOpenChange={onOpenChange}>
      <Modal.Content style={{ maxWidth: '960px', width: '90vw' }}>
        <Modal.Header>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <ChartEditor spec={draft} onChange={setDraft} locale={locale} disabled={disabled} />
        </Modal.Body>

        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Cancel</Button>
          </Modal.Close>
          <Button
            disabled={disabled}
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
