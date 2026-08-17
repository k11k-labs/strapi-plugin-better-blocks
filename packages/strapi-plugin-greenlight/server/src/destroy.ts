import { releaseMiddleware } from './register';

/**
 * `documents.use()` hands back an unsubscribe function. Without calling it, a
 * process that boots Strapi repeatedly — the test harness, a dev server reload —
 * stacks a new gate on top of the old ones and runs them all.
 */
const destroy = () => {
  releaseMiddleware();
};

export default destroy;
