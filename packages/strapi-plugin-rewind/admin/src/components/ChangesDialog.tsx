import * as React from 'react';

import {
  Box,
  Button,
  Flex,
  Loader,
  Modal,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from '@strapi/design-system';

import { getDiffRenderer, type FieldChange, type DiffSpan } from '../diffRegistry';

export interface VersionDiff {
  from: { id: number; label: string | null; origin: string } | null;
  to: { id: number; label: string | null; origin: string };
  changes: FieldChange[];
  identical: boolean;
}

/** Added and removed words shown inline, the way prose edits are read. */
const Spans = ({ spans }: { spans: DiffSpan[] }) => (
  <Typography variant="omega" tag="p">
    {spans.map((span, index) => {
      if (span.op === 'equal') {
        return (
          <Typography key={index} variant="omega" textColor="neutral600">
            {span.value}
          </Typography>
        );
      }

      return (
        <Typography
          key={index}
          variant="omega"
          textColor={span.op === 'added' ? 'success600' : 'danger600'}
          style={span.op === 'removed' ? { textDecoration: 'line-through' } : { fontWeight: 600 }}
        >
          {span.value}
        </Typography>
      );
    })}
  </Typography>
);

const asText = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const Change = ({ change }: { change: FieldChange }) => {
  // A package that owns this field type can render it far better than a word
  // diff can - see diffRegistry. The custom field uid wins over the storage
  // type, because every custom field stores itself as `json` and a renderer
  // registered for `json` would claim all of them.
  const Custom =
    (change.customField ? getDiffRenderer(change.customField) : undefined) ??
    getDiffRenderer(change.type);
  if (Custom) return <Custom change={change} />;

  if (change.spans) return <Spans spans={change.spans} />;

  if (change.linked || change.unlinked) {
    return (
      <Flex direction="column" alignItems="flex-start" gap={1}>
        {change.linked?.length ? (
          <Typography variant="pi" textColor="success600">
            + {change.linked.length} linked
          </Typography>
        ) : null}
        {change.unlinked?.length ? (
          <Typography variant="pi" textColor="danger600">
            − {change.unlinked.length} unlinked
          </Typography>
        ) : null}
      </Flex>
    );
  }

  if (change.before !== undefined || change.after !== undefined) {
    return (
      <Flex gap={2} alignItems="center" wrap="wrap">
        <Typography
          variant="omega"
          textColor="danger600"
          style={{ textDecoration: 'line-through' }}
        >
          {asText(change.before)}
        </Typography>
        <Typography variant="omega" textColor="neutral500">
          →
        </Typography>
        <Typography variant="omega" textColor="success600">
          {asText(change.after)}
        </Typography>
      </Flex>
    );
  }

  // The stored value moved but the readable text did not: a mark was applied,
  // a block was reordered, something changed that this diff cannot describe.
  return (
    <Typography variant="pi" textColor="neutral600">
      Formatting or structure changed; the text is the same.
    </Typography>
  );
};

/**
 * The comparison target lives here rather than in the panel.
 *
 * Picking two versions needs somewhere to put the second choice, and the panel
 * is a narrow column whose rows already carry a badge, a title, a timestamp, a
 * pin and a Restore button. Putting the choice beside the result also means the
 * common case - compare with the one before - stays a single click, and the
 * other question only costs a dropdown once you are already looking at a diff.
 */
export const ChangesDialog = ({
  diff,
  loading,
  onClose,
  subject,
  options,
  againstId,
  onChangeAgainst,
  hasUnloadedVersions,
}: {
  diff: VersionDiff | null;
  loading: boolean;
  onClose: () => void;
  /** How the version this was opened from reads, e.g. "Edited · 2 min ago". */
  subject: string;
  /** Every other loaded version of the same document, already described. */
  options: Array<{ id: number; name: string }>;
  /** null means the version saved immediately before the subject. */
  againstId: number | null;
  onChangeAgainst: (againstId: number | null) => void;
  /** Whether the panel is still holding older versions back behind its pager. */
  hasUnloadedVersions: boolean;
}) => (
  <Modal.Root open onOpenChange={onClose}>
    <Modal.Content>
      <Modal.Header>
        <Modal.Title>What changed</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Flex direction="column" alignItems="stretch" gap={2} paddingBottom={4}>
          <Typography variant="pi" textColor="neutral600">
            Comparing <b>{subject}</b> with
          </Typography>
          <SingleSelect
            aria-label="Compare with"
            size="S"
            value={againstId ?? 'previous'}
            onChange={(value) => onChangeAgainst(value === 'previous' ? null : Number(value))}
          >
            <SingleSelectOption value="previous">
              The version saved just before it
            </SingleSelectOption>
            {options.map((option) => (
              <SingleSelectOption key={option.id} value={option.id}>
                {option.name}
              </SingleSelectOption>
            ))}
          </SingleSelect>
          {hasUnloadedVersions ? (
            <Typography variant="pi" textColor="neutral600">
              Only versions loaded in the panel are listed. Use <b>Show older versions</b> there to
              reach further back.
            </Typography>
          ) : null}
        </Flex>

        {loading ? (
          <Flex justifyContent="center" padding={4}>
            <Loader small>Comparing</Loader>
          </Flex>
        ) : !diff ? (
          <Typography textColor="danger600">Could not compare these versions.</Typography>
        ) : (
          <Flex direction="column" alignItems="stretch" gap={4}>
            {!diff.from ? (
              <Typography variant="pi" textColor="neutral600">
                This is the earliest version of the document, so everything in it is new.
              </Typography>
            ) : null}

            {diff.identical ? (
              <Typography textColor="neutral600">
                Nothing changed between these two versions.
              </Typography>
            ) : (
              diff.changes.map((change) => (
                <Box key={change.field}>
                  <Typography variant="sigma" textColor="neutral600">
                    {change.field}
                  </Typography>
                  <Box paddingTop={1}>
                    <Change change={change} />
                  </Box>
                </Box>
              ))
            )}
          </Flex>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="tertiary" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal.Content>
  </Modal.Root>
);
