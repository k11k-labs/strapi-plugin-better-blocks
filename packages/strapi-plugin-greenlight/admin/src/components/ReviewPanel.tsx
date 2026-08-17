import * as React from 'react';

import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  Badge,
  Box,
  Button,
  Combobox,
  ComboboxOption,
  Field,
  Flex,
  Loader,
  SingleSelect,
  SingleSelectOption,
  Textarea,
  TextButton,
  Typography,
} from '@strapi/design-system';

import { formatWhen, notifyReviewChanged, routes } from '../api';
import type { AssignmentState, TransitionRow } from '../api';

interface Reviewer {
  id: number;
  name: string;
}

const PanelContent = ({
  model,
  documentId,
  locale,
  /**
   * Bumped by the Content Manager whenever it re-reads the document. Used purely
   * as a refresh signal - without it the panel loads once and then quietly goes
   * stale, so a stage change made in another tab never appears.
   */
  updatedAt,
}: {
  model: string;
  documentId: string;
  locale?: string | null;
  updatedAt?: string;
}) => {
  const { get, post } = useFetchClient();

  const [state, setState] = React.useState<AssignmentState | null>(null);
  const [reviewers, setReviewers] = React.useState<Reviewer[]>([]);
  const [history, setHistory] = React.useState<TransitionRow[]>([]);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const [comment, setComment] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await get<AssignmentState>(routes.assignment(model, documentId), {
        params: locale ? { locale } : {},
      });
      setState(data);
    } catch {
      setError('Could not load the review state for this document.');
    } finally {
      setLoading(false);
    }
  }, [get, model, documentId, locale]);

  React.useEffect(() => {
    load();
  }, [load, updatedAt]);

  React.useEffect(() => {
    get<{ reviewers: Reviewer[] }>(routes.reviewers)
      .then(({ data }) => setReviewers(data.reviewers))
      .catch(() => setReviewers([]));
  }, [get]);

  const fetchHistory = React.useCallback(async () => {
    try {
      const { data } = await get<{ history: TransitionRow[] }>(routes.history(model, documentId), {
        params: locale ? { locale } : {},
      });
      setHistory(data.history);
    } catch {
      setHistory([]);
    }
  }, [get, model, documentId, locale]);

  const toggleHistory = () => {
    const opening = !historyOpen;
    setHistoryOpen(opening);
    if (opening) void fetchHistory();
  };

  /**
   * A stage change saves immediately, with no separate Save button - the
   * behaviour Strapi users already expect from everything else in this column.
   */
  const moveTo = async (toStageId: number) => {
    if (!state?.assignment && !state?.workflow) return;
    setBusy(true);
    setError(null);
    try {
      await post(routes.stage(model, documentId), {
        toStageId,
        comment: comment.trim() || undefined,
        version: state?.assignment?.version ?? 0,
        locale: locale ?? null,
      });
      setComment('');
      await load();
      // Open history has to be refilled, not cleared: the move that just
      // happened is the entry the reviewer is looking for.
      if (historyOpen) await fetchHistory();
      // Tells the Publish button to re-read; it is a separate extension point.
      notifyReviewChanged();
    } catch (err: any) {
      // 409 is the one worth spelling out: someone else moved it while this
      // panel was open, and the fix is to look again rather than to retry.
      const status = err?.response?.status;
      setError(
        status === 409
          ? 'Someone else changed this document while you had it open. Refresh to see where it is now.'
          : (err?.response?.data?.error?.message ?? 'Could not change the stage.')
      );
    } finally {
      setBusy(false);
    }
  };

  const assignTo = async (assigneeId: number | null) => {
    setBusy(true);
    setError(null);
    try {
      await post(routes.assignee(model, documentId), {
        assigneeId,
        version: state?.assignment?.version ?? 0,
        locale: locale ?? null,
      });
      await load();
      notifyReviewChanged();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Could not set the reviewer.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Flex padding={4} justifyContent="center">
        <Loader small>Loading review state</Loader>
      </Flex>
    );
  }

  if (error && !state) {
    return (
      <Box padding={4}>
        <Typography textColor="danger600">{error}</Typography>
      </Box>
    );
  }

  const stage = state?.currentStage;
  const targets = state?.availableTargets ?? [];

  return (
    <Flex direction="column" alignItems="stretch" gap={4} width="100%">
      <Flex direction="column" alignItems="stretch" gap={2}>
        <Typography variant="sigma" textColor="neutral600">
          Stage
        </Typography>
        <Flex gap={2} alignItems="center">
          {/* Without a stage there is no configured colour to use, and the
              default one is white-on-light-grey - unreadable. */}
          {stage ? (
            <Badge backgroundColor={stage.color} textColor="neutral0">
              {stage.name}
            </Badge>
          ) : (
            <Badge backgroundColor="neutral150" textColor="neutral700">
              Not started
            </Badge>
          )}
          {stage?.isTerminal ? (
            <Typography variant="pi" textColor="success600">
              Approved - can be published
            </Typography>
          ) : (
            <Typography variant="pi" textColor="warning600">
              Not approved
            </Typography>
          )}
        </Flex>
      </Flex>

      {targets.length > 0 ? (
        <Field.Root name="greenlight-stage">
          <Field.Label>Move to</Field.Label>
          <SingleSelect
            placeholder="Choose a stage"
            value={undefined}
            disabled={busy}
            onChange={(value: string | number) => moveTo(Number(value))}
          >
            {targets.map((target) => (
              <SingleSelectOption key={target.id} value={String(target.id)}>
                {target.name}
              </SingleSelectOption>
            ))}
          </SingleSelect>
        </Field.Root>
      ) : (
        <Typography variant="pi" textColor="neutral600">
          Your role cannot move this document from here.
        </Typography>
      )}

      <Field.Root name="greenlight-comment">
        <Field.Label>Comment</Field.Label>
        <Textarea
          placeholder="Optional - kept in the log"
          value={comment}
          disabled={busy}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
            setComment(event.target.value)
          }
        />
      </Field.Root>

      <Field.Root name="greenlight-reviewer">
        <Field.Label>Reviewer</Field.Label>
        <Combobox
          placeholder="Nobody"
          value={state?.assignment?.assigneeId ? String(state.assignment.assigneeId) : undefined}
          disabled={busy}
          onClear={() => assignTo(null)}
          onChange={(value?: string) => assignTo(value ? Number(value) : null)}
        >
          {reviewers.map((reviewer) => (
            <ComboboxOption key={reviewer.id} value={String(reviewer.id)}>
              {reviewer.name}
            </ComboboxOption>
          ))}
        </Combobox>
      </Field.Root>

      {error ? (
        <Typography variant="pi" textColor="danger600">
          {error}
        </Typography>
      ) : null}

      <Box>
        <TextButton onClick={toggleHistory}>
          {historyOpen ? 'Hide history' : 'Show history'}
        </TextButton>
      </Box>

      {historyOpen ? (
        <Flex direction="column" alignItems="stretch" gap={2}>
          {history.length === 0 ? (
            <Typography variant="pi" textColor="neutral600">
              Nothing yet.
            </Typography>
          ) : (
            history.map((row) => (
              <Box key={row.id} paddingBottom={2}>
                <Typography variant="pi">
                  {row.fromStageName ? `${row.fromStageName} → ` : ''}
                  <strong>{row.toStageName}</strong>
                </Typography>
                <Typography variant="pi" textColor="neutral600" display="block">
                  {row.byUserName ?? 'system'} · {formatWhen(row.createdAt)}
                </Typography>
                {row.comment ? (
                  <Typography variant="pi" textColor="neutral700" display="block">
                    “{row.comment}”
                  </Typography>
                ) : null}
              </Box>
            ))
          )}
        </Flex>
      ) : null}
    </Flex>
  );
};

/**
 * Three states that are easy to miss, and all three show up on day one:
 * a content type with no workflow (render nothing at all), a document that has
 * not been saved yet (nothing to attach a stage to), and everything else.
 */
export const ReviewPanel = ({
  model,
  documentId,
  document,
}: {
  model: string;
  documentId?: string;
  document?: { updatedAt?: string; locale?: string | null };
}) => {
  if (!documentId) {
    return {
      title: 'Review',
      content: (
        <Box padding={2}>
          <Typography variant="pi" textColor="neutral600">
            Available once the entry has been saved.
          </Typography>
        </Box>
      ),
    };
  }

  return {
    title: 'Review',
    content: (
      <PanelContent
        model={model}
        documentId={documentId}
        locale={document?.locale}
        updatedAt={document?.updatedAt}
      />
    ),
  };
};

/** Used by the panel host to decide whether to render at all. */
export const useIsUnderReview = () => undefined;
