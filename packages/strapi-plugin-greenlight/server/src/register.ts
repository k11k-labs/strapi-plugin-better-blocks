import type { Core } from '@strapi/strapi';

import { PLUGIN_ID } from './uids';

/** Set by `documents.use()`, released in `destroy()`. */
let unsubscribe: (() => void) | null = null;

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  registerPermissions(strapi);
  unsubscribe = registerPublishGate(strapi);
};

export const releaseMiddleware = (): void => {
  unsubscribe?.();
  unsubscribe = null;
};

/**
 * The coarse switch: who can see the plugin at all, configure it, and assign
 * reviewers.
 *
 * Per-stage rules are **not** here and cannot be - they live on the stages
 * themselves and are checked in `permission.ts`. This only decides who gets
 * through the door.
 */
const registerPermissions = (strapi: Core.Strapi): void => {
  const actions = [
    {
      section: 'plugins',
      displayName: 'Access the review queue',
      uid: 'read',
      pluginName: PLUGIN_ID,
    },
    {
      section: 'plugins',
      displayName: 'Configure workflows',
      uid: 'settings.configure',
      pluginName: PLUGIN_ID,
    },
    {
      section: 'plugins',
      displayName: 'Assign a reviewer',
      uid: 'assign',
      pluginName: PLUGIN_ID,
    },
  ];

  // Cast: `strapi.admin` is typed as a generic plugin, so the action provider is
  // not on the public surface even though it is the documented way in.
  const actionProvider = (
    strapi.admin as unknown as {
      services?: { permission?: { actionProvider?: { registerMany?: (a: unknown[]) => void } } };
    }
  )?.services?.permission?.actionProvider;

  actionProvider?.registerMany?.(actions);
};

/**
 * The publish gate.
 *
 * Registered in `register()` rather than `bootstrap()` deliberately. Document
 * service middlewares run in registration order, and plugins that snapshot
 * documents - Rewind, for one - register theirs in `bootstrap()`. Registering
 * here puts the gate outside those, so a publish that is refused never reaches
 * them and never records a version of something that did not happen.
 */
const registerPublishGate = (strapi: Core.Strapi): (() => void) => {
  /**
   * `use()` hands back an unsubscribe function at runtime, but its published type
   * is the document service itself, so the cast is the only way to keep the
   * handle. Guarded on call in case that ever stops being true.
   */
  const handle = strapi.documents.use(async (context: any, next: any) => {
    if (context.action === 'delete') {
      // Fire-and-forget cleanup so a deleted document does not leave an
      // assignment behind forever. Deliberately after the delete succeeds.
      const result = await next();
      void forgetDeleted(strapi, context).catch((error: unknown) =>
        strapi.log.error(
          `[greenlight] could not clean up after a deleted document: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      );
      return result;
    }

    if (context.action !== 'publish') return next();

    /**
     * The escape hatch for seeds, imports and migrations - code that publishes
     * on purpose and has no reviewer to answer to.
     *
     * Stripped before `next()` so it never reaches the document service's own
     * parameter handling. Strapi tolerates unknown params today; that is not a
     * promise, and relying on it would be someone else's upgrade problem.
     */
    const bypass = context.params?.[PLUGIN_ID]?.bypass === true;
    if (context.params?.[PLUGIN_ID] !== undefined) {
      delete context.params[PLUGIN_ID];
    }
    if (bypass) return next();

    const uid: string = context.contentType?.uid ?? context.uid;
    const documentId: string | undefined = context.params?.documentId;
    if (!uid || !documentId) return next();

    const gate = strapi.plugin(PLUGIN_ID).service('gate');
    const locales = await gate.resolveLocales(uid, documentId, context.params?.locale);

    await gate.assertPublishable(uid, documentId, locales);

    return next();
  }) as unknown;

  return () => {
    if (typeof handle === 'function') (handle as () => void)();
  };
};

const forgetDeleted = async (strapi: Core.Strapi, context: any): Promise<void> => {
  const uid: string = context.contentType?.uid ?? context.uid;
  const documentId: string | undefined = context.params?.documentId;
  if (!uid || !documentId) return;

  // No locale: a delete removes the document in every locale it had.
  await strapi.plugin(PLUGIN_ID).service('assignment').forget(uid, documentId);
};

export default register;
