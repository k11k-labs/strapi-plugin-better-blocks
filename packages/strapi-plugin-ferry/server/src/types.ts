/** What a file is written as, and read back from. */
export type Format = 'json' | 'csv';

/** Which version of a document to move. */
export type Status = 'draft' | 'published';

/**
 * A field, sorted into the one bucket that decides how it travels.
 *
 * The buckets are not cosmetic. A scalar is copied, a relation is a key that
 * has to be resolved on the far side, a component is nested data with no
 * identity of its own, and a media field is a pointer to a binary this plugin
 * does not carry. Code that treats them alike is code that loses one of them.
 */
export interface ScalarField {
  name: string;
  type: string;
}

export interface RelationField {
  name: string;
  target: string;
  many: boolean;
}

export interface ComponentField {
  name: string;
  component: string;
  repeatable: boolean;
}

export interface DynamicZoneField {
  name: string;
  components: string[];
}

export interface MediaField {
  name: string;
  many: boolean;
}

/** Everything Ferry needs to know about one content type, worked out once. */
export interface Plan {
  uid: string;
  kind: 'collectionType' | 'singleType';
  draftAndPublish: boolean;
  localized: boolean;
  scalars: ScalarField[];
  relations: RelationField[];
  components: ComponentField[];
  dynamicZones: DynamicZoneField[];
  media: MediaField[];
  /** Field names deliberately left out, and why - surfaced in the UI. */
  skipped: Array<{ name: string; reason: string }>;
}

export interface ExportOptions {
  uid: string;
  format: Format;
  status: Status;
  locale?: string;
  /** Export exactly these documents. Used by the Content Manager list view. */
  documentIds?: string[];
  /** Content Manager filters, passed through untouched. */
  filters?: Record<string, unknown>;
  sort?: string;
  limit?: number;
  relations: boolean;
  media: boolean;
}

/** A document as it appears in a file: plain data, keyed by documentId. */
export type ExportedDocument = Record<string, unknown> & { documentId: string };

/**
 * The file itself.
 *
 * Deliberately without a timestamp. An export is content, and content that
 * changes on every run cannot be committed to a repository and diffed, which is
 * the whole point of being able to read it. Git already knows when the file
 * arrived.
 */
export interface Archive {
  /** Format version, so a future reader can refuse a file it cannot read. */
  ferry: 1;
  contentType: string;
  status: Status;
  locale?: string;
  count: number;
  documents: ExportedDocument[];
}

export type RowOutcome = 'create' | 'update' | 'skip' | 'error';

export interface RowReport {
  /** 1-based position in the file, so a message can name a line. */
  row: number;
  documentId?: string;
  outcome: RowOutcome;
  message?: string;
}

export interface UnresolvedRelation {
  row: number;
  documentId?: string;
  field: string;
  target: string;
  /** The keys that point at nothing, capped for display. */
  keys: string[];
}

/**
 * What a dry run says, and what an applied import reports afterwards.
 *
 * The same shape both times on purpose: the preview and the receipt are the
 * same document, so what you approved is what you can check against.
 */
export interface Report {
  contentType: string;
  /** False for a dry run - nothing was written. */
  applied: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errored: number;
  rows: RowReport[];
  unresolved: UnresolvedRelation[];
  warnings: string[];
}

export interface ImportOptions {
  uid: string;
  status: Status;
  locale?: string;
  /** What to do when a document with this documentId is already there. */
  onExisting: 'update' | 'skip';
  /**
   * What to do when a relation points at a document that is not in the file and
   * not in the database. Dropping the field keeps the row; failing keeps the
   * content honest. Neither is right for everyone, so it is a choice.
   */
  onMissingRelation: 'skip' | 'fail';
  /** Publish what the file recorded as published. */
  publish: boolean;
  /**
   * Keep going past a row that fails, and commit the rest.
   *
   * Off by default, which makes an import all or nothing: a run that hits an
   * error rolls back and the database is exactly as it was. A half-applied
   * import is the worst outcome available - worse than a failed one, because
   * nobody knows which half - so opting into it has to be deliberate.
   */
  continueOnError: boolean;
}
