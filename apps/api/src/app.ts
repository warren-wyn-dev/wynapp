import { randomUUID } from 'node:crypto';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { Pool, PoolClient } from 'pg';
import {
  hashPassword,
  hashToken,
  issueToken,
  verifyPassword,
} from '../../../packages/auth/src/crypto.js';
import {
  mayAuthenticate,
  normalizeEmail,
} from '../../../packages/auth/src/policy.js';
import {
  changePasswordSchema,
  deleteSchema,
  emailSchema,
  loginSchema,
  privacySchema,
  profileSchema,
  registerSchema,
  resetSchema,
  tokenSchema,
} from '../../../packages/auth/src/schemas.js';
import {
  ADMIN_COOKIE,
  clearConsumerCookies,
  CONSUMER_COOKIE,
  CSRF_COOKIE,
  setConsumerCookies,
} from '../../../packages/auth/src/session.js';
import type { EmailAdapter } from './email.js';
import {
  SocialError,
  SocialService,
} from '../../../packages/social/src/service.js';
import { z } from 'zod';
import { MEDIA_PURPOSES } from '../../../packages/media/src/constants.js';
import {
  MediaError,
  MediaService,
} from '../../../packages/media/src/service.js';
import type { MediaStorage } from '../../../packages/media/src/storage.js';
import { DropError, DropService } from '../../../packages/drop/src/index.js';
import {
  EngagementError,
  EngagementService,
} from '../../../packages/engagement/src/index.js';
import {
  DiscoveryError,
  DiscoveryService,
} from '../../../packages/discovery/src/index.js';
import {
  NotificationError,
  NotificationService,
} from '../../../packages/notifications/src/index.js';
import { ClubError, ClubService } from '../../../packages/clubs/src/index.js';
import { ChatError, ChatService } from '../../../packages/chat/src/index.js';
import { AdminError, AdminService } from '../../../packages/admin/src/index.js';

