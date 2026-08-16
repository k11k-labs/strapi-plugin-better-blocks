/**
 * Pasting a range out of a spreadsheet.
 *
 * Shows what the paste parsed into *before* it replaces anything. The parser
 * has to guess — is the first row a header, is the comma a separator or a
 * decimal mark — and a wrong guess that silently overwrites an author's data is
 * much worse than one they can see and cancel.
 */

import {
  Box,
  Button,
  Field,
  Flex,
  Modal,
  Textarea,
  Toggle,
  Typography,
} from '@strapi/design-system';
import * as React from 'react';

import type { ChartSpec } from '@qkix/chartkit-core';

import { parseDelimited, type ParseResult } from './csv';
import { replaceData } from './edit';

/** Where the text came from, when it was not typed. */
export type PasteOrigin = {
  fileId?: number;
  url?: string;
  name?: string;
};

export type PastePanelProps = {
  spec: ChartSpec;
  onApply: (spec: ChartSpec) => void;
  onCancel: () => void;
  /** Pre-filled content, for a file read from the Media Library. */
  initialText?: string;
  /**
   * The file the text came from. Recorded on the spec so the editor can say
   * where the numbers came from and offer to read it again — the values
   * themselves are written in, so nothing has to be fetched at render time.
   */
  origin?: PasteOrigin;
};

export function PastePanel({ spec, onApply, onCancel, initialText = '', origin }: PastePanelProps) {
  const [text, setText] = React.useState(initialText);
  // Undefined means "use the parser's guess". Touching the switch pins it.
  const [header, setHeader] = React.useState<boolean | undefined>(undefined);

  const parsed: ParseResult | null = text.trim() ? parseDelimited(text, { header }) : null;
  const usedHeader = parsed?.ok ? parsed.table.usedHeader : false;

  return (
    <Modal.Root open onOpenChange={onCancel}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>
            {origin?.name ? `Import ${origin.name}` : 'Paste from a spreadsheet'}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Typography variant="pi" textColor="neutral600">
            Copy a range including its header row. Tabs, commas and semicolons all work; the first
            column becomes the categories and every other column becomes a series.
          </Typography>

          <Box paddingTop={3}>
            <Textarea
              value={text}
              placeholder={'\tRevenue\tCosts\nQ1\t420\t310\nQ2\t610\t480'}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                setText(event.target.value)
              }
            />
          </Box>

          {parsed && !parsed.ok && (
            <Box paddingTop={3}>
              <Typography variant="pi" textColor="danger600">
                {parsed.reason}
              </Typography>
            </Box>
          )}

          {parsed?.ok && (
            <Box paddingTop={3}>
              <Flex gap={2} alignItems="center" paddingBottom={2}>
                <Field.Root name="paste-header">
                  <Toggle
                    checked={usedHeader}
                    onLabel="Yes"
                    offLabel="No"
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      setHeader(event.target.checked)
                    }
                  />
                </Field.Root>
                <Typography variant="pi">
                  First row is a header
                  {header === undefined && ' (detected)'}
                </Typography>
              </Flex>

              <Typography variant="pi" fontWeight="bold">
                {parsed.table.labels.length} categories, {parsed.table.series.length} series:{' '}
                {parsed.table.series.map((one) => one.name).join(', ')}
              </Typography>

              {parsed.table.notes.map((note) => (
                <Typography key={note} variant="pi" textColor="neutral600" tag="p">
                  {note}
                </Typography>
              ))}

              <Box paddingTop={2}>
                <Typography variant="pi" textColor="warning600">
                  This replaces the current data.
                </Typography>
              </Box>
            </Box>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Cancel</Button>
          </Modal.Close>
          <Button
            disabled={!parsed?.ok}
            onClick={() => {
              if (!parsed?.ok) return;
              onApply(
                replaceData(
                  spec,
                  parsed.table.labels,
                  parsed.table.series,
                  origin
                    ? {
                        source: 'media',
                        fileId: origin.fileId,
                        url: origin.url,
                        name: origin.name,
                        importedAt: new Date().toISOString(),
                      }
                    : { source: 'inline' }
                )
              );
            }}
          >
            Replace data
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
