import * as React from 'react';

import { useFetchClient, useField } from '@strapi/admin/strapi-admin';
import { Badge, SingleSelect, SingleSelectOption, Typography } from '@strapi/design-system';

import { modelFromPath, primeCoverage, stagesFor } from '../coverage';
import { loadReviewState } from '../reviewBatch';
import type { ReviewEntry } from '../reviewBatch';
import { PLUGIN_ID } from '../pluginId';

/**
 * The Content Manager's own hook names, as literals.
 *
 * `@strapi/content-manager` exports them as constants, but only from a deep
 * internal path with no entry point pointing at it — importing that would be
 * reaching into someone else's `dist`. The strings are the public contract; the
 * import is not.
 */
export const INJECT_COLUMN_IN_TABLE = 'Admin/CM/pages/ListView/inject-column-in-table';
export const INJECT_LIST_VIEW_FILTERS = 'Admin/CM/pages/ListView/inject-in-filters';

const COLUMN_NAME = 'greenlight-stage';

/** The query key the filter writes, and the server middleware reads back. */
export const FILTER_NAME = 'greenlightStage';

/* ------------------------------------------------------------------ *
 * The cell
 * ------------------------------------------------------------------ */

const StageCell = ({
  uid,
  documentId,
  locale,
}: {
  uid: string;
  documentId: string;
  locale: string | null;
}) => {
  const { get } = useFetchClient();
  const [entry, setEntry] = React.useState<ReviewEntry | null>(null);

  React.useEffect(() => {
    let alive = true;

    loadReviewState(get, uid, documentId, locale).then((data) => alive && setEntry(data));

    return () => {
      alive = false;
    };
  }, [get, uid, documentId, locale]);

  // Still loading, or the content type turned out not to be under review after
  // all — the cached coverage can be a workflow edit out of date.
  if (!entry || !entry.workflow) return null;

  const state = entry.state;

  // No stage at all: never reviewed, under a workflow that lets those through.
  if (!state || !state.stageName) {
    return (
      <Typography textColor="neutral500" variant="pi">
        —
      </Typography>
    );
  }

  return (
    <Badge
      backgroundColor={state.assigned ? (state.stageColor ?? 'neutral150') : 'neutral150'}
      textColor={state.assigned ? 'neutral0' : 'neutral600'}
    >
      {state.stageName}
    </Badge>
  );
};

/* ------------------------------------------------------------------ *
 * The column
 * ------------------------------------------------------------------ */

interface ColumnPayload {
  displayedHeaders: Array<Record<string, unknown>>;
  /** `{ layout, settings, metadatas, options }` — note there is no uid on it. */
  layout: Record<string, unknown>;
}

/**
 * Adds a "Review stage" column to the Content Manager's list view.
 *
 * A waterfall hook: it is handed the headers and must hand them back, changed
 * or not. Returning nothing removes every column in the table.
 */
export const injectStageColumn = (payload: ColumnPayload): ColumnPayload => {
  // Kept warm for the next list view, and self-healing if the first attempt ran
  // before the user had a session.
  void primeCoverage();

  const uid = modelFromPath();
  if (!uid || !stagesFor(uid)) return payload;
  if (payload.displayedHeaders.some((header) => header.name === COLUMN_NAME)) return payload;

  return {
    ...payload,
    displayedHeaders: [
      ...payload.displayedHeaders,
      {
        name: COLUMN_NAME,
        attribute: { type: 'custom' },
        // An intl descriptor rather than a plain string: a string is treated as
        // an attribute name and looked up under this content type's own
        // translation keys.
        label: {
          id: `${PLUGIN_ID}.listView.stage`,
          defaultMessage: 'Review stage',
        },
        searchable: false,
        // Sorting would have to happen inside the Content Manager's own query,
        // which cannot see this plugin's table. Better greyed out than sorting
        // by nothing.
        sortable: false,
        cellFormatter: (
          row: { documentId: string; locale?: string | null },
          _header: unknown,
          { model }: { model: string }
        ) => <StageCell uid={model} documentId={row.documentId} locale={row.locale ?? null} />,
      },
    ],
  };
};

/* ------------------------------------------------------------------ *
 * The filter
 * ------------------------------------------------------------------ */

interface FilterPayload {
  displayedFilters: Array<Record<string, unknown>>;
  layout: Record<string, unknown>;
}

interface FilterOption {
  label: string;
  value: string;
}

/**
 * The stage picker inside the filter popover.
 *
 * The default renderer would produce the same dropdown from `options` alone, so
 * this exists for the *chip*: the applied-filter tag only translates a value
 * back into its label when the filter declares its own `input`, and without one
 * an editor is left reading "Review stage is 2".
 */
const StageFilterInput = ({ name, options }: { name: string; options?: FilterOption[] }) => {
  const field = useField<string>(name);

  return (
    <SingleSelect
      aria-label="Review stage"
      value={field.value ?? ''}
      onChange={(value: string | number) => field.onChange(name, String(value))}
    >
      {(options ?? []).map((option) => (
        <SingleSelectOption key={option.value} value={option.value}>
          {option.label}
        </SingleSelectOption>
      ))}
    </SingleSelect>
  );
};

/**
 * Adds a "Review stage" filter to the list view.
 *
 * The value written into the URL is a stage id, which means nothing to the
 * Content Manager's own query — a stage is not a field on anyone's content
 * type. A middleware on the server rewrites it into a `documentId` filter
 * before the query is validated; see `server/src/middlewares/stageFilter.ts`,
 * without which this control would produce a 400 rather than a result.
 *
 * Only `$eq` and `$ne` are offered. Every other operator the Content Manager
 * knows — contains, greater-than, null checks — either means nothing for a
 * stage or would have to be answered with a scan, and an operator that silently
 * does the wrong thing is worse than one that is not in the list.
 */
export const injectStageFilter = (payload: FilterPayload): FilterPayload => {
  void primeCoverage();

  const uid = modelFromPath();
  const stages = uid ? stagesFor(uid) : null;
  if (!stages || stages.length === 0) return payload;
  if (payload.displayedFilters.some((filter) => filter.name === FILTER_NAME)) return payload;

  return {
    ...payload,
    displayedFilters: [
      ...payload.displayedFilters,
      {
        name: FILTER_NAME,
        label: { id: `${PLUGIN_ID}.listView.stage`, defaultMessage: 'Review stage' },
        type: 'enumeration',
        input: StageFilterInput,
        operators: [
          { value: '$eq', label: { id: `${PLUGIN_ID}.filter.is`, defaultMessage: 'is' } },
          { value: '$ne', label: { id: `${PLUGIN_ID}.filter.isNot`, defaultMessage: 'is not' } },
        ],
        options: stages.map((stage) => ({ label: stage.name, value: String(stage.id) })),
      },
    ],
  };
};
