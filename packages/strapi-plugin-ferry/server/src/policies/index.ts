import { PLUGIN_ID } from '../uids';

/** A permission, as a route guard. */
const hasPermission = (action: string) => (policyContext: any) => {
  const ability = policyContext.state?.userAbility;
  if (!ability) return false;
  return ability.can(`plugin::${PLUGIN_ID}.${action}`);
};

export default {
  canExport: hasPermission('export'),
  canImport: hasPermission('import'),
};
