/**
 * Admin routes.
 *
 * Reading and configuring are separate permissions: a reviewer needs to see the
 * queue and move documents, and has no business rewriting the workflow everyone
 * else is working to.
 *
 * `plugin::greenlight.assign` guards only *who reviews*. Moving a document
 * between stages is guarded by the stage's own role lists, checked inside the
 * service, because the answer depends on where the document currently is.
 */
const policy = (name: string) => [`plugin::greenlight.${name}`];

export default {
  type: 'admin',
  routes: [
    {
      method: 'GET',
      path: '/assignments/:uid',
      handler: 'assignment.findMany',
      config: { policies: policy('canRead') },
    },
    {
      method: 'GET',
      path: '/assignments/:uid/:documentId',
      handler: 'assignment.find',
      config: { policies: policy('canRead') },
    },
    {
      method: 'POST',
      path: '/assignments/:uid/:documentId/stage',
      handler: 'assignment.transition',
      config: { policies: policy('canRead') },
    },
    {
      method: 'POST',
      path: '/assignments/:uid/:documentId/assignee',
      handler: 'assignment.assign',
      config: { policies: policy('canAssign') },
    },
    {
      method: 'GET',
      path: '/assignments/:uid/:documentId/history',
      handler: 'assignment.history',
      config: { policies: policy('canRead') },
    },
    {
      method: 'GET',
      path: '/queue',
      handler: 'assignment.queue',
      config: { policies: policy('canRead') },
    },
    {
      method: 'GET',
      path: '/workflows',
      handler: 'workflow.find',
      config: { policies: policy('canRead') },
    },
    {
      method: 'GET',
      path: '/workflows/content-types',
      handler: 'workflow.eligibleContentTypes',
      config: { policies: policy('canConfigure') },
    },
    {
      method: 'GET',
      path: '/workflows/reviewers',
      handler: 'workflow.reviewers',
      config: { policies: policy('canRead') },
    },
    {
      method: 'GET',
      path: '/workflows/roles',
      handler: 'workflow.roles',
      config: { policies: policy('canConfigure') },
    },
    {
      method: 'GET',
      path: '/workflows/:id',
      handler: 'workflow.findOne',
      config: { policies: policy('canRead') },
    },
    {
      method: 'POST',
      path: '/workflows',
      handler: 'workflow.create',
      config: { policies: policy('canConfigure') },
    },
    {
      method: 'PUT',
      path: '/workflows/:id',
      handler: 'workflow.update',
      config: { policies: policy('canConfigure') },
    },
    {
      method: 'DELETE',
      path: '/workflows/:id',
      handler: 'workflow.delete',
      config: { policies: policy('canConfigure') },
    },
  ],
};
