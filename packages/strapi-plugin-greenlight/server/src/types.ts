export interface Stage {
  id: number;
  name: string;
  color: string;
  order: number;
  isTerminal: boolean;
  /** Admin role ids. Empty means "anyone with access to the plugin", not "nobody". */
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

export interface Assignment {
  id: number;
  relatedDocumentId: string;
  contentTypeUid: string;
  /** Never null — see utils/locale. */
  locale: string;
  stageId: number;
  assigneeId: number | null;
  version: number;
}

export interface Transition {
  id: number;
  relatedDocumentId: string;
  contentTypeUid: string;
  locale: string;
  fromStageId: number | null;
  toStageId: number;
  fromStageName: string | null;
  toStageName: string;
  byUserId: number | null;
  byUserName: string | null;
  comment: string | null;
  createdAt: string;
}

export interface AdminUser {
  id: number;
  firstname?: string;
  lastname?: string;
  username?: string;
  email?: string;
  roles?: Array<{ id: number; code?: string }>;
}

export interface WorkflowInput {
  name: string;
  contentTypes: string[];
  enforcePublishGate?: boolean;
  onMissingAssignment?: 'firstStage' | 'allow';
  stages: Array<{
    id?: number;
    name: string;
    color?: string;
    order: number;
    isTerminal?: boolean;
    rolesCanMoveFrom?: number[];
    rolesCanMoveTo?: number[];
  }>;
}
