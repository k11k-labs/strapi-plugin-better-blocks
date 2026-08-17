import type { AdminUser, Stage, Workflow } from '../types';

export const SUPER_ADMIN_CODE = 'strapi-super-admin';

const isSuperAdmin = (user: AdminUser): boolean =>
  (user.roles ?? []).some((role) => role.code === SUPER_ADMIN_CODE);

const roleIds = (user: AdminUser): number[] => (user.roles ?? []).map((role) => role.id);

/**
 * An empty role list means **anyone with access to the plugin**, not nobody.
 *
 * Intuition says the opposite, which is why it is stated here and in the README:
 * a stage that has been configured with no roles is an unrestricted stage, not a
 * dead end nobody can leave. Reading it the other way would make a freshly
 * created workflow immovable.
 */
const allows = (allowed: number[] | null | undefined, user: AdminUser): boolean => {
  if (isSuperAdmin(user)) return true;
  if (!allowed || allowed.length === 0) return true;

  const mine = new Set(roleIds(user));
  return allowed.some((id) => mine.has(id));
};

const permission = () => ({
  /** May this user move a document *out of* this stage? */
  canMoveFrom(stage: Stage, user: AdminUser): boolean {
    return allows(stage.rolesCanMoveFrom, user);
  },

  /** May this user move a document *into* this stage? */
  canMoveTo(stage: Stage, user: AdminUser): boolean {
    return allows(stage.rolesCanMoveTo, user);
  },

  /**
   * Both conditions have to hold, which is the whole point of two lists.
   *
   * Without the "from" side there is no way to stop someone dragging a document
   * back out of the approved stage, and then the gate is theatre: anyone who can
   * move a document forward can move it back, approve it again, and publish.
   */
  availableTargets(workflow: Workflow, current: Stage | null, user: AdminUser): Stage[] {
    if (current && !this.canMoveFrom(current, user)) return [];

    return workflow.stages
      .filter((stage) => stage.id !== current?.id)
      .filter((stage) => this.canMoveTo(stage, user))
      .sort((a, b) => a.order - b.order);
  },

  isSuperAdmin,
});

export default permission;
