import { PLUGIN_ID } from '../uids';

/**
 * Route guards for the plugin's own permissions.
 *
 * These are the coarse ones - access, configure, assign. The rules about which
 * *stage* a role may move a document into live on the stages and are enforced
 * inside `assignment.transition`, because they depend on the document's current
 * position and a route policy cannot see that.
 */
const hasPermission = (action: string) => (policyContext: any) => {
  const ability = policyContext.state?.userAbility;
  if (!ability) return false;
  return ability.can(`plugin::${PLUGIN_ID}.${action}`);
};

export default {
  canRead: hasPermission('read'),
  canConfigure: hasPermission('settings.configure'),
  canAssign: hasPermission('assign'),
};
