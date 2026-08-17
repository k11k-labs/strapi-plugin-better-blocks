import { PLUGIN_ID } from './pluginId';

export interface Stage {
  id: number;
  name: string;
  color: string;
  order: number;
  isTerminal: boolean;
  rolesCanMoveFrom: number[];
  rolesCanMoveTo: number[];
}

export interface Workflow {
  id: number;
  name: string;
  contentTypes: string[];
  enforcePublishGate: boolean;
  onMissingAssignment: 'firstStage' | 'allow';
  stages: Stage[];
}

export interface AssignmentState {
  workflow: Pick<Workflow, 'id' | 'name' | 'enforcePublishGate' | 'stages'> | null;
  assignment: {
    id: number;
    stageId: number;
    assigneeId: number | null;
    version: number;
    locale: string | null;
  } | null;
  currentStage: Stage | null;
  availableTargets: Stage[];
  isPublishable: boolean;
}

export interface TransitionRow {
  id: number;
  fromStageName: string | null;
  toStageName: string;
  byUserName: string | null;
  comment: string | null;
  createdAt: string;
}

export interface QueueItem {
  id: number;
  documentId: string;
  contentTypeUid: string;
  contentTypeName: string;
  locale: string | null;
  title: string;
  stage: { id: number; name: string; color: string } | null;
  assigneeId: number | null;
  lastTransitionAt: string | null;
}

export const routes = {
  assignment: (uid: string, documentId: string) => `/${PLUGIN_ID}/assignments/${uid}/${documentId}`,
  stage: (uid: string, documentId: string) =>
    `/${PLUGIN_ID}/assignments/${uid}/${documentId}/stage`,
  assignee: (uid: string, documentId: string) =>
    `/${PLUGIN_ID}/assignments/${uid}/${documentId}/assignee`,
  history: (uid: string, documentId: string) =>
    `/${PLUGIN_ID}/assignments/${uid}/${documentId}/history`,
  queue: `/${PLUGIN_ID}/queue`,
  workflows: `/${PLUGIN_ID}/workflows`,
  workflow: (id: number) => `/${PLUGIN_ID}/workflows/${id}`,
  contentTypes: `/${PLUGIN_ID}/workflows/content-types`,
  reviewers: `/${PLUGIN_ID}/workflows/reviewers`,
  roles: `/${PLUGIN_ID}/workflows/roles`,
};

/**
 * Broadcast when a document's review state changes.
 *
 * The side panel and the Publish button are two separate Content Manager
 * extension points with no shared state and no way to pass props between them —
 * so without this the panel updates on a stage change and the button carries on
 * showing "needs approval" until the page is reloaded. A window event is the only
 * channel the two actually share.
 */
export const REVIEW_CHANGED = 'greenlight:review-changed';

export const notifyReviewChanged = (): void => {
  window.dispatchEvent(new CustomEvent(REVIEW_CHANGED));
};

export const formatWhen = (iso: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return date.toLocaleDateString();
};