type Deps = {
  pool?: Pool;
  email?: EmailAdapter;
  storage?: MediaStorage;
  allowedOrigins?: readonly string[];
  ready?: () => Promise<boolean>;
  // Test/staging-only override for the auth-endpoint rate limit (default 10
  // requests/minute, matching production). server.ts only forwards this
  // from AUTH_RATE_LIMIT_MAX when explicitly set, so production is
  // unaffected unless a deployer opts in.
  authRateLimitMax?: number;
};
const genericAuth = {
  code: 'INVALID_CREDENTIALS',
  message: 'Email or password is invalid.',
};
function fail(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  requestId: string,
) {
  return reply
    .code(status)
    .send({ error: { code, message, request_id: requestId } });
}
async function tx<T>(
  pool: Pool,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const v = await fn(c);
    await c.query('COMMIT');
    return v;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
async function emit(
  c: PoolClient,
  type: string,
  userId: string,
  requestId: string,
  payload: object = {},
) {
  await c.query(
    'INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id) VALUES($1,$2,$3,$4,$5)',
    [type, 'User', userId, payload, requestId],
  );
}

export async function buildApp(options: Deps): Promise<FastifyInstance> {
  const pool =
    options.pool ??
    new Proxy({} as Pool, {
      get() {
        throw new Error('Database is unavailable.');
      },
    });
  const email = options.email ?? { async send() {} };
  const app = Fastify({ logger: false, genReqId: () => randomUUID() });
  await app.register(cookie);
  await app.register(cors, {
    origin: [
      ...(options.allowedOrigins ?? [
        process.env.APP_ORIGIN ?? 'http://localhost:3000',
      ]),
    ],
    credentials: true,
  });
  await app.register(rateLimit, { global: false });
  app.addHook('onRequest', async (req) => {
    req.requestId = req.id;
  });
  app.setErrorHandler((error, req, reply) => {
    if (process.env.WYN_DEBUG_ERRORS) console.error(error);
    if ((error as { validation?: unknown }).validation)
      return fail(
        reply,
        400,
        'VALIDATION_ERROR',
        'The request is invalid.',
        req.requestId,
      );
    return fail(
      reply,
      500,
      'INTERNAL_ERROR',
      'An unexpected error occurred.',
      req.requestId,
    );
  });
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async (_req, reply) => {
    const ready = await (options.ready?.() ?? Promise.resolve(true));
    return ready
      ? { status: 'ready' }
      : reply.code(503).send({ status: 'not_ready' });
  });
  app.setNotFoundHandler((req, reply) =>
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource is unavailable.',
        requestId: req.requestId,
      },
    }),
  );
  const limited = {
    config: {
      rateLimit: {
        max: options.authRateLimitMax ?? 10,
        timeWindow: '1 minute',
      },
    },
  };
  const social = new SocialService(pool);
  const socialLimited = {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  };
  const media = options.storage
    ? new MediaService(pool, options.storage)
    : null;
  const mediaLimited = {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  };
  const drops = new DropService(pool);
  const engagement = new EngagementService(pool);
  const discovery = new DiscoveryService(pool);
  const notifications = new NotificationService(pool);
  const clubs = new ClubService(pool);
  const chat = new ChatService(pool);
  const adminService = new AdminService(pool);
  const engageLimited = {
    config: { rateLimit: { max: 40, timeWindow: '1 minute' } },
  };
  const dropLimited = {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  };
  function dropFailure(error: unknown, reply: FastifyReply, requestId: string) {
    if (error instanceof z.ZodError)
      return fail(
        reply,
        400,
        'VALIDATION_ERROR',
        'The Drop is invalid.',
        requestId,
      );
    if (error instanceof DropError) {
      const status =
        error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'FORBIDDEN'
            ? 403
            : 409;
      return fail(
        reply,
        status,
        error.code,
        'The Drop operation is not allowed.',
        requestId,
      );
    }
    const code = (error as { code?: string; message?: string }).code;
    if (code === '23505' || code === '23514')
      return fail(
        reply,
        409,
        'DROP_CONSTRAINT',
        'The Drop violates an attachment or content constraint.',
        requestId,
      );
    throw error;
  }
  const uuid = z.uuid();
  function engagementFailure(
    error: unknown,
    reply: FastifyReply,
    requestId: string,
  ) {
    if (error instanceof z.ZodError)
      return fail(
        reply,
        400,
        'VALIDATION_ERROR',
        'The engagement request is invalid.',
        requestId,
      );
    if (error instanceof EngagementError)
      return fail(
        reply,
        error.code === 'FORBIDDEN'
          ? 403
          : error.code === 'INVALID_CURSOR'
            ? 400
            : error.code === 'INVALID_PARENT'
              ? 409
              : 404,
        error.code,
        'The engagement operation is unavailable.',
        requestId,
      );
    throw error;
  }
  async function targetId(username: string): Promise<string | null> {
    const q = await pool.query(
      "SELECT p.user_id FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.username_normalized=$1 AND u.account_state IN ('ACTIVE','RESTRICTED')",
      [username.trim().toLowerCase()],
    );
    return q.rows[0]?.user_id ?? null;
  }
  function socialFailure(
    error: unknown,
    reply: FastifyReply,
    requestId: string,
  ) {
    if (error instanceof SocialError)
      return fail(
        reply,
        error.code === 'NOT_FOUND' ? 404 : 409,
        error.code,
        error.code === 'NOT_FOUND'
          ? 'The relationship is unavailable.'
          : 'The relationship is not allowed.',
        requestId,
      );
    throw error;
  }
  async function consumer(req: FastifyRequest, reply: FastifyReply) {
    const raw = req.cookies[CONSUMER_COOKIE];
    if (!raw)
      return fail(
        reply,
        401,
        'UNAUTHENTICATED',
        'Authentication is required.',
        req.requestId,
      );
    const q = await pool.query(
      "SELECT s.id,s.user_id,s.realm,u.account_state FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.realm='CONSUMER' AND s.audience='wyn-consumer' AND s.revoked_at IS NULL AND s.expires_at>now()",
      [hashToken(raw)],
    );
    const row = q.rows[0];
    if (!row || !mayAuthenticate(row.account_state))
      return fail(
        reply,
        401,
        'UNAUTHENTICATED',
        'Authentication is required.',
        req.requestId,
      );
    req.auth = {
      userId: row.user_id,
      sessionId: row.id,
      realm: 'CONSUMER',
      state: row.account_state,
    };
    await pool.query(
      "UPDATE sessions SET last_used_at=now() WHERE id=$1 AND last_used_at < now()-interval '5 minutes'",
      [row.id],
    );
  }
  async function optionalConsumer(req: FastifyRequest) {
    const raw = req.cookies[CONSUMER_COOKIE];
    if (!raw) return;
    const q = await pool.query(
      "SELECT s.id,s.user_id,u.account_state FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.realm='CONSUMER' AND s.audience='wyn-consumer' AND s.revoked_at IS NULL AND s.expires_at>now()",
      [hashToken(raw)],
    );
    const row = q.rows[0];
    if (row && mayAuthenticate(row.account_state))
      req.auth = {
        userId: row.user_id,
        sessionId: row.id,
        realm: 'CONSUMER',
        state: row.account_state,
      };
  }
  async function csrf(req: FastifyRequest, reply: FastifyReply) {
    if (!req.auth) return;
    const origin = req.headers.origin;
    const supplied = req.headers['x-csrf-token'];
    const raw = req.cookies[CSRF_COOKIE];
    if (
      origin !== (process.env.APP_ORIGIN ?? 'http://localhost:3000') ||
      typeof supplied !== 'string' ||
      !raw ||
      supplied !== raw
    )
      return fail(
        reply,
        403,
        'CSRF_INVALID',
        'Request authenticity could not be verified.',
        req.requestId,
      );
    const q = await pool.query(
      'SELECT 1 FROM sessions WHERE id=$1 AND csrf_token_hash=$2',
      [req.auth.sessionId, hashToken(raw)],
    );
    if (!q.rowCount)
      return fail(
        reply,
        403,
        'CSRF_INVALID',
        'Request authenticity could not be verified.',
        req.requestId,
      );
  }
  async function admin(req: FastifyRequest, reply: FastifyReply) {
    const raw = req.cookies[ADMIN_COOKIE];
    if (!raw)
      return fail(
        reply,
        401,
        'ADMIN_UNAUTHENTICATED',
        'Admin authentication is required.',
        req.requestId,
      );
    const q = await pool.query(
      "SELECT s.id,s.user_id,s.step_up_at,a.role,a.permissions FROM sessions s JOIN admin_principals a ON a.user_id=s.user_id WHERE s.token_hash=$1 AND s.realm='ADMIN' AND s.audience='wyn-admin' AND a.enabled AND a.role IS NOT NULL AND s.revoked_at IS NULL AND s.expires_at>now()",
      [hashToken(raw)],
    );
    if (!q.rowCount)
      return fail(
        reply,
        401,
        'ADMIN_UNAUTHENTICATED',
        'Admin authentication is required.',
        req.requestId,
      );
    const r = q.rows[0];
    req.admin = {
      userId: r.user_id,
      sessionId: r.id,
      role: r.role,
      grants: r.permissions,
      stepUpAt: r.step_up_at,
    };
  }
  async function adminCsrf(req: FastifyRequest, reply: FastifyReply) {
    if (!req.admin) return;
    const token = req.headers['x-admin-csrf-token'];
    if (
      req.headers.origin !==
        (process.env.ADMIN_ORIGIN ?? 'http://localhost:3001') ||
      typeof token !== 'string'
    )
      return fail(
        reply,
        403,
        'CSRF_INVALID',
        'Request authenticity could not be verified.',
        req.requestId,
      );
    const q = await pool.query(
      'SELECT 1 FROM sessions WHERE id=$1 AND csrf_token_hash=$2',
      [req.admin.sessionId, hashToken(token)],
    );
    if (!q.rowCount)
      return fail(
        reply,
        403,
        'CSRF_INVALID',
        'Request authenticity could not be verified.',
        req.requestId,
      );
  }
  function adminFailure(
    error: unknown,
    reply: FastifyReply,
    requestId: string,
  ) {
    if (error instanceof z.ZodError)
      return fail(
        reply,
        400,
        'VALIDATION_ERROR',
        'The admin request is invalid.',
        requestId,
      );
    if (error instanceof AdminError)
      return fail(
        reply,
        error.code === 'UNAUTHENTICATED'
          ? 401
          : error.code === 'FORBIDDEN' || error.code === 'STEP_UP_REQUIRED'
            ? 403
            : error.code === 'NOT_FOUND' || error.code === 'INVALID_TARGET'
              ? 404
              : 409,
        error.code,
        'The admin operation is unavailable.',
        requestId,
      );
    throw error;
  }

  app.post('/v1/auth/register', { ...limited }, async (req, reply) => {
    const p = registerSchema.parse(req.body);
    try {
      await tx(pool, async (c) => {
        const u = await c.query(
          'INSERT INTO users(email_normalized) VALUES($1) RETURNING id',
          [normalizeEmail(p.email)],
        );
        const id = u.rows[0].id;
        await c.query(
          'INSERT INTO user_credentials(user_id,password_hash) VALUES($1,$2)',
          [id, await hashPassword(p.password)],
        );
        await c.query(
          'INSERT INTO profiles(user_id,username_normalized,display_name) VALUES($1,$2,$3)',
          [id, p.username, p.displayName],
        );
        await c.query('INSERT INTO privacy_settings(user_id) VALUES($1)', [id]);
        const token = issueToken();
        await c.query(
          "INSERT INTO email_verification_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '24 hours')",
          [id, token.hash],
        );
        await emit(c, 'UserRegistered', id, req.requestId);
        await emit(c, 'EmailVerificationRequested', id, req.requestId);
        await email.send({
          to: normalizeEmail(p.email),
          template: 'VERIFY_EMAIL',
          token: token.raw,
        });
      });
      return reply.code(202).send({
        data: { message: 'Registration accepted. Check your email.' },
        request_id: req.requestId,
      });
    } catch (e) {
      if ((e as { code?: string }).code === '23505')
        return fail(
          reply,
          409,
          'ACCOUNT_CONFLICT',
          'The email or username is unavailable.',
          req.requestId,
        );
      throw e;
    }
  });
  app.post('/v1/auth/login', { ...limited }, async (req, reply) => {
    const p = loginSchema.parse(req.body);
    const q = await pool.query(
      'SELECT u.id,u.account_state,c.password_hash FROM users u JOIN user_credentials c ON c.user_id=u.id WHERE u.email_normalized=$1',
      [normalizeEmail(p.email)],
    );
    const u = q.rows[0];
    if (
      !u ||
      !mayAuthenticate(u.account_state) ||
      !(await verifyPassword(u.password_hash, p.password))
    ) {
      return reply
        .code(401)
        .send({ error: { ...genericAuth, request_id: req.requestId } });
    }
    const token = issueToken(),
      csrfToken = issueToken();
    await tx(pool, async (c) => {
      await c.query(
        "INSERT INTO sessions(user_id,token_hash,realm,audience,csrf_token_hash,label,expires_at) VALUES($1,$2,'CONSUMER','wyn-consumer',$3,$4,now()+interval '30 days')",
        [u.id, token.hash, csrfToken.hash, p.deviceLabel ?? null],
      );
      await c.query(
        "INSERT INTO security_events(user_id,event_type,request_id) VALUES($1,'LOGIN_SUCCEEDED',$2)",
        [u.id, req.requestId],
      );
    });
    setConsumerCookies(reply, token.raw, csrfToken.raw);
    return reply.send({
      data: { authenticated: true },
      request_id: req.requestId,
    });
  });
  app.post(
    '/v1/auth/logout',
    { preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      await pool.query(
        "UPDATE sessions SET revoked_at=now(),revocation_reason='LOGOUT' WHERE id=$1",
        [req.auth.sessionId],
      );
      clearConsumerCookies(reply);
      return reply.code(204).send();
    },
  );
  app.post(
    '/v1/auth/logout-all',
    { preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      await pool.query(
        "UPDATE sessions SET revoked_at=now(),revocation_reason='LOGOUT_ALL' WHERE user_id=$1 AND realm='CONSUMER' AND revoked_at IS NULL",
        [req.auth.userId],
      );
      clearConsumerCookies(reply);
      return reply.code(204).send();
    },
  );
  app.post('/v1/auth/verify-email', { ...limited }, async (req, reply) => {
    const p = tokenSchema.parse(req.body);
    const ok = await tx(pool, async (c) => {
      const q = await c.query(
        'SELECT id,user_id FROM email_verification_tokens WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE',
        [hashToken(p.token)],
      );
      if (!q.rowCount) return false;
      await c.query(
        'UPDATE email_verification_tokens SET consumed_at=now() WHERE id=$1',
        [q.rows[0].id],
      );
      await c.query(
        'UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()),updated_at=now() WHERE id=$1',
        [q.rows[0].user_id],
      );
      await emit(c, 'EmailVerified', q.rows[0].user_id, req.requestId);
      return true;
    });
    if (!ok)
      return fail(
        reply,
        400,
        'TOKEN_INVALID',
        'The token is invalid or expired.',
        req.requestId,
      );
    return reply.send({ data: { verified: true }, request_id: req.requestId });
  });
  app.post(
    '/v1/auth/resend-verification',
    { ...limited },
    async (req, reply) => {
      const p = emailSchema.parse(req.body);
      const q = await pool.query(
        'SELECT id,email_verified_at FROM users WHERE email_normalized=$1',
        [normalizeEmail(p.email)],
      );
      if (q.rowCount && !q.rows[0].email_verified_at) {
        const t = issueToken();
        await tx(pool, async (c) => {
          await c.query(
            "INSERT INTO email_verification_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '24 hours')",
            [q.rows[0].id, t.hash],
          );
          await emit(
            c,
            'EmailVerificationRequested',
            q.rows[0].id,
            req.requestId,
          );
        });
        await email.send({
          to: normalizeEmail(p.email),
          template: 'VERIFY_EMAIL',
          token: t.raw,
        });
      }
      return reply.code(202).send({
        data: { message: 'If eligible, an email will be sent.' },
        request_id: req.requestId,
      });
    },
  );
  app.post('/v1/auth/forgot-password', { ...limited }, async (req, reply) => {
    const p = emailSchema.parse(req.body);
    const q = await pool.query(
      "SELECT id FROM users WHERE email_normalized=$1 AND account_state IN ('ACTIVE','RESTRICTED')",
      [normalizeEmail(p.email)],
    );
    if (q.rowCount) {
      const t = issueToken();
      await tx(pool, async (c) => {
        await c.query(
          "INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')",
          [q.rows[0].id, t.hash],
        );
        await emit(c, 'PasswordResetRequested', q.rows[0].id, req.requestId);
      });
      await email.send({
        to: normalizeEmail(p.email),
        template: 'PASSWORD_RESET',
        token: t.raw,
      });
    }
    return reply.code(202).send({
      data: { message: 'If the account is eligible, an email will be sent.' },
      request_id: req.requestId,
    });
  });
  app.post('/v1/auth/reset-password', { ...limited }, async (req, reply) => {
    const p = resetSchema.parse(req.body);
    const changed = await tx(pool, async (c) => {
      const q = await c.query(
        'SELECT id,user_id FROM password_reset_tokens WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE',
        [hashToken(p.token)],
      );
      if (!q.rowCount) return null;
      const { id, user_id } = q.rows[0];
      await c.query(
        'UPDATE password_reset_tokens SET consumed_at=now() WHERE id=$1',
        [id],
      );
      await c.query(
        'UPDATE user_credentials SET password_hash=$1,password_changed_at=now(),updated_at=now() WHERE user_id=$2',
        [await hashPassword(p.password), user_id],
      );
      await c.query(
        "UPDATE sessions SET revoked_at=now(),revocation_reason='PASSWORD_RESET' WHERE user_id=$1 AND revoked_at IS NULL",
        [user_id],
      );
      await emit(c, 'PasswordChanged', user_id, req.requestId, {
        method: 'reset',
      });
      return user_id;
    });
    if (!changed)
      return fail(
        reply,
        400,
        'TOKEN_INVALID',
        'The token is invalid or expired.',
        req.requestId,
      );
    return reply.send({ data: { changed: true }, request_id: req.requestId });
  });
  app.post(
    '/v1/auth/change-password',
    { preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      const p = changePasswordSchema.parse(req.body);
      const q = await pool.query(
        'SELECT password_hash FROM user_credentials WHERE user_id=$1',
        [req.auth.userId],
      );
      if (!(await verifyPassword(q.rows[0].password_hash, p.currentPassword)))
        return reply
          .code(401)
          .send({ error: { ...genericAuth, request_id: req.requestId } });
      await tx(pool, async (c) => {
        await c.query(
          'UPDATE user_credentials SET password_hash=$1,password_changed_at=now(),updated_at=now() WHERE user_id=$2',
          [await hashPassword(p.newPassword), req.auth!.userId],
        );
        await c.query(
          "UPDATE sessions SET revoked_at=now(),revocation_reason='PASSWORD_CHANGE' WHERE user_id=$1 AND id<>$2 AND revoked_at IS NULL",
          [req.auth!.userId, req.auth!.sessionId],
        );
        await emit(c, 'PasswordChanged', req.auth!.userId, req.requestId, {
          method: 'authenticated',
        });
      });
      await email.send({ to: 'redacted', template: 'PASSWORD_CHANGED' });
      return reply.send({ data: { changed: true }, request_id: req.requestId });
    },
  );
  app.get('/v1/me', { preHandler: [consumer] }, async (req, reply) => {
    if (!req.auth) return;
    const q = await pool.query(
      'SELECT p.username_normalized AS username,p.display_name,p.bio,p.website,p.location,p.avatar_url,p.cover_url,p.created_at,ps.account_visibility,u.email_verified_at FROM profiles p JOIN users u ON u.id=p.user_id JOIN privacy_settings ps ON ps.user_id=p.user_id WHERE p.user_id=$1',
      [req.auth.userId],
    );
    return reply.send({ data: q.rows[0], request_id: req.requestId });
  });
  app.patch(
    '/v1/me/profile',
    { preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      const p = profileSchema.parse(req.body);
      const q = await pool.query(
        'UPDATE profiles SET display_name=COALESCE($1,display_name),bio=COALESCE($2,bio),website=CASE WHEN $3 THEN $4 ELSE website END,location=CASE WHEN $5 THEN $6 ELSE location END,updated_at=now() WHERE user_id=$7 RETURNING username_normalized AS username,display_name,bio,website,location,avatar_url,cover_url,created_at',
        [
          p.displayName ?? null,
          p.bio ?? null,
          'website' in p,
          p.website ?? null,
          'location' in p,
          p.location ?? null,
          req.auth.userId,
        ],
      );
      return reply.send({ data: q.rows[0], request_id: req.requestId });
    },
  );
  app.get('/v1/me/sessions', { preHandler: [consumer] }, async (req, reply) => {
    if (!req.auth) return;
    const q = await pool.query(
      "SELECT id,label,created_at,last_used_at,expires_at,(id=$2) AS current FROM sessions WHERE user_id=$1 AND realm='CONSUMER' AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC",
      [req.auth.userId, req.auth.sessionId],
    );
    return reply.send({ data: q.rows, request_id: req.requestId });
  });
  app.delete(
    '/v1/me/sessions/:sessionId',
    { preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      const id = (req.params as { sessionId: string }).sessionId;
      const q = await pool.query(
        "UPDATE sessions SET revoked_at=now(),revocation_reason='USER_REVOKED' WHERE id=$1 AND user_id=$2 AND realm='CONSUMER' AND revoked_at IS NULL RETURNING id",
        [id, req.auth.userId],
      );
      if (!q.rowCount)
        return fail(
          reply,
          404,
          'NOT_FOUND',
          'The session is unavailable.',
          req.requestId,
        );
      return reply.code(204).send();
    },
  );
  app.patch(
    '/v1/me/privacy',
    { preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      const p = privacySchema.parse(req.body);
      if (p.accountVisibility === 'PUBLIC')
        await social.makePublic(req.auth.userId, req.requestId);
      else
        await pool.query(
          "UPDATE privacy_settings SET account_visibility='PRIVATE',updated_at=now() WHERE user_id=$1",
          [req.auth.userId],
        );
      return reply.send({
        data: { account_visibility: p.accountVisibility },
        request_id: req.requestId,
      });
    },
  );
  app.post(
    '/v1/me/delete-request',
    { preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      const p = deleteSchema.parse(req.body);
      const q = await pool.query(
        'SELECT password_hash FROM user_credentials WHERE user_id=$1',
        [req.auth.userId],
      );
      if (!(await verifyPassword(q.rows[0].password_hash, p.currentPassword)))
        return reply
          .code(401)
          .send({ error: { ...genericAuth, request_id: req.requestId } });
      await tx(pool, async (c) => {
        await c.query(
          'INSERT INTO account_deletion_requests(user_id) VALUES($1) ON CONFLICT DO NOTHING',
          [req.auth!.userId],
        );
        await c.query(
          "UPDATE users SET account_state='DELETION_PENDING',updated_at=now() WHERE id=$1",
          [req.auth!.userId],
        );
        await c.query(
          "UPDATE sessions SET revoked_at=now(),revocation_reason='DELETION_PENDING' WHERE user_id=$1 AND revoked_at IS NULL",
          [req.auth!.userId],
        );
        await emit(
          c,
          'AccountDeletionRequested',
          req.auth!.userId,
          req.requestId,
        );
      });
      clearConsumerCookies(reply);
      return reply.code(202).send({
        data: { state: 'DELETION_PENDING' },
        request_id: req.requestId,
      });
    },
  );
  app.get(
    '/v1/users/:username',
    { preHandler: [optionalConsumer] },
    async (req, reply) => {
      const username = (req.params as { username: string }).username
        .trim()
        .toLowerCase();
      const viewer = req.auth?.userId ?? null;
      const q = await pool.query(
        "SELECT p.user_id,p.username_normalized AS username,p.display_name,p.bio,p.website,p.location,p.avatar_url,p.cover_url,p.created_at,ps.account_visibility,EXISTS(SELECT 1 FROM follows WHERE follower_id=$2 AND followed_id=p.user_id) AS is_following,EXISTS(SELECT 1 FROM follows WHERE follower_id=p.user_id AND followed_id=$2) AS follows_you,EXISTS(SELECT 1 FROM follow_requests WHERE requester_id=$2 AND target_id=p.user_id AND status='PENDING') AS follow_request_pending,EXISTS(SELECT 1 FROM mutes WHERE muter_id=$2 AND muted_id=p.user_id) AS is_muted,EXISTS(SELECT 1 FROM blocks WHERE (blocker_id=$2 AND blocked_id=p.user_id) OR (blocker_id=p.user_id AND blocked_id=$2)) AS blocked,(SELECT count(*)::int FROM follows WHERE followed_id=p.user_id) AS followers_count,(SELECT count(*)::int FROM follows WHERE follower_id=p.user_id) AS following_count FROM profiles p JOIN users u ON u.id=p.user_id JOIN privacy_settings ps ON ps.user_id=p.user_id WHERE p.username_normalized=$1 AND u.account_state IN ('ACTIVE','RESTRICTED')",
        [username, viewer],
      );
      if (!q.rowCount || q.rows[0].blocked)
        return fail(
          reply,
          404,
          'NOT_FOUND',
          'The profile is unavailable.',
          req.requestId,
        );
      const row = q.rows[0],
        full =
          row.account_visibility === 'PUBLIC' ||
          viewer === row.user_id ||
          row.is_following;
      return reply.send({
        data: {
          username: row.username,
          display_name: row.display_name,
          avatar_url: row.avatar_url,
          created_at: row.created_at,
          is_private: row.account_visibility === 'PRIVATE',
          followers_count: row.followers_count,
          following_count: row.following_count,
          ...(full
            ? {
                bio: row.bio,
                website: row.website,
                location: row.location,
                cover_url: row.cover_url,
              }
            : {}),
          ...(viewer
            ? {
                relationship: {
                  isFollowing: row.is_following,
                  followsYou: row.follows_you,
                  followRequestPending: row.follow_request_pending,
                  canFollow:
                    viewer !== row.user_id &&
                    !row.is_following &&
                    !row.follow_request_pending,
                  isMuted: row.is_muted,
                },
              }
            : {}),
        },
        request_id: req.requestId,
      });
    },
  );
  app.post('/admin/v1/auth/login', { ...limited }, async (req, reply) => {
    const p = loginSchema.parse(req.body);
    const q = await pool.query(
      'SELECT u.id,u.account_state,c.password_hash FROM users u JOIN user_credentials c ON c.user_id=u.id JOIN admin_principals a ON a.user_id=u.id WHERE u.email_normalized=$1 AND a.enabled AND a.role IS NOT NULL',
      [normalizeEmail(p.email)],
    );
    const u = q.rows[0];
    if (
      !u ||
      !mayAuthenticate(u.account_state) ||
      !(await verifyPassword(u.password_hash, p.password))
    )
      return reply
        .code(401)
        .send({ error: { ...genericAuth, request_id: req.requestId } });
    const token = issueToken(),
      csrfToken = issueToken();
    await pool.query(
      "INSERT INTO sessions(user_id,token_hash,realm,audience,csrf_token_hash,label,expires_at) VALUES($1,$2,'ADMIN','wyn-admin',$3,$4,now()+interval '8 hours')",
      [u.id, token.hash, csrfToken.hash, p.deviceLabel ?? null],
    );
    reply.setCookie(ADMIN_COOKIE, token.raw, {
      path: '/',
      httpOnly: true,
      // __Host- prefixed cookies are rejected by browsers unless Secure is
      // set, even on http://localhost, which Chrome/Firefox treat as secure.
      secure: true,
      sameSite: 'lax',
      maxAge: 28800,
    });
    return reply.send({
      data: { authenticated: true, csrf_token: csrfToken.raw },
      request_id: req.requestId,
    });
  });
  app.post(
    '/admin/v1/auth/step-up',
    { preHandler: [admin, adminCsrf] },
    async (req, reply) => {
      if (!req.admin) return;
      const p = z
        .strictObject({ password: z.string().min(1).max(128) })
        .parse(req.body);
      const q = await pool.query(
        'SELECT password_hash FROM user_credentials WHERE user_id=$1',
        [req.admin.userId],
      );
      if (
        !q.rowCount ||
        !(await verifyPassword(q.rows[0].password_hash, p.password))
      )
        return fail(
          reply,
          401,
          'INVALID_CREDENTIALS',
          'Credentials are invalid.',
          req.requestId,
        );
      await pool.query('UPDATE sessions SET step_up_at=now() WHERE id=$1', [
        req.admin.sessionId,
      ]);
      return reply.send({ data: { step_up: true }, request_id: req.requestId });
    },
  );
  app.get('/admin/v1/session', { preHandler: [admin] }, async (req, reply) =>
    reply.send({
      data: { authenticated: true, role: req.admin!.role },
      request_id: req.requestId,
    }),
  );
  app.post(
    '/v1/reports',
    { preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      const p = z
        .strictObject({
          targetType: z.enum(['USER', 'DROP', 'COMMENT', 'CLUB', 'MESSAGE']),
          targetId: z.uuid(),
          reasonCode: z.string().regex(/^[A-Z0-9_]{2,50}$/),
          context: z.string().max(2000).optional(),
          sourceSurface: z.string().min(1).max(50),
          idempotencyKey: z.string().min(8).max(100),
        })
        .parse(req.body);
      try {
        return reply.code(201).send({
          data: await adminService.submitReport(
            req.auth.userId,
            p,
            req.requestId,
          ),
          request_id: req.requestId,
        });
      } catch (e) {
        return adminFailure(e, reply, req.requestId);
      }
    },
  );
  app.get('/admin/v1/reports', { preHandler: [admin] }, async (req, reply) => {
    try {
      return reply.send({
        data: await adminService.listReports(req.admin!),
        request_id: req.requestId,
      });
    } catch (e) {
      return adminFailure(e, reply, req.requestId);
    }
  });
  app.post(
    '/admin/v1/reports/:id/case',
    { preHandler: [admin, adminCsrf] },
    async (req, reply) => {
      try {
        return reply.code(201).send({
          data: await adminService.createCase(
            req.admin!,
            (req.params as { id: string }).id,
            req.requestId,
          ),
          request_id: req.requestId,
        });
      } catch (e) {
        return adminFailure(e, reply, req.requestId);
      }
    },
  );
  app.post(
    '/admin/v1/cases/:id/actions',
    { preHandler: [admin, adminCsrf] },
    async (req, reply) => {
      const p = z
        .strictObject({
          actionType: z.enum([
            'NO_ACTION',
            'WARNING',
            'REMOVE_CONTENT',
            'RESTRICT',
            'SUSPEND',
            'BAN',
          ]),
          reasonCode: z.string().min(2).max(50),
          notes: z.string().max(2000).optional(),
          effectiveUntil: z.coerce.date().optional(),
          idempotencyKey: z.string().min(8).max(100),
          expectedVersion: z.number().int().positive(),
        })
        .parse(req.body);
      try {
        return reply.code(201).send({
          data: await adminService.act(
            req.admin!,
            (req.params as { id: string }).id,
            p,
            req.requestId,
          ),
          request_id: req.requestId,
        });
      } catch (e) {
        return adminFailure(e, reply, req.requestId);
      }
    },
  );
  app.post(
    '/v1/users/:username/follow',
    { ...socialLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      const id = await targetId((req.params as { username: string }).username);
      if (!id)
        return fail(
          reply,
          404,
          'NOT_FOUND',
          'The profile is unavailable.',
          req.requestId,
        );
      try {
        return reply.send({
          data: await social.follow(req.auth.userId, id, req.requestId),
          request_id: req.requestId,
        });
      } catch (error) {
        return socialFailure(error, reply, req.requestId);
      }
    },
  );
  app.delete(
    '/v1/users/:username/follow',
    { ...socialLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      const id = await targetId((req.params as { username: string }).username);
      if (id) await social.unfollow(req.auth.userId, id, req.requestId);
      return reply.code(204).send();
    },
  );
  app.get(
    '/v1/me/follow-requests',
    { preHandler: [consumer] },
    async (req, reply) => {
      if (!req.auth) return;
      const q = await pool.query(
        "SELECT fr.id,fr.created_at,p.username_normalized AS username,p.display_name,p.avatar_url FROM follow_requests fr JOIN profiles p ON p.user_id=fr.requester_id WHERE fr.target_id=$1 AND fr.status='PENDING' ORDER BY fr.created_at DESC,fr.id DESC LIMIT 51",
        [req.auth.userId],
      );
      return reply.send({
        data: {
          items: q.rows.slice(0, 50),
          next_cursor: q.rows.length > 50 ? q.rows[49].id : null,
        },
        request_id: req.requestId,
      });
    },
  );
  app.post(
    '/v1/follow-requests/:id/approve',
    { ...socialLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      try {
        await social.resolveRequest(
          req.auth.userId,
          uuid.parse((req.params as { id: string }).id),
          'APPROVED',
          req.requestId,
        );
        return reply.code(204).send();
      } catch (error) {
        return socialFailure(error, reply, req.requestId);
      }
    },
  );
  app.post(
    '/v1/follow-requests/:id/reject',
    { ...socialLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      try {
        await social.resolveRequest(
          req.auth.userId,
          uuid.parse((req.params as { id: string }).id),
          'REJECTED',
          req.requestId,
        );
        return reply.code(204).send();
      } catch (error) {
        return socialFailure(error, reply, req.requestId);
      }
    },
  );
  app.delete(
    '/v1/follow-requests/:id',
    { ...socialLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      try {
        await social.cancelRequest(
          req.auth.userId,
          uuid.parse((req.params as { id: string }).id),
          req.requestId,
        );
        return reply.code(204).send();
      } catch (error) {
        return socialFailure(error, reply, req.requestId);
      }
    },
  );
  async function relationshipList(
    req: FastifyRequest,
    reply: FastifyReply,
    direction: 'followers' | 'following',
  ) {
    const id = await targetId((req.params as { username: string }).username);
    if (!id)
      return fail(
        reply,
        404,
        'NOT_FOUND',
        'The profile is unavailable.',
        req.requestId,
      );
    const access = await pool.query(
      'SELECT ps.account_visibility,EXISTS(SELECT 1 FROM follows WHERE follower_id=$2 AND followed_id=$1) AS allowed,EXISTS(SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)) AS blocked FROM privacy_settings ps WHERE ps.user_id=$1',
      [id, req.auth?.userId ?? null],
    );
    if (
      access.rows[0].blocked ||
      (access.rows[0].account_visibility === 'PRIVATE' &&
        req.auth?.userId !== id &&
        !access.rows[0].allowed)
    )
      return fail(
        reply,
        404,
        'NOT_FOUND',
        'The relationship list is unavailable.',
        req.requestId,
      );
    const cursor = (req.query as { cursor?: string }).cursor;
    let decoded: { createdAt: string; id: string } | null = null;
    try {
      if (cursor)
        decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    } catch {
      return fail(
        reply,
        400,
        'INVALID_CURSOR',
        'The cursor is invalid.',
        req.requestId,
      );
    }
    const owner = direction === 'followers' ? 'followed_id' : 'follower_id',
      other = direction === 'followers' ? 'follower_id' : 'followed_id';
    const q = await pool.query(
      `SELECT p.user_id,p.username_normalized AS username,p.display_name,p.avatar_url,f.created_at FROM follows f JOIN profiles p ON p.user_id=f.${other} WHERE f.${owner}=$1 AND ($2::timestamptz IS NULL OR (f.created_at,f.${other})<($2,$3::uuid)) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$4 AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=$4)) ORDER BY f.created_at DESC,f.${other} DESC LIMIT 51`,
      [
        id,
        decoded?.createdAt ?? null,
        decoded?.id ?? null,
        req.auth?.userId ?? null,
      ],
    );
    const items = q.rows.slice(0, 50);
    const last = items[items.length - 1];
    return reply.send({
      data: {
        items,
        next_cursor:
          q.rows.length > 50
            ? Buffer.from(
                JSON.stringify({
                  createdAt: last.created_at,
                  id: last.user_id,
                }),
              ).toString('base64url')
            : null,
      },
      request_id: req.requestId,
    });
  }
  app.get(
    '/v1/users/:username/followers',
    { preHandler: [optionalConsumer] },
    async (req, reply) => relationshipList(req, reply, 'followers'),
  );
  app.get(
    '/v1/users/:username/following',
    { preHandler: [optionalConsumer] },
    async (req, reply) => relationshipList(req, reply, 'following'),
  );
  app.delete(
    '/v1/me/followers/:userId',
    { ...socialLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      await social.removeFollower(
        req.auth.userId,
        uuid.parse((req.params as { userId: string }).userId),
        req.requestId,
      );
      return reply.code(204).send();
    },
  );
  app.post(
    '/v1/users/:username/block',
    { ...socialLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      const id = await targetId((req.params as { username: string }).username);
      if (!id)
        return fail(
          reply,
          404,
          'NOT_FOUND',
          'The profile is unavailable.',
          req.requestId,
        );
      try {
        await social.block(req.auth.userId, id, req.requestId);
        return reply.code(204).send();
      } catch (error) {
        return socialFailure(error, reply, req.requestId);
      }
    },
  );
  app.delete(
    '/v1/users/:username/block',
    { ...socialLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      const id = await targetId((req.params as { username: string }).username);
      if (id) await social.unblock(req.auth.userId, id, req.requestId);
      return reply.code(204).send();
    },
  );
  app.post(
    '/v1/users/:username/mute',
    { ...socialLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      const id = await targetId((req.params as { username: string }).username);
      if (!id)
        return fail(
          reply,
          404,
          'NOT_FOUND',
          'The profile is unavailable.',
          req.requestId,
        );
      try {
        await social.mute(req.auth.userId, id);
        return reply.code(204).send();
      } catch (error) {
        return socialFailure(error, reply, req.requestId);
      }
    },
  );
  app.delete(
    '/v1/users/:username/mute',
    { ...socialLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      const id = await targetId((req.params as { username: string }).username);
      if (id) await social.unmute(req.auth.userId, id);
      return reply.code(204).send();
    },
  );
  async function preferenceList(
    req: FastifyRequest,
    reply: FastifyReply,
    kind: 'blocks' | 'mutes',
  ) {
    if (!req.auth) return;
    const owner = kind === 'blocks' ? 'blocker_id' : 'muter_id',
      other = kind === 'blocks' ? 'blocked_id' : 'muted_id';
    const q = await pool.query(
      `SELECT p.user_id,p.username_normalized AS username,p.display_name,p.avatar_url,r.created_at FROM ${kind} r JOIN profiles p ON p.user_id=r.${other} WHERE r.${owner}=$1 ORDER BY r.created_at DESC,r.${other} DESC LIMIT 50`,
      [req.auth.userId],
    );
    return reply.send({ data: { items: q.rows }, request_id: req.requestId });
  }
  app.get('/v1/me/blocked', { preHandler: [consumer] }, async (req, reply) =>
    preferenceList(req, reply, 'blocks'),
  );
  app.get('/v1/me/muted', { preHandler: [consumer] }, async (req, reply) =>
    preferenceList(req, reply, 'mutes'),
  );
  const intentSchema = z.strictObject({
    purpose: z.enum(MEDIA_PURPOSES),
    mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    bytes: z
      .int()
      .min(1)
      .max(15 * 1024 * 1024),
  });
  const profileMediaSchema = z.strictObject({ mediaId: z.uuid() });
  function mediaFailure(
    error: unknown,
    reply: FastifyReply,
    requestId: string,
  ) {
    if (error instanceof MediaError) {
      const unavailable =
        error.code === 'NOT_FOUND' || error.code === 'NOT_FOUND_OR_REFERENCED';
      return fail(
        reply,
        unavailable ? 404 : 409,
        error.code,
        unavailable
          ? 'The media is unavailable.'
          : 'The media operation is not allowed.',
        requestId,
      );
    }
    throw error;
  }
  app.post(
    '/v1/media/upload-intents',
    { ...mediaLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      if (!media)
        return fail(
          reply,
          503,
          'MEDIA_UNAVAILABLE',
          'Media storage is unavailable.',
          req.requestId,
        );
      try {
        return reply.code(201).send({
          data: await media.createIntent(
            req.auth.userId,
            intentSchema.parse(req.body),
            req.requestId,
          ),
          request_id: req.requestId,
        });
      } catch (error) {
        return mediaFailure(error, reply, req.requestId);
      }
    },
  );
  app.post(
    '/v1/media/:id/complete',
    { ...mediaLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      if (!media)
        return fail(
          reply,
          503,
          'MEDIA_UNAVAILABLE',
          'Media storage is unavailable.',
          req.requestId,
        );
      try {
        return reply.code(202).send({
          data: await media.complete(
            req.auth.userId,
            uuid.parse((req.params as { id: string }).id),
            req.requestId,
          ),
          request_id: req.requestId,
        });
      } catch (error) {
        return mediaFailure(error, reply, req.requestId);
      }
    },
  );
  app.get('/v1/media/:id', { preHandler: [consumer] }, async (req, reply) => {
    if (!req.auth) return;
    if (!media)
      return fail(
        reply,
        503,
        'MEDIA_UNAVAILABLE',
        'Media storage is unavailable.',
        req.requestId,
      );
    try {
      return reply.send({
        data: await media.get(
          req.auth.userId,
          uuid.parse((req.params as { id: string }).id),
        ),
        request_id: req.requestId,
      });
    } catch (error) {
      return mediaFailure(error, reply, req.requestId);
    }
  });
  app.delete(
    '/v1/media/:id',
    { ...mediaLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      if (!media)
        return fail(
          reply,
          503,
          'MEDIA_UNAVAILABLE',
          'Media storage is unavailable.',
          req.requestId,
        );
      try {
        await media.remove(
          req.auth.userId,
          uuid.parse((req.params as { id: string }).id),
          req.requestId,
        );
        return reply.code(204).send();
      } catch (error) {
        return mediaFailure(error, reply, req.requestId);
      }
    },
  );
  for (const kind of ['avatar', 'cover'] as const)
    app.put(
      `/v1/me/${kind}`,
      { preHandler: [consumer, csrf] },
      async (req, reply) => {
        if (!req.auth) return;
        if (!media)
          return fail(
            reply,
            503,
            'MEDIA_UNAVAILABLE',
            'Media storage is unavailable.',
            req.requestId,
          );
        try {
          await media.attachProfile(
            req.auth.userId,
            profileMediaSchema.parse(req.body).mediaId,
            kind,
          );
          return reply.code(204).send();
        } catch (error) {
          return mediaFailure(error, reply, req.requestId);
        }
      },
    );
  app.post(
    '/v1/drops',
    { ...dropLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      try {
        return reply.code(201).send({
          data: await drops.create(
            req.auth.userId,
            req.body,
            'PUBLISHED',
            req.requestId,
            req.headers['idempotency-key'] as string | undefined,
          ),
          request_id: req.requestId,
        });
      } catch (error) {
        return dropFailure(error, reply, req.requestId);
      }
    },
  );
  app.get(
    '/v1/drops/:id',
    { preHandler: [optionalConsumer] },
    async (req, reply) => {
      try {
        return reply.send({
          data: await drops.get(
            uuid.parse((req.params as { id: string }).id),
            req.auth?.userId,
          ),
          request_id: req.requestId,
        });
      } catch (error) {
        return dropFailure(error, reply, req.requestId);
      }
    },
  );
  app.patch(
    '/v1/drops/:id',
    { ...dropLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      try {
        return reply.send({
          data: await drops.update(
            uuid.parse((req.params as { id: string }).id),
            req.auth.userId,
            req.body,
            req.requestId,
          ),
          request_id: req.requestId,
        });
      } catch (error) {
        return dropFailure(error, reply, req.requestId);
      }
    },
  );
  app.delete(
    '/v1/drops/:id',
    { ...dropLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      try {
        await drops.remove(
          uuid.parse((req.params as { id: string }).id),
          req.auth.userId,
          req.requestId,
        );
        return reply.code(204).send();
      } catch (error) {
        return dropFailure(error, reply, req.requestId);
      }
    },
  );
  app.get('/v1/me/drafts', { preHandler: [consumer] }, async (req, reply) => {
    if (!req.auth) return;
    return reply.send({
      data: await drops.listDrafts(req.auth.userId),
      request_id: req.requestId,
    });
  });
  app.post(
    '/v1/drafts',
    { ...dropLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      try {
        return reply.code(201).send({
          data: await drops.create(
            req.auth.userId,
            req.body,
            'DRAFT',
            req.requestId,
            req.headers['idempotency-key'] as string | undefined,
          ),
          request_id: req.requestId,
        });
      } catch (error) {
        return dropFailure(error, reply, req.requestId);
      }
    },
  );
  app.get('/v1/drafts/:id', { preHandler: [consumer] }, async (req, reply) => {
    if (!req.auth) return;
    try {
      return reply.send({
        data: await drops.get(
          uuid.parse((req.params as { id: string }).id),
          req.auth.userId,
        ),
        request_id: req.requestId,
      });
    } catch (error) {
      return dropFailure(error, reply, req.requestId);
    }
  });
  app.patch(
    '/v1/drafts/:id',
    { ...dropLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      try {
        return reply.send({
          data: await drops.update(
            uuid.parse((req.params as { id: string }).id),
            req.auth.userId,
            req.body,
            req.requestId,
          ),
          request_id: req.requestId,
        });
      } catch (error) {
        return dropFailure(error, reply, req.requestId);
      }
    },
  );
  app.delete(
    '/v1/drafts/:id',
    { ...dropLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      try {
        await drops.remove(
          uuid.parse((req.params as { id: string }).id),
          req.auth.userId,
          req.requestId,
        );
        return reply.code(204).send();
      } catch (error) {
        return dropFailure(error, reply, req.requestId);
      }
    },
  );
  app.post(
    '/v1/drafts/:id/publish',
    { ...dropLimited, preHandler: [consumer, csrf] },
    async (req, reply) => {
      if (!req.auth) return;
      try {
        return reply.send({
          data: await drops.publish(
            uuid.parse((req.params as { id: string }).id),
            req.auth.userId,
            req.requestId,
            req.headers['idempotency-key'] as string | undefined,
          ),
          request_id: req.requestId,
        });
      } catch (error) {
        return dropFailure(error, reply, req.requestId);
      }
    },
  );
  const engagementMutation = { ...engageLimited, preHandler: [consumer, csrf] };
  app.post('/v1/drops/:id/like', engagementMutation, async (req, reply) => {
    if (!req.auth) return;
    try {
      return reply.send({
        data: await engagement.like(
          uuid.parse((req.params as { id: string }).id),
          req.auth.userId,
          req.requestId,
        ),
        request_id: req.requestId,
      });
    } catch (e) {
      return engagementFailure(e, reply, req.requestId);
    }
  });
  app.delete('/v1/drops/:id/like', engagementMutation, async (req, reply) => {
    if (!req.auth) return;
    try {
      return reply.send({
        data: await engagement.unlike(
          uuid.parse((req.params as { id: string }).id),
          req.auth.userId,
          req.requestId,
        ),
        request_id: req.requestId,
      });
    } catch (e) {
      return engagementFailure(e, reply, req.requestId);
    }
  });
  app.post('/v1/drops/:id/comments', engagementMutation, async (req, reply) => {
    if (!req.auth) return;
    try {
      return reply.code(201).send({
        data: await engagement.comment(
          uuid.parse((req.params as { id: string }).id),
          req.auth.userId,
          req.body,
          req.requestId,
        ),
        request_id: req.requestId,
      });
    } catch (e) {
      return engagementFailure(e, reply, req.requestId);
    }
  });
  app.get(
    '/v1/drops/:id/comments',
    { preHandler: [consumer] },
    async (req, reply) => {
      if (!req.auth) return;
      try {
        return reply.send({
          data: await engagement.comments(
            uuid.parse((req.params as { id: string }).id),
            req.auth.userId,
            (req.query as { cursor?: string }).cursor,
          ),
          request_id: req.requestId,
        });
      } catch (e) {
        return engagementFailure(e, reply, req.requestId);
      }
    },
  );
  app.post(
    '/v1/comments/:id/replies',
    engagementMutation,
    async (req, reply) => {
      if (!req.auth) return;
      try {
        const id = uuid.parse((req.params as { id: string }).id);
        const q = await pool.query('SELECT drop_id FROM comments WHERE id=$1', [
          id,
        ]);
        if (!q.rowCount) throw new EngagementError('NOT_FOUND');
        return reply.code(201).send({
          data: await engagement.comment(
            q.rows[0].drop_id,
            req.auth.userId,
            req.body,
            req.requestId,
            id,
          ),
          request_id: req.requestId,
        });
      } catch (e) {
        return engagementFailure(e, reply, req.requestId);
      }
    },
  );
  app.delete('/v1/comments/:id', engagementMutation, async (req, reply) => {
    if (!req.auth) return;
    try {
      await engagement.removeComment(
        uuid.parse((req.params as { id: string }).id),
        req.auth.userId,
        req.requestId,
      );
      return reply.code(204).send();
    } catch (e) {
      return engagementFailure(e, reply, req.requestId);
    }
  });
  app.post('/v1/drops/:id/redrop', engagementMutation, async (req, reply) => {
    if (!req.auth) return;
    try {
      return reply.send({
        data: await engagement.redrop(
          uuid.parse((req.params as { id: string }).id),
          req.auth.userId,
          req.requestId,
        ),
        request_id: req.requestId,
      });
    } catch (e) {
      return engagementFailure(e, reply, req.requestId);
    }
  });
  app.delete('/v1/drops/:id/redrop', engagementMutation, async (req, reply) => {
    if (!req.auth) return;
    try {
      await engagement.unredrop(
        uuid.parse((req.params as { id: string }).id),
        req.auth.userId,
        req.requestId,
      );
      return reply.code(204).send();
    } catch (e) {
      return engagementFailure(e, reply, req.requestId);
    }
  });
  app.post(
    '/v1/drops/:id/quote-redrop',
    engagementMutation,
    async (req, reply) => {
      if (!req.auth) return;
      try {
        return reply.code(201).send({
          data: await engagement.quote(
            uuid.parse((req.params as { id: string }).id),
            req.auth.userId,
            req.body,
            req.requestId,
          ),
          request_id: req.requestId,
        });
      } catch (e) {
        return engagementFailure(e, reply, req.requestId);
      }
    },
  );
  app.post('/v1/drops/:id/save', engagementMutation, async (req, reply) => {
    if (!req.auth) return;
    try {
      await engagement.save(
        uuid.parse((req.params as { id: string }).id),
        req.auth.userId,
        req.requestId,
      );
      return reply.code(204).send();
    } catch (e) {
      return engagementFailure(e, reply, req.requestId);
    }
  });
  app.delete('/v1/drops/:id/save', engagementMutation, async (req, reply) => {
    if (!req.auth) return;
    try {
      await engagement.save(
        uuid.parse((req.params as { id: string }).id),
        req.auth.userId,
        req.requestId,
        true,
      );
      return reply.code(204).send();
    } catch (e) {
      return engagementFailure(e, reply, req.requestId);
    }
  });
  app.get('/v1/me/saved', { preHandler: [consumer] }, async (req, reply) => {
    if (!req.auth) return;
    return reply.send({
      data: await engagement.saved(
        req.auth.userId,
        (req.query as { cursor?: string }).cursor,
      ),
      request_id: req.requestId,
    });
  });
  app.post('/v1/drops/:id/view', engagementMutation, async (req, reply) => {
    if (!req.auth) return;
    try {
      return reply.send({
        data: await engagement.view(
          uuid.parse((req.params as { id: string }).id),
          req.auth.userId,
          req.requestId,
        ),
        request_id: req.requestId,
      });
    } catch (e) {
      return engagementFailure(e, reply, req.requestId);
    }
  });
  app.post('/v1/drops/:id/share', engagementMutation, async (req, reply) => {
    if (!req.auth) return;
    try {
      await engagement.share(
        uuid.parse((req.params as { id: string }).id),
        req.auth.userId,
        req.body,
      );
      return reply
        .code(202)
        .send({ data: { accepted: true }, request_id: req.requestId });
    } catch (e) {
      return engagementFailure(e, reply, req.requestId);
    }
  });
  const discoveryLimited = {
    preHandler: [consumer],
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  };
  const discoveryQuery = z.object({
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    q: z.string().trim().min(1).max(200).optional(),
  });
  function discoveryFailure(
    error: unknown,
    reply: FastifyReply,
    requestId: string,
  ) {
    if (error instanceof z.ZodError)
      return fail(
        reply,
        400,
        'VALIDATION_ERROR',
        'The discovery request is invalid.',
        requestId,
      );
    if (error instanceof DiscoveryError)
      return fail(
        reply,
        error.code === 'NOT_FOUND' ? 404 : 400,
        error.code,
        'The discovery resource is unavailable.',
        requestId,
      );
    throw error;
  }
  app.get('/v1/feed/following', discoveryLimited, async (req, reply) => {
    if (!req.auth) return;
    try {
      const q = discoveryQuery.parse(req.query);
      return reply.send({
        data: await discovery.following(req.auth.userId, q.cursor, q.limit),
        request_id: req.requestId,
      });
    } catch (e) {
      return discoveryFailure(e, reply, req.requestId);
    }
  });
  app.get('/v1/feed/for-you', discoveryLimited, async (req, reply) => {
    if (!req.auth) return;
    try {
      const q = discoveryQuery.parse(req.query);
      return reply.send({
        data: await discovery.forYou(req.auth.userId, q.cursor, q.limit),
        request_id: req.requestId,
      });
    } catch (e) {
      return discoveryFailure(e, reply, req.requestId);
    }
  });
  app.get('/v1/search/users', discoveryLimited, async (req, reply) => {
    if (!req.auth) return;
    try {
      const q = discoveryQuery
        .extend({ q: z.string().trim().min(1).max(100) })
        .parse(req.query);
      return reply.send({
        data: await discovery.searchUsers(
          req.auth.userId,
          q.q,
          q.cursor,
          q.limit,
        ),
        request_id: req.requestId,
      });
    } catch (e) {
      return discoveryFailure(e, reply, req.requestId);
    }
  });
  app.get('/v1/search/drops', discoveryLimited, async (req, reply) => {
    if (!req.auth) return;
    try {
      const q = discoveryQuery
        .extend({ q: z.string().trim().min(1).max(200) })
        .parse(req.query);
      return reply.send({
        data: await discovery.searchDrops(
          req.auth.userId,
          q.q,
          q.cursor,
          q.limit,
        ),
        request_id: req.requestId,
      });
    } catch (e) {
      return discoveryFailure(e, reply, req.requestId);
    }
  });
  app.get('/v1/search/hashtags', discoveryLimited, async (req, reply) => {
    if (!req.auth) return;
    try {
      const q = discoveryQuery
        .extend({ q: z.string().trim().min(1).max(51) })
        .parse(req.query);
      return reply.send({
        data: await discovery.searchHashtags(q.q, q.cursor, q.limit),
        request_id: req.requestId,
      });
    } catch (e) {
      return discoveryFailure(e, reply, req.requestId);
    }
  });
  app.get('/v1/search', discoveryLimited, async (req, reply) => {
    if (!req.auth) return;
    try {
      const q = discoveryQuery
        .extend({ q: z.string().trim().min(1).max(100) })
        .parse(req.query);
      const [users, drops, hashtags] = await Promise.all([
        discovery.searchUsers(req.auth.userId, q.q, undefined, 5),
        discovery.searchDrops(req.auth.userId, q.q, undefined, 10),
        discovery.searchHashtags(q.q, undefined, 5),
      ]);
      return reply.send({
        data: {
          users: users.items,
          drops: drops.items,
          hashtags: hashtags.items,
        },
        request_id: req.requestId,
      });
    } catch (e) {
      return discoveryFailure(e, reply, req.requestId);
    }
  });
  app.get('/v1/topics/:slug', discoveryLimited, async (req, reply) => {
    if (!req.auth) return;
    try {
      const slug = z
        .string()
        .regex(/^[a-z0-9-]{1,60}$/)
        .parse((req.params as { slug: string }).slug);
      return reply.send({
        data: await discovery.topic(slug, req.auth.userId),
        request_id: req.requestId,
      });
    } catch (e) {
      return discoveryFailure(e, reply, req.requestId);
    }
  });
  app.get(
    '/v1/discovery/suggested-users',
    discoveryLimited,
    async (req, reply) => {
      if (!req.auth) return;
      const q = discoveryQuery.parse(req.query);
      return reply.send({
        data: {
          items: await discovery.suggestedUsers(req.auth.userId, q.limit),
        },
        request_id: req.requestId,
      });
    },
  );
  app.get(
    '/v1/discovery/suggested-content',
    discoveryLimited,
    async (req, reply) => {
      if (!req.auth) return;
      const q = discoveryQuery.parse(req.query);
      return reply.send({
        data: await discovery.forYou(req.auth.userId, q.cursor, q.limit),
        request_id: req.requestId,
      });
    },
  );
  app.get(
    '/v1/discovery/trending-drops',
    discoveryLimited,
    async (req, reply) => {
      const q = discoveryQuery.parse(req.query);
      return reply.send({
        data: { items: await discovery.snapshots('drops', q.limit) },
        request_id: req.requestId,
      });
    },
  );
  app.get(
    '/v1/discovery/trending-topics',
    discoveryLimited,
    async (req, reply) => {
      const q = discoveryQuery.parse(req.query);
      return reply.send({
        data: { items: await discovery.snapshots('topics', q.limit) },
        request_id: req.requestId,
      });
    },
  );
  app.get(
    '/v1/discovery/top-creators',
    discoveryLimited,
    async (req, reply) => {
      const q = discoveryQuery.parse(req.query);
      return reply.send({
        data: {
          items: await discovery.snapshots('creators', Math.min(q.limit, 100)),
        },
        request_id: req.requestId,
      });
    },
  );
  const notificationRead = {
    preHandler: [consumer],
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  };
  const notificationWrite = {
    preHandler: [consumer, csrf],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  };
  const notificationFailure = (
    error: unknown,
    reply: FastifyReply,
    requestId: string,
  ) => {
    if (error instanceof z.ZodError)
      return fail(
        reply,
        400,
        'VALIDATION_ERROR',
        'The notification request is invalid.',
        requestId,
      );
    if (error instanceof NotificationError)
      return fail(
        reply,
        error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'INVALID_CURSOR'
            ? 400
            : 409,
        error.code,
        'The notification operation is unavailable.',
        requestId,
      );
    throw error;
  };
  app.get('/v1/notifications', notificationRead, async (req, reply) => {
    if (!req.auth) return;
    try {
      const q = z
        .object({
          cursor: z.string().max(500).optional(),
          limit: z.coerce.number().int().min(1).max(50).default(30),
        })
        .parse(req.query);
      return reply.send({
        data: await notifications.list(req.auth.userId, q.cursor, q.limit),
        request_id: req.requestId,
      });
    } catch (e) {
      return notificationFailure(e, reply, req.requestId);
    }
  });
  app.get(
    '/v1/notifications/unread-count',
    notificationRead,
    async (req, reply) => {
      if (!req.auth) return;
      return reply.send({
        data: { count: await notifications.unread(req.auth.userId) },
        request_id: req.requestId,
      });
    },
  );
  app.post(
    '/v1/notifications/:id/read',
    notificationWrite,
    async (req, reply) => {
      if (!req.auth) return;
      try {
        await notifications.read(
          req.auth.userId,
          uuid.parse((req.params as { id: string }).id),
        );
        return reply.code(204).send();
      } catch (e) {
        return notificationFailure(e, reply, req.requestId);
      }
    },
  );
  app.post(
    '/v1/notifications/read-all',
    notificationWrite,
    async (req, reply) => {
      if (!req.auth) return;
      return reply.send({
        data: { updated: await notifications.readAll(req.auth.userId) },
        request_id: req.requestId,
      });
    },
  );
  app.get(
    '/v1/me/notification-preferences',
    notificationRead,
    async (req, reply) => {
      if (!req.auth) return;
      return reply.send({
        data: { items: await notifications.preferences(req.auth.userId) },
        request_id: req.requestId,
      });
    },
  );
  app.patch(
    '/v1/me/notification-preferences',
    notificationWrite,
    async (req, reply) => {
      if (!req.auth) return;
      try {
        return reply.send({
          data: {
            items: await notifications.setPreferences(
              req.auth.userId,
              req.body,
            ),
          },
          request_id: req.requestId,
        });
      } catch (e) {
        return notificationFailure(e, reply, req.requestId);
      }
    },
  );
  app.post(
    '/v1/me/push-subscriptions',
    notificationWrite,
    async (req, reply) => {
      if (!req.auth) return;
      try {
        return reply.code(201).send({
          data: await notifications.subscribe(req.auth.userId, req.body),
          request_id: req.requestId,
        });
      } catch (e) {
        return notificationFailure(e, reply, req.requestId);
      }
    },
  );
  app.delete(
    '/v1/me/push-subscriptions/:id',
    notificationWrite,
    async (req, reply) => {
      if (!req.auth) return;
      try {
        await notifications.unsubscribe(
          req.auth.userId,
          uuid.parse((req.params as { id: string }).id),
        );
        return reply.code(204).send();
      } catch (e) {
        return notificationFailure(e, reply, req.requestId);
      }
    },
  );
  const clubRead = { preHandler: [optionalConsumer] };
  const clubWrite = { preHandler: [consumer, csrf], ...socialLimited };
  const clubFailure = (e: unknown, reply: FastifyReply, requestId: string) => {
    if (e instanceof z.ZodError)
      return fail(
        reply,
        400,
        'VALIDATION_ERROR',
        'The Club request is invalid.',
        requestId,
      );
    if (e instanceof ClubError)
      return fail(
        reply,
        e.code === 'NOT_FOUND'
          ? 404
          : e.code === 'FORBIDDEN' || e.code === 'OWNER_PROTECTED'
            ? 403
            : 409,
        e.code,
        'The Club operation is unavailable.',
        requestId,
      );
    const code = (e as { code?: string }).code;
    if (code === '23505' || code === '23514')
      return fail(
        reply,
        409,
        'CLUB_CONSTRAINT',
        'The Club operation conflicts with current state.',
        requestId,
      );
    throw e;
  };
  app.post('/v1/clubs', clubWrite, async (req, reply) => {
    if (!req.auth) return;
    try {
      return reply.code(201).send({
        data: await clubs.create(req.auth.userId, req.body, req.requestId),
        request_id: req.requestId,
      });
    } catch (e) {
      return clubFailure(e, reply, req.requestId);
    }
  });
  app.get('/v1/clubs/search', clubRead, async (req, reply) =>
    reply.send({
      data: {
        items: await clubs.search(
          String((req.query as { q?: string }).q ?? ''),
        ),
      },
      request_id: req.requestId,
    }),
  );
  app.get('/v1/clubs/:slug', clubRead, async (req, reply) => {
    try {
      return reply.send({
        data: await clubs.get(
          (req.params as { slug: string }).slug,
          req.auth?.userId,
        ),
        request_id: req.requestId,
      });
    } catch (e) {
      return clubFailure(e, reply, req.requestId);
    }
  });
  app.post('/v1/clubs/:slug/join', clubWrite, async (req, reply) => {
    if (!req.auth) return;
    try {
      return reply.send({
        data: await clubs.join(
          (req.params as { slug: string }).slug,
          req.auth.userId,
          req.requestId,
        ),
        request_id: req.requestId,
      });
    } catch (e) {
      return clubFailure(e, reply, req.requestId);
    }
  });
  app.delete('/v1/clubs/:slug/membership', clubWrite, async (req, reply) => {
    if (!req.auth) return;
    try {
      await clubs.leave((req.params as { slug: string }).slug, req.auth.userId);
      return reply.code(204).send();
    } catch (e) {
      return clubFailure(e, reply, req.requestId);
    }
  });
  app.delete(
    '/v1/clubs/:slug/join-requests/:id',
    clubWrite,
    async (req, reply) => {
      if (!req.auth) return;
      try {
        const p = req.params as { slug: string; id: string };
        await clubs.cancel(p.slug, uuid.parse(p.id), req.auth.userId);
        return reply.code(204).send();
      } catch (e) {
        return clubFailure(e, reply, req.requestId);
      }
    },
  );
  for (const decision of ['approve', 'reject'] as const)
    app.post(
      `/v1/clubs/:slug/join-requests/:id/${decision}`,
      clubWrite,
      async (req, reply) => {
        if (!req.auth) return;
        try {
          const p = req.params as { slug: string; id: string };
          return reply.send({
            data: await clubs.decide(
              p.slug,
              uuid.parse(p.id),
              req.auth.userId,
              decision === 'approve' ? 'APPROVED' : 'REJECTED',
              req.requestId,
            ),
            request_id: req.requestId,
          });
        } catch (e) {
          return clubFailure(e, reply, req.requestId);
        }
      },
    );
  app.patch(
    '/v1/clubs/:slug/members/:userId/role',
    clubWrite,
    async (req, reply) => {
      if (!req.auth) return;
      try {
        const p = req.params as { slug: string; userId: string };
        const role = z
          .enum(['ADMIN', 'MODERATOR', 'MEMBER'])
          .parse((req.body as { role?: unknown }).role);
        return reply.send({
          data: await clubs.setRole(
            p.slug,
            uuid.parse(p.userId),
            role,
            req.auth.userId,
            req.requestId,
          ),
          request_id: req.requestId,
        });
      } catch (e) {
        return clubFailure(e, reply, req.requestId);
      }
    },
  );
  app.get('/v1/clubs/:slug/drops', clubRead, async (req, reply) => {
    try {
      const q = req.query as { cursor?: string; sort?: string };
      return reply.send({
        data: await clubs.feed(
          (req.params as { slug: string }).slug,
          req.auth?.userId,
          q.cursor,
          q.sort === 'popular',
        ),
        request_id: req.requestId,
      });
    } catch (e) {
      return clubFailure(e, reply, req.requestId);
    }
  });
  app.get('/v1/clubs/:slug/trending', clubRead, async (req, reply) => {
    try {
      return reply.send({
        data: {
          items: await clubs.trending(
            (req.params as { slug: string }).slug,
            req.auth?.userId,
          ),
        },
        request_id: req.requestId,
      });
    } catch (e) {
      return clubFailure(e, reply, req.requestId);
    }
  });
  const chatRead = {
    preHandler: [consumer],
    config: { rateLimit: { max: 90, timeWindow: '1 minute' } },
  };
  const chatWrite = {
    preHandler: [consumer, csrf],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  };
  function chatFailure(error: unknown, reply: FastifyReply, requestId: string) {
    if (error instanceof z.ZodError)
      return fail(
        reply,
        400,
        'VALIDATION_ERROR',
        'The chat request is invalid.',
        requestId,
      );
    if (error instanceof ChatError)
      return fail(
        reply,
        error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'REQUEST_PENDING'
            ? 409
            : 403,
        error.code,
        'The chat operation is unavailable.',
        requestId,
      );
    throw error;
  }
  app.get('/v1/conversations', chatRead, async (req, reply) =>
    reply.send({
      data: { items: await chat.list(req.auth!.userId) },
      request_id: req.requestId,
    }),
  );
  app.post('/v1/conversations', chatWrite, async (req, reply) => {
    try {
      return reply.code(201).send({
        data: await chat.create(
          req.auth!.userId,
          z.object({ targetUserId: z.uuid() }).parse(req.body).targetUserId,
          req.requestId,
        ),
        request_id: req.requestId,
      });
    } catch (e) {
      return chatFailure(e, reply, req.requestId);
    }
  });
  app.get('/v1/message-requests', chatRead, async (req, reply) =>
    reply.send({
      data: { items: await chat.requests(req.auth!.userId) },
      request_id: req.requestId,
    }),
  );
  for (const action of ['accept', 'reject'] as const)
    app.post(
      `/v1/message-requests/:id/${action}`,
      chatWrite,
      async (req, reply) => {
        try {
          return reply.send({
            data: await chat.decide(
              uuid.parse((req.params as { id: string }).id),
              req.auth!.userId,
              action === 'accept' ? 'ACCEPTED' : 'DECLINED',
              req.requestId,
            ),
            request_id: req.requestId,
          });
        } catch (e) {
          return chatFailure(e, reply, req.requestId);
        }
      },
    );
  app.get('/v1/conversations/:id/messages', chatRead, async (req, reply) => {
    try {
      return reply.send({
        data: {
          items: await chat.messages(
            uuid.parse((req.params as { id: string }).id),
            req.auth!.userId,
            req.query,
          ),
        },
        request_id: req.requestId,
      });
    } catch (e) {
      return chatFailure(e, reply, req.requestId);
    }
  });
  app.post('/v1/conversations/:id/messages', chatWrite, async (req, reply) => {
    try {
      return reply.code(201).send({
        data: await chat.send(
          uuid.parse((req.params as { id: string }).id),
          req.auth!.userId,
          req.body,
          req.requestId,
        ),
        request_id: req.requestId,
      });
    } catch (e) {
      return chatFailure(e, reply, req.requestId);
    }
  });
  app.post('/v1/conversations/:id/read', chatWrite, async (req, reply) => {
    try {
      const sequence = z
        .object({ sequence: z.number().int().nonnegative() })
        .parse(req.body).sequence;
      return reply.send({
        data: await chat.read(
          uuid.parse((req.params as { id: string }).id),
          req.auth!.userId,
          sequence,
        ),
        request_id: req.requestId,
      });
    } catch (e) {
      return chatFailure(e, reply, req.requestId);
    }
  });
  app.delete('/v1/messages/:id', chatWrite, async (req, reply) => {
    try {
      await chat.remove(
        uuid.parse((req.params as { id: string }).id),
        req.auth!.userId,
        req.requestId,
      );
      return reply.code(204).send();
    } catch (e) {
      return chatFailure(e, reply, req.requestId);
    }
  });
  app.post('/v1/messages/:id/report', chatWrite, async (req, reply) => {
    try {
      await chat.report(
        uuid.parse((req.params as { id: string }).id),
        req.auth!.userId,
        z.object({ reason: z.string() }).parse(req.body).reason,
      );
      return reply
        .code(202)
        .send({ data: { accepted: true }, request_id: req.requestId });
    } catch (e) {
      return chatFailure(e, reply, req.requestId);
    }
  });
  return app;
}
