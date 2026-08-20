import * as React from 'react';

import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  Badge,
  Box,
  Button,
  Dialog,
  Divider,
  Flex,
  IconButton,
  Loader,
  TextButton,
  Typography,
} from '@strapi/design-system';
import { Pin } from '@strapi/icons';

import { ChangesDialog, type VersionDiff } from './ChangesDialog';

import { PLUGIN_ID } from '../pluginId';

interface VersionRow {
  id: number;
  locale: string | null;
  status: 'draft' | 'published' | 'modified';
  /** The entry's title at that point, so a row says what is inside it. */
  label: string | null;
  origin: string;
  pinned: boolean;
  createdAt: string;
  user: { id: number; name: string } | null;
}

interface RestorePreview {
  fieldsToRestore: string[];
  fieldsKeptAsIs: string[];
  fieldsDropped: string[];
  crossLocaleFields: string[];
  unsupportedFields: string[];
  brokenRelations: unknown[];
  missingMedia: unknown[];
  affectedLocales: string[];
}

/**
 * What each origin is called in the panel.
 *
 * These name what happened to the document, not what the plugin did. "Replaced
 * by restore" in particular: that version holds the state a restore was about
 * to overwrite, so it is the undo point for that restore - "Before restore"
 * read as a moment in time rather than a state you can go back to.
 */
const ORIGIN_LABEL: Record<string, string> = {
  create: 'Created',
  update: 'Edited',
  clone: 'Cloned',
  publish: 'Published',
  unpublish: 'Unpublished',
  discardDraft: 'Draft discarded',
  restore: 'Replaced by restore',
};

/**
 * Anchors are shown in a stronger colour: they are the points an editor
 * navigates by, and the ones that survive both deduplication and thinning.
 */
const ANCHOR_ORIGINS = new Set(['publish', 'unpublish', 'discardDraft', 'restore']);

const PAGE_SIZE = 10;

const formatWhen = (iso: string): string => {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return date.toLocaleString();
};

