import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
export const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 } as const;
export const hashPassword = (password: string): Promise<string> => argon2.hash(password, ARGON2_OPTIONS);
export const verifyPassword = (hash: string, password: string): Promise<boolean> => argon2.verify(hash, password);
export function issueToken(): { raw: string; hash: string } { const raw = randomBytes(32).toString('base64url'); return { raw, hash: hashToken(raw) }; }
export const hashToken = (raw: string): string => createHash('sha256').update(raw).digest('hex');
export function tokenMatches(raw: string, hash: string): boolean { const a = Buffer.from(hashToken(raw)); const b = Buffer.from(hash); return a.length === b.length && timingSafeEqual(a,b); }
