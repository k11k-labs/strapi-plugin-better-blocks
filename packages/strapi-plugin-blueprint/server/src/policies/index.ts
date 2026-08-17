import { PLUGIN_ID } from '../uids';

/** The plugin's single permission, as a route guard. */
const hasPermission = (action: string) => (policyContext: any) => {
  const ability = policyContext.state?.userAbility;
  if (!ability) return false;
  return ability.can(`plugin::${PLUGIN_ID}.${action}`);
};

export default {
  canRead: hasPermission('read'),
};
