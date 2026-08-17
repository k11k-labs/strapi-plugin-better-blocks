import assignment from './assignment/schema.json';
import stage from './stage/schema.json';
import transition from './transition/schema.json';
import workflow from './workflow/schema.json';

/**
 * The four tables.
 *
 * `relatedDocumentId`, not `documentId`: Strapi injects a `documentId` into every
 * content type and refuses the name outright — "The attribute "documentId" is
 * reserved and cannot be used in a model" — at boot, before anything else runs.
 * Rewind's version model carries the same name for the same reason. The related
 * trap is `createdById`, which collides with the `createdBy` relation Strapi adds
 * itself, and is why the reviewer here is `assigneeId` and the author of a
 * transition is `byUserId`.
 *
 * `relatedDocumentId` is a plain string rather than a relation because a relation
 * to "any content type" is polymorphic and painful, and because deleting a
 * document must not cascade into the log of what happened to it.
 *
 * `stageId` on an assignment is likewise a plain integer rather than a relation:
 * deleting a stage has to move its pending assignments somewhere (see
 * `workflow.deleteStage`), which is explicit code either way, and a relation would
 * only add ORM cascade behaviour to fight with.
 */
export default {
  workflow: { schema: workflow },
  stage: { schema: stage },
  assignment: { schema: assignment },
  transition: { schema: transition },
};