const PanelContent = ({
  model,
  documentId,
  /**
   * Changes whenever the Content Manager re-reads the document, which is what
   * it does after a save. Used purely as a refresh signal: without it the panel
   * fetches once on mount and then quietly goes stale, so the version you just
   * created by saving does not show up until the page is reloaded.
   */
  updatedAt,
}: {
  model: string;
  documentId: string;
  updatedAt?: string;
}) => {
  const { get, post, put } = useFetchClient();

  const [versions, setVersions] = React.useState<VersionRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [pending, setPending] = React.useState<{
    version: VersionRow;
    preview: RestorePreview;
  } | null>(null);
  const [restoring, setRestoring] = React.useState(false);

  const [changesOpen, setChangesOpen] = React.useState(false);
  const [changes, setChanges] = React.useState<VersionDiff | null>(null);
  const [changesLoading, setChangesLoading] = React.useState(false);

  const load = React.useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await get<{
          data: VersionRow[];
          meta: { total: number };
        }>(`/${PLUGIN_ID}/versions`, {
          params: {
            contentType: model,
            documentId,
            page: nextPage,
            pageSize: PAGE_SIZE,
          },
        });
        setVersions((rows) => (nextPage === 1 ? data.data : [...rows, ...data.data]));
        setTotal(data.meta.total);
        setPage(nextPage);
      } catch {
        setError('Could not load the history for this document.');
      } finally {
        setLoading(false);
      }
    },
    [get, model, documentId]
  );

  React.useEffect(() => {
    load(1);
  }, [load, updatedAt]);

  const showChanges = async (version: VersionRow) => {
    setChangesOpen(true);
    setChangesLoading(true);
    setChanges(null);
    try {
      const { data } = await get<{ data: VersionDiff }>(
        `/${PLUGIN_ID}/versions/${version.id}/diff`
      );
      setChanges(data.data);
    } catch {
      setChanges(null);
    } finally {
      setChangesLoading(false);
    }
  };

  /**
   * Optimistic, and reverted on failure.
   *
   * Pinning has no visible consequence until a prune runs weeks later, so a
   * spinner on the button would be the only feedback there is - and a pin that
   * waits for a round trip before it looks pinned reads as a broken button.
   */
  const togglePin = async (version: VersionRow) => {
    const pinned = !version.pinned;

    setVersions((rows) => rows.map((row) => (row.id === version.id ? { ...row, pinned } : row)));

    try {
      await put(`/${PLUGIN_ID}/versions/${version.id}/pin`, { pinned });
    } catch {
      setVersions((rows) =>
        rows.map((row) => (row.id === version.id ? { ...row, pinned: !pinned } : row))
      );
      setError(pinned ? 'Could not pin that version.' : 'Could not unpin that version.');
    }
  };

  const askToRestore = async (version: VersionRow) => {
    try {
      const { data } = await get<{ data: RestorePreview }>(
        `/${PLUGIN_ID}/versions/${version.id}/preview`
      );
      setPending({ version, preview: data.data });
    } catch {
      setError('Could not work out what restoring this version would change.');
    }
  };

  const confirmRestore = async () => {
    if (!pending) return;
    setRestoring(true);
    try {
      await post(`/${PLUGIN_ID}/versions/${pending.version.id}/restore`, {});
      // The edit view holds the old values in its own form state, so the
      // document has to be re-read rather than merely re-rendered.
      window.location.reload();
    } catch {
      setError('The restore failed. Nothing was changed.');
      setRestoring(false);
      setPending(null);
    }
  };

  if (loading && versions.length === 0) {
    return (
      <Flex justifyContent="center" padding={4}>
        <Loader small>Loading history</Loader>
      </Flex>
    );
  }

  if (error && versions.length === 0) {
    return (
      <Typography variant="pi" textColor="danger600">
        {error}
      </Typography>
    );
  }

  if (versions.length === 0) {
    return (
      <Typography variant="pi" textColor="neutral600">
        No versions yet. The next time this document is saved, a version will appear here.
      </Typography>
    );
  }

  return (
    <Flex direction="column" alignItems="stretch" gap={2} width="100%">
      {versions.map((version) => (
        <Box key={version.id} paddingBottom={2}>
          <Flex justifyContent="space-between" alignItems="center" gap={2}>
            {/*
              minWidth 0 is what makes the title truncate instead of growing:
              a flex child defaults to min-width auto, so a long title widens
              this column and pushes the Restore button out of the panel.
            */}
            <Flex direction="column" alignItems="flex-start" gap={1} grow={1} minWidth={0}>
              <Flex gap={2} alignItems="center">
                <Badge
                  backgroundColor={ANCHOR_ORIGINS.has(version.origin) ? 'primary100' : 'neutral150'}
                  textColor={ANCHOR_ORIGINS.has(version.origin) ? 'primary600' : 'neutral600'}
                >
                  {ORIGIN_LABEL[version.origin] ?? version.origin}
                </Badge>
                {version.locale ? (
                  <Typography variant="pi" textColor="neutral500">
                    {version.locale}
                  </Typography>
                ) : null}
              </Flex>
              {version.label ? (
                <Box width="100%">
                  <Typography variant="omega" textColor="neutral800" ellipsis>
                    {version.label}
                  </Typography>
                </Box>
              ) : null}
              <Typography variant="pi" textColor="neutral600">
                {formatWhen(version.createdAt)}
                {version.user ? ` · ${version.user.name}` : ''}
                {/*
                  The pin icon alone says this in colour, on sixteen pixels.
                  That is not enough on its own - not for a glance down a list
                  of ten rows, and not for anyone who does not separate those
                  two colours - so the state is spelled out here as well.
                */}
                {version.pinned ? (
                  <Typography variant="pi" textColor="primary600" fontWeight="bold">
                    {' · Pinned'}
                  </Typography>
                ) : null}
              </Typography>
              <TextButton onClick={() => showChanges(version)}>What changed</TextButton>
            </Flex>

            <Flex shrink={0} gap={1} alignItems="center">
              <IconButton
                size="S"
                variant="ghost"
                label={
                  version.pinned
                    ? 'Unpin this version, so tidying up can remove it'
                    : 'Pin this version, so tidying up never removes it'
                }
                onClick={() => togglePin(version)}
              >
                <Pin fill={version.pinned ? 'primary600' : 'neutral500'} />
              </IconButton>
              <Button size="S" variant="tertiary" onClick={() => askToRestore(version)}>
                Restore
              </Button>
            </Flex>
          </Flex>
          <Box paddingTop={2}>
            <Divider />
          </Box>
        </Box>
      ))}

      {versions.length < total ? (
        <Button size="S" variant="tertiary" loading={loading} onClick={() => load(page + 1)}>
          Show older versions
        </Button>
      ) : null}

      {error ? (
        <Typography variant="pi" textColor="danger600">
          {error}
        </Typography>
      ) : null}

      {changesOpen ? (
        <ChangesDialog
          diff={changes}
          loading={changesLoading}
          onClose={() => setChangesOpen(false)}
        />
      ) : null}

      <Dialog.Root open={pending !== null} onOpenChange={() => setPending(null)}>
        <Dialog.Content>
          <Dialog.Header>Restore this version?</Dialog.Header>
          <Dialog.Body>
            <Flex direction="column" alignItems="flex-start" gap={2}>
              <Typography>
                The current draft is saved as a version first, so this can be undone. The published
                version is not touched.
              </Typography>

              {pending?.preview.crossLocaleFields.length ? (
                <Typography textColor="danger600">
                  {pending.preview.crossLocaleFields.join(', ')}{' '}
                  {pending.preview.crossLocaleFields.length === 1 ? 'is' : 'are'} not translated per
                  locale, so restoring{' '}
                  {pending.preview.crossLocaleFields.length === 1 ? 'it' : 'them'} changes{' '}
                  {pending.preview.affectedLocales.length} locales at once:{' '}
                  {pending.preview.affectedLocales.join(', ')}.
                </Typography>
              ) : null}

              {pending?.preview.fieldsKeptAsIs.length ? (
                <Typography variant="pi" textColor="neutral600">
                  Added since this version and left untouched:{' '}
                  {pending.preview.fieldsKeptAsIs.join(', ')}.
                </Typography>
              ) : null}

              {pending?.preview.fieldsDropped.length ? (
                <Typography variant="pi" textColor="neutral600">
                  No longer in the model and skipped: {pending.preview.fieldsDropped.join(', ')}.
                </Typography>
              ) : null}

              {pending?.preview.brokenRelations.length || pending?.preview.missingMedia.length ? (
                <Typography variant="pi" textColor="warning600">
                  {(pending.preview.brokenRelations.length ?? 0) +
                    (pending.preview.missingMedia.length ?? 0)}{' '}
                  linked item(s) no longer exist and will be left out.
                </Typography>
              ) : null}
            </Flex>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary" disabled={restoring}>
                Cancel
              </Button>
            </Dialog.Cancel>
            <Button onClick={confirmRestore} loading={restoring}>
              Restore
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
};

/**
 * The panel itself.
 *
 * Returning null while there is no `documentId` keeps it out of the way on the
 * create screen, where there is nothing to have a history of yet.
 */
export const HistoryPanel = ({
  model,
  documentId,
  document,
}: {
  model: string;
  documentId?: string;
  document?: { updatedAt?: string };
}) => {
  if (!documentId) return null;

  return {
    title: 'History',
    content: <PanelContent model={model} documentId={documentId} updatedAt={document?.updatedAt} />,
  };
};
