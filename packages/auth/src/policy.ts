import { z } from 'zod';
export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'support',
  'security',
  'system',
  'wyn',
  'wynadmin',
  'moderator',
]);
export const normalizeEmail = (value: string): string =>
  value.trim().toLowerCase();
export const normalizeUsername = (value: string): string =>
  value.trim().toLowerCase();
export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[A-Za-z0-9_]+$/)
  .transform(normalizeUsername)
  .refine((v) => !RESERVED_USERNAMES.has(v), 'Username is reserved');
export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .refine(
    (v) =>
      /[a-z]/.test(v) &&
      /[A-Z]/.test(v) &&
      /\d/.test(v) &&
      /[^A-Za-z0-9]/.test(v),
    'Password must contain upper, lower, number, and symbol',
  );
export type AccountState =
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'BANNED'
  | 'DELETION_PENDING'
  | 'DELETED';
export function mayAuthenticate(state: AccountState): boolean {
  return state === 'ACTIVE' || state === 'RESTRICTED';
}
export function mayMutate(state: AccountState): boolean {
  return state === 'ACTIVE' || state === 'RESTRICTED';
}
