/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type { Pool, PoolClient } from 'pg';
import {
  SENSITIVE_PERMISSIONS,
  permissionsFor,
  type AdminRole,
  type Permission,
} from './policy.js';

export class AdminError extends Error {
  constructor(
    public readonly code:
      | 'UNAUTHENTICATED'
      | 'FORBIDDEN'
      | 'STEP_UP_REQUIRED'
      | 'NOT_FOUND'
      | 'CONFLICT'
      | 'INVALID_TARGET',
  ) {
    super(code);
  }
}
export type AdminActor = {
  userId: string;
  sessionId: string;
  role: AdminRole;
  grants: string[];
  stepUpAt: Date | null;
};
const actionPermission = {
  NO_ACTION: 'case.triage',
  WARNING: 'moderation.warn',
  REMOVE_CONTENT: 'moderation.remove_content',
  RESTRICT: 'moderation.restrict',
  SUSPEND: 'moderation.suspend',
  BAN: 'moderation.ban',
} as const;

export class AdminService {
  constructor(private readonly pool: Pool) {}
  require(actor: AdminActor, permission: Permission): void {
    if (!permissionsFor(actor.role, actor.grants).has(permission))
      throw new AdminError('FORBIDDEN');
    if (
      SENSITIVE_PERMISSIONS.has(permission) &&
      (!actor.stepUpAt || Date.now() - actor.stepUpAt.getTime() > 10 * 60_000)
    )
      throw new AdminError('STEP_UP_REQUIRED');
  }
  async submitReport(
    reporterId: string,
    input: {
      targetType: 'USER' | 'DROP' | 'COMMENT' | 'CLUB' | 'MESSAGE';
      targetId: string;
      reasonCode: string;
      context?: string | undefined;
      sourceSurface: string;
      idempotencyKey: string;
    },
    requestId: string,
  ) {
    const table = {
      USER: ['users', 'id'],
      DROP: ['drops', 'id'],
      COMMENT: ['comments', 'id'],
      CLUB: ['clubs', 'id'],
      MESSAGE: ['messages', 'id'],
    }[input.targetType];
    const exists = await this.pool.query(
      `SELECT 1 FROM ${table[0]} WHERE ${table[1]}=$1`,
      [input.targetId],
    );
    if (!exists.rowCount) throw new AdminError('INVALID_TARGET');
    const q = await this.pool.query(
      'INSERT INTO reports(reporter_user_id,target_type,target_id,reason_code,context,source_surface,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(reporter_user_id,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING id,status',
      [
        reporterId,
        input.targetType,
        input.targetId,
        input.reasonCode,
        input.context ?? null,
        input.sourceSurface,
        input.idempotencyKey,
      ],
    );
    await this.pool.query(
      "INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id) VALUES('ReportCreated','Report',$1,$2,$3) ON CONFLICT DO NOTHING",
      [q.rows[0].id, { targetType: input.targetType }, requestId],
    );
    return q.rows[0];
  }
  async listReports(actor: AdminActor) {
    this.require(actor, 'report.read');
    return (
      await this.pool.query(
        'SELECT id,target_type,target_id,reason_code,source_surface,status,created_at FROM reports ORDER BY created_at DESC,id DESC LIMIT 100',
      )
    ).rows;
  }
  async createCase(actor: AdminActor, reportId: string, requestId: string) {
    this.require(actor, 'case.triage');
    return this.transaction(async (c) => {
      const r = await c.query(
        'SELECT target_type,target_id FROM reports WHERE id=$1 FOR UPDATE',
        [reportId],
      );
      if (!r.rowCount) throw new AdminError('NOT_FOUND');
      const q = await c.query(
        'INSERT INTO moderation_cases(target_type,target_id) VALUES($1,$2) RETURNING *',
        [r.rows[0].target_type, r.rows[0].target_id],
      );
      await c.query(
        'INSERT INTO case_reports(case_id,report_id) VALUES($1,$2)',
        [q.rows[0].id, reportId],
      );
      await c.query(
        "UPDATE reports SET status='LINKED_TO_CASE',updated_at=now() WHERE id=$1",
        [reportId],
      );
      await this.audit(
        c,
        actor,
        'CASE_CREATED',
        'case.triage',
        'CASE',
        q.rows[0].id,
        'Report triaged',
        requestId,
        {},
        q.rows[0],
      );
      return q.rows[0];
    });
  }
  async act(
    actor: AdminActor,
    caseId: string,
    input: {
      actionType: keyof typeof actionPermission;
      reasonCode: string;
      notes?: string | undefined;
      effectiveUntil?: Date | undefined;
      idempotencyKey: string;
      expectedVersion: number;
    },
    requestId: string,
  ) {
    const permission = actionPermission[input.actionType] as Permission;
    this.require(actor, permission);
    return this.transaction(async (c) => {
      const existing = await c.query(
        'SELECT * FROM moderation_actions WHERE actor_admin_id=$1 AND idempotency_key=$2',
        [actor.userId, input.idempotencyKey],
      );
      if (existing.rowCount) return existing.rows[0];
      const found = await c.query(
        'SELECT * FROM moderation_cases WHERE id=$1 FOR UPDATE',
        [caseId],
      );
      if (!found.rowCount) throw new AdminError('NOT_FOUND');
      if (found.rows[0].version !== input.expectedVersion)
        throw new AdminError('CONFLICT');
      const action = await c.query(
        'INSERT INTO moderation_actions(case_id,actor_admin_id,action_type,permission_used,reason_code,notes,effective_until,idempotency_key,request_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
        [
          caseId,
          actor.userId,
          input.actionType,
          permission,
          input.reasonCode,
          input.notes ?? null,
          input.effectiveUntil ?? null,
          input.idempotencyKey,
          requestId,
        ],
      );
      await this.enforce(
        c,
        found.rows[0].target_type,
        found.rows[0].target_id,
        input.actionType,
      );
      await c.query(
        "UPDATE moderation_cases SET status='ACTIONED',version=version+1,updated_at=now() WHERE id=$1",
        [caseId],
      );
      await this.audit(
        c,
        actor,
        'MODERATION_ACTION',
        permission,
        found.rows[0].target_type,
        found.rows[0].target_id,
        input.reasonCode,
        requestId,
        found.rows[0],
        { action: input.actionType },
      );
      return action.rows[0];
    });
  }
  private async enforce(
    c: PoolClient,
    type: string,
    id: string,
    action: string,
  ) {
    if (action === 'REMOVE_CONTENT') {
      const map: Record<string, string> = {
        DROP: 'drops',
        COMMENT: 'comments',
        CLUB: 'clubs',
        MESSAGE: 'messages',
      };
      const table = map[type];
      if (!table) throw new AdminError('INVALID_TARGET');
      // drops.status must stay in lockstep with deleted_at (drops_check1);
      // comments/clubs/messages only have a plain nullable deleted_at.
      await c.query(
        type === 'DROP'
          ? "UPDATE drops SET status='DELETED',deleted_at=COALESCE(deleted_at,now()) WHERE id=$1"
          : `UPDATE ${table} SET deleted_at=COALESCE(deleted_at,now()) WHERE id=$1`,
        [id],
      );
    }
    if (['RESTRICT', 'SUSPEND', 'BAN'].includes(action)) {
      if (type !== 'USER') throw new AdminError('INVALID_TARGET');
      await c.query(
        'UPDATE users SET account_state=$1,updated_at=now() WHERE id=$2',
        [
          action === 'RESTRICT'
            ? 'RESTRICTED'
            : action === 'SUSPEND'
              ? 'SUSPENDED'
              : 'BANNED',
          id,
        ],
      );
      await c.query(
        "UPDATE sessions SET revoked_at=now(),revocation_reason=$1 WHERE user_id=$2 AND realm='CONSUMER' AND revoked_at IS NULL",
        [`MODERATION_${action}`, id],
      );
    }
  }
  private audit(
    c: PoolClient,
    a: AdminActor,
    action: string,
    p: string,
    type: string,
    id: string | null,
    reason: string,
    requestId: string,
    before: object,
    after: object,
  ) {
    return c.query(
      'INSERT INTO admin_audit_logs(actor_admin_id,action,permission_used,target_type,target_id,reason,request_id,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [a.userId, action, p, type, id, reason, requestId, before, after],
    );
  }
  private async transaction<T>(fn: (c: PoolClient) => Promise<T>) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const result = await fn(c);
      await c.query('COMMIT');
      return result;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
}
