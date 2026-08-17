import { AsyncLocalStorage } from 'node:async_hooks';

export type Origin =
  'create' | 'update' | 'clone' | 'publish' | 'unpublish' | 'discardDraft' | 'restore';

export interface SnapshotIntent {
  uid: string;
  relatedDocumentId: string;
  locale: string | null;
  origin: Origin;
  /** Rows read before the action ran. Only `discardDraft` needs these. */
  before: Record<string, unknown>[] | null;
}

/**
 * Order of preference when two intents collide on the same document and locale.
 *
 * Anchors win over ordinary edits, so the Content Manager's update-then-publish
 * pair records a single `publish` version rather than two.
 */
const ORIGIN_PRIORITY: Origin[] = [
  'restore',
  'publish',
  'unpublish',
  'discardDraft',
  'clone',
  'create',
  'update',
];

/**
 * Intents buffered against the transaction they belong to.
 *
 * Keyed by the Knex transaction object because that is the only thing the
 * Content Manager's `update` and `publish` calls have in common — they are
 * sequential siblings, not nested, so nothing about the call stack relates
 * them. Strapi hands the same `trx` to every nested `db.transaction`, which
 * makes it a reliable key, and a WeakMap means a finished transaction takes its
 * buffer with it.
 *
 * Deliberately not an AsyncLocalStorage: commit callbacks run after the
 * transaction resolves, outside whatever async context registered them, so a
 * store looked up at flush time is always empty. The callback has to close over
 * the buffer directly.
 */
interface TransactionBuffer {
  intents: SnapshotIntent[];
  flushRegistered: boolean;
}

const buffers = new WeakMap<object, TransactionBuffer>();

export const bufferFor = (trx: object): TransactionBuffer => {
  let buffer = buffers.get(trx);
  if (!buffer) {
    buffer = { intents: [], flushRegistered: false };
    buffers.set(trx, buffer);
  }
  return buffer;
};

/**
 * Collapses intents that describe the same document and locale, keeping the one
 * that best describes what the editor did.
 */
export const coalesce = (intents: SnapshotIntent[]): SnapshotIntent[] => {
  const byDocument = new Map<string, SnapshotIntent>();

  for (const intent of intents) {
    const key = `${intent.uid}:${intent.relatedDocumentId}:${intent.locale ?? ''}`;
    const current = byDocument.get(key);

    if (!current) {
      byDocument.set(key, intent);
      continue;
    }

    const isBetter =
      ORIGIN_PRIORITY.indexOf(intent.origin) < ORIGIN_PRIORITY.indexOf(current.origin);

    byDocument.set(key, {
      // A winning `publish` still wants the rows an earlier `discardDraft`
      // captured — losing them would lose the only copy of that state.
      ...(isBetter ? intent : current),
      before: current.before ?? intent.before,
    });
  }

  return [...byDocument.values()];
};

const restoreStorage = new AsyncLocalStorage<{ active: boolean }>();

/**
 * Marks the current async context as a restore, so the write restore performs
 * is not also recorded as an ordinary edit.
 *
 * An async-context flag is the right tool here and the wrong one for publish:
 * `restore.apply()` calls the Document Service from inside its own call stack,
 * so the write genuinely is nested. The Content Manager's publish is not.
 */
export const runAsRestore = <T>(fn: () => Promise<T>): Promise<T> =>
  restoreStorage.run({ active: true }, fn);

export const isRestoreInProgress = (): boolean => restoreStorage.getStore()?.active === true;
