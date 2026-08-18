import { PLUGIN_ID } from './pluginId';

export type Format = 'json' | 'csv';
export type Status = 'draft' | 'published';

export interface CatalogueEntry {
  uid: string;
  label: string;
  kind: 'collectionType' | 'singleType';
}

export interface FieldPlan {
  uid: string;
  kind: 'collectionType' | 'singleType';
  draftAndPublish: boolean;
  localized: boolean;
  scalars: Array<{ name: string; type: string }>;
  relations: Array<{ name: string; target: string; many: boolean }>;
  components: Array<{ name: string; component: string; repeatable: boolean }>;
  dynamicZones: Array<{ name: string; components: string[] }>;
  media: Array<{ name: string; many: boolean }>;
  skipped: Array<{ name: string; reason: string }>;
}

export interface RowReport {
  row: number;
  documentId?: string;
  outcome: 'create' | 'update' | 'skip' | 'error';
  message?: string;
}

export interface UnresolvedRelation {
  row: number;
  documentId?: string;
  field: string;
  target: string;
  keys: string[];
}

export interface Report {
  contentType: string;
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

export const routes = {
  contentTypes: `/${PLUGIN_ID}/content-types`,
  plan: (uid: string) => `/${PLUGIN_ID}/plan/${uid}`,
  export: `/${PLUGIN_ID}/export`,
  preview: `/${PLUGIN_ID}/import/preview`,
  apply: `/${PLUGIN_ID}/import`,
};

export interface ExportRequest {
  uid: string;
  format: Format;
  status: Status;
  relations: boolean;
  media: boolean;
  documentIds?: string[];
}

export interface ImportRequest {
  uid: string;
  status: Status;
  onExisting: 'update' | 'skip';
  onMissingRelation: 'skip' | 'fail';
  publish: boolean;
  continueOnError: boolean;
}

export const DEFAULT_EXPORT: Omit<ExportRequest, 'uid'> = {
  format: 'json',
  status: 'draft',
  relations: true,
  media: true,
};

export const DEFAULT_IMPORT: Omit<ImportRequest, 'uid'> = {
  status: 'draft',
  onExisting: 'update',
  onMissingRelation: 'skip',
  publish: true,
  continueOnError: false,
};

/**
 * The export, as JSON with the file inside it.
 *
 * Asked for with `envelope: true`. The alternative is a real download, which is
 * what a curl user wants and what the admin panel cannot use: Strapi's fetch
 * client parses every response as JSON whatever `responseType` it is given.
 */
export interface ExportEnvelope {
  filename: string;
  mime: string;
  body: string;
  count: number;
  warnings: string[];
}

/**
 * Hands the browser a file it already has.
 *
 * Not a link to the export route: an admin endpoint needs the session's
 * Authorization header, and a plain navigation cannot send one - which is the
 * single most reported fault against the plugin this replaces, where four of
 * eleven open issues are a 401 on download.
 */
export const saveFile = (body: BlobPart, filename: string, mime: string): void => {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** A summary line for the report, in the order that matters when scanning it. */
export const summarise = (report: Report): string =>
  [
    report.created > 0 ? `${report.created} to create` : null,
    report.updated > 0 ? `${report.updated} to update` : null,
    report.skipped > 0 ? `${report.skipped} skipped` : null,
    report.errored > 0 ? `${report.errored} failed` : null,
  ]
    .filter(Boolean)
    .join(', ') || 'nothing to do';
