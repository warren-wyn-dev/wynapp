export const ADMIN_ROLES = [
  'OWNER',
  'SUPER_ADMIN',
  'MODERATOR',
  'SUPPORT',
  'ANALYST',
  'CONTENT_ADMIN',
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
export type Permission =
  | 'admin.roles.manage'
  | 'report.read'
  | 'case.read'
  | 'case.triage'
  | 'case.assign'
  | 'moderation.warn'
  | 'moderation.remove_content'
  | 'moderation.restrict'
  | 'moderation.suspend'
  | 'moderation.ban'
  | 'appeal.read'
  | 'appeal.review'
  | 'audit.read'
  | 'users.read'
  | 'content.read'
  | 'clubs.read'
  | 'announcement.manage'
  | 'feature_flags.manage'
  | 'analytics.read';

export const ROLE_PERMISSIONS: Readonly<
  Record<AdminRole, readonly Permission[]>
> = {
  OWNER: [
    'admin.roles.manage',
    'report.read',
    'case.read',
    'case.triage',
    'case.assign',
    'moderation.warn',
    'moderation.remove_content',
    'moderation.restrict',
    'moderation.suspend',
    'moderation.ban',
    'appeal.read',
    'appeal.review',
    'audit.read',
    'users.read',
    'content.read',
    'clubs.read',
    'announcement.manage',
    'feature_flags.manage',
    'analytics.read',
  ],
  SUPER_ADMIN: [
    'report.read',
    'case.read',
    'case.triage',
    'case.assign',
    'moderation.warn',
    'moderation.remove_content',
    'moderation.restrict',
    'moderation.suspend',
    'moderation.ban',
    'appeal.read',
    'appeal.review',
    'audit.read',
    'users.read',
    'content.read',
    'clubs.read',
    'announcement.manage',
    'feature_flags.manage',
    'analytics.read',
  ],
  MODERATOR: [
    'report.read',
    'case.read',
    'case.triage',
    'case.assign',
    'moderation.warn',
    'moderation.remove_content',
    'moderation.restrict',
    'appeal.read',
    'users.read',
    'content.read',
    'clubs.read',
  ],
  SUPPORT: ['case.read', 'appeal.read', 'users.read'],
  ANALYST: ['analytics.read'],
  CONTENT_ADMIN: [
    'report.read',
    'case.read',
    'moderation.warn',
    'moderation.remove_content',
    'content.read',
    'clubs.read',
    'announcement.manage',
  ],
};
export const SENSITIVE_PERMISSIONS = new Set<Permission>([
  'admin.roles.manage',
  'moderation.remove_content',
  'moderation.restrict',
  'moderation.suspend',
  'moderation.ban',
  'appeal.review',
  'audit.read',
  'announcement.manage',
  'feature_flags.manage',
]);
export function permissionsFor(
  role: AdminRole,
  grants: readonly string[] = [],
): ReadonlySet<string> {
  return new Set([...ROLE_PERMISSIONS[role], ...grants]);
}
