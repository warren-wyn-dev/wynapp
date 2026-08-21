export type SessionRealm = 'consumer' | 'admin';
export interface Session {
  idHash: string;
  subjectId: string;
  realm: SessionRealm;
  expiresAt: Date;
}
export interface ConsumerIdentity {
  userId: string;
}
export interface AdminIdentity {
  adminId: string;
  permissions: readonly string[];
}
export interface ConsumerAuthContext {
  realm: 'consumer';
  identity: ConsumerIdentity;
  session: Session;
}
export interface AdminAuthContext {
  realm: 'admin';
  identity: AdminIdentity;
  session: Session;
}
export interface SessionValidator<C> {
  validate(sessionToken: string): Promise<C | null>;
}
export interface PermissionChecker {
  can(context: AdminAuthContext, permission: string): Promise<boolean>;
}
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}
export interface SessionStore<C> {
  findByTokenHash(tokenHash: string): Promise<C | null>;
  revoke(tokenHash: string): Promise<void>;
}
export const consumerCookieName = '__Host-wyn-consumer';
export const adminCookieName = '__Host-wyn-admin';
