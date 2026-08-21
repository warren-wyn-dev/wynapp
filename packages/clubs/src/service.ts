/* PostgreSQL rows are constrained by the migration and all input is parameterized. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

const RESERVED = new Set([
  'admin',
  'support',
  'wyn',
  'system',
  'official',
  'security',
]);
const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(2)
    .max(50),
  description: z.string().trim().max(2000).default(''),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
  avatarMediaId: z.uuid().optional(),
  coverMediaId: z.uuid().optional(),
});
export type ClubRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
export class ClubError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
async function tx<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
const rank: Record<ClubRole, number> = {
  MEMBER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  OWNER: 3,
};

export class ClubService {
  constructor(private pool: Pool) {}
  private async role(c: PoolClient, clubId: string, actor: string) {
    const q = await c.query(
      'SELECT role FROM club_members WHERE club_id=$1 AND user_id=$2',
      [clubId, actor],
    );
    return q.rows[0]?.role as ClubRole | undefined;
  }
  private async club(c: PoolClient, slug: string, lock = false) {
    const q = await c.query(
      `SELECT * FROM clubs WHERE slug=lower($1) AND deleted_at IS NULL${lock ? ' FOR UPDATE' : ''}`,
      [slug],
    );
    if (!q.rowCount) throw new ClubError('NOT_FOUND');
    return q.rows[0];
  }
  private async audit(
    c: PoolClient,
    clubId: string,
    actor: string,
    action: string,
    requestId: string,
    target?: string,
    reason?: string,
  ) {
    await c.query(
      'INSERT INTO club_audit_events(club_id,actor_user_id,action,target_user_id,reason,request_id) VALUES($1,$2,$3,$4,$5,$6)',
      [clubId, actor, action, target ?? null, reason ?? null, requestId],
    );
  }
  async create(actor: string, input: unknown, requestId: string) {
    const d = createSchema.parse(input);
    if (RESERVED.has(d.slug)) throw new ClubError('RESERVED_SLUG');
    return tx(this.pool, async (c) => {
      for (const [id, purpose] of [
        [d.avatarMediaId, 'CLUB_AVATAR'],
        [d.coverMediaId, 'CLUB_COVER'],
      ] as const)
        if (id) {
          const m = await c.query(
            "SELECT 1 FROM media_assets WHERE id=$1 AND owner_user_id=$2 AND purpose=$3 AND status='READY'",
            [id, actor, purpose],
          );
          if (!m.rowCount) throw new ClubError('INVALID_MEDIA');
        }
      const q = await c.query(
        'INSERT INTO clubs(owner_user_id,name,slug,description,visibility,avatar_media_id,cover_media_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [
          actor,
          d.name,
          d.slug,
          d.description,
          d.visibility,
          d.avatarMediaId ?? null,
          d.coverMediaId ?? null,
        ],
      );
      await c.query(
        "INSERT INTO club_members(club_id,user_id,role) VALUES($1,$2,'OWNER')",
        [q.rows[0].id, actor],
      );
      await c.query(
        "INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id) VALUES('ClubCreated','Club',$1,$2,$3)",
        [q.rows[0].id, { actor_user_id: actor }, requestId],
      );
      return q.rows[0];
    });
  }
  async get(slug: string, viewer?: string) {
    return tx(this.pool, async (c) => {
      const club = await this.club(c, slug);
      const role = viewer ? await this.role(c, club.id, viewer) : undefined;
      const rules = await c.query(
        'SELECT id,title,description,position FROM club_rules WHERE club_id=$1 AND enabled ORDER BY position',
        [club.id],
      );
      return {
        id: club.id,
        name: club.name,
        slug: club.slug,
        description: club.description,
        visibility: club.visibility,
        member_count: club.member_count,
        avatar_media_id: club.avatar_media_id,
        cover_media_id: club.cover_media_id,
        rules: rules.rows,
        viewer_role: role ?? null,
        can_view_content: club.visibility === 'PUBLIC' || !!role,
      };
    });
  }
  async join(slug: string, actor: string, requestId: string) {
    return tx(this.pool, async (c) => {
      const club = await this.club(c, slug, true);
      const banned = await c.query(
        'SELECT 1 FROM club_bans WHERE club_id=$1 AND user_id=$2 AND (expires_at IS NULL OR expires_at>now())',
        [club.id, actor],
      );
      if (banned.rowCount) throw new ClubError('BANNED');
      const member = await this.role(c, club.id, actor);
      if (member) return { status: 'MEMBER' };
      if (club.visibility === 'PRIVATE') {
        const q = await c.query(
          "INSERT INTO club_join_requests(club_id,user_id) VALUES($1,$2) ON CONFLICT(club_id,user_id) WHERE status='PENDING' DO UPDATE SET updated_at=club_join_requests.updated_at RETURNING id",
          [club.id, actor],
        );
        await c.query(
          "INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id) VALUES('ClubJoinRequested','Club',$1,$2,$3)",
          [
            club.id,
            { actor_user_id: actor, request_id: q.rows[0].id },
            requestId,
          ],
        );
        return { status: 'PENDING', request_id: q.rows[0].id };
      }
      await c.query(
        'INSERT INTO club_members(club_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [club.id, actor],
      );
      await c.query(
        'UPDATE clubs SET member_count=(SELECT count(*) FROM club_members WHERE club_id=$1),updated_at=now() WHERE id=$1',
        [club.id],
      );
      return { status: 'MEMBER' };
    });
  }
  async leave(slug: string, actor: string) {
    return tx(this.pool, async (c) => {
      const club = await this.club(c, slug, true);
      if (club.owner_user_id === actor) throw new ClubError('OWNER_PROTECTED');
      await c.query(
        'DELETE FROM club_members WHERE club_id=$1 AND user_id=$2',
        [club.id, actor],
      );
      await c.query(
        'UPDATE clubs SET member_count=(SELECT count(*) FROM club_members WHERE club_id=$1),updated_at=now() WHERE id=$1',
        [club.id],
      );
    });
  }
  async cancel(slug: string, id: string, actor: string) {
    return tx(this.pool, async (c) => {
      const club = await this.club(c, slug);
      await c.query(
        "UPDATE club_join_requests SET status='CANCELLED',updated_at=now(),decided_at=now() WHERE id=$1 AND club_id=$2 AND user_id=$3 AND status='PENDING'",
        [id, club.id, actor],
      );
    });
  }
  async decide(
    slug: string,
    id: string,
    actor: string,
    decision: 'APPROVED' | 'REJECTED',
    requestId: string,
  ) {
    return tx(this.pool, async (c) => {
      const club = await this.club(c, slug, true);
      const role = await this.role(c, club.id, actor);
      if (!role || rank[role] < rank.ADMIN) throw new ClubError('FORBIDDEN');
      const q = await c.query(
        "UPDATE club_join_requests SET status=$1,decided_by_user_id=$2,decided_at=now(),updated_at=now() WHERE id=$3 AND club_id=$4 AND status='PENDING' RETURNING user_id",
        [decision, actor, id, club.id],
      );
      if (!q.rowCount) return { status: 'UNCHANGED' };
      if (decision === 'APPROVED') {
        await c.query(
          'INSERT INTO club_members(club_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [club.id, q.rows[0].user_id],
        );
        await c.query(
          'UPDATE clubs SET member_count=(SELECT count(*) FROM club_members WHERE club_id=$1) WHERE id=$1',
          [club.id],
        );
      }
      await this.audit(
        c,
        club.id,
        actor,
        `JOIN_REQUEST_${decision}`,
        requestId,
        q.rows[0].user_id,
      );
      return { status: decision };
    });
  }
  async setRole(
    slug: string,
    target: string,
    next: ClubRole,
    actor: string,
    requestId: string,
  ) {
    return tx(this.pool, async (c) => {
      const club = await this.club(c, slug, true);
      const actorRole = await this.role(c, club.id, actor),
        targetRole = await this.role(c, club.id, target);
      if (
        !actorRole ||
        !targetRole ||
        actorRole !== 'OWNER' ||
        targetRole === 'OWNER' ||
        next === 'OWNER'
      )
        throw new ClubError('OWNER_PROTECTED');
      await c.query(
        'UPDATE club_members SET role=$1 WHERE club_id=$2 AND user_id=$3',
        [next, club.id, target],
      );
      await this.audit(c, club.id, actor, 'ROLE_CHANGED', requestId, target);
      return { role: next };
    });
  }
  async feed(
    slug: string,
    viewer: string | undefined,
    cursor?: string,
    popular = false,
  ) {
    const club = await this.get(slug, viewer);
    if (!club.can_view_content) throw new ClubError('NOT_FOUND');
    const q = await this.pool.query(
      `SELECT d.id,d.author_user_id,d.body,d.caption,d.published_at,cp.pinned_at, (SELECT count(*) FROM drop_likes l WHERE l.drop_id=d.id AND l.scope='CLUB_INTERNAL') likes FROM drops d LEFT JOIN club_pinned_drops cp ON cp.drop_id=d.id AND cp.club_id=d.club_id WHERE d.club_id=$1 AND d.status='PUBLISHED' AND d.deleted_at IS NULL AND ($2::timestamptz IS NULL OR d.published_at<$2) ORDER BY ${popular ? 'likes DESC,' : ''} cp.pinned_at DESC NULLS LAST,d.published_at DESC LIMIT 21`,
      [club.id, cursor ?? null],
    );
    return {
      items: q.rows.slice(0, 20),
      next_cursor: q.rows.length > 20 ? q.rows[19].published_at : null,
    };
  }
  async trending(slug: string, viewer?: string) {
    const club = await this.get(slug, viewer);
    if (!club.can_view_content) throw new ClubError('NOT_FOUND');
    const q = await this.pool.query(
      `SELECT d.id,(1.5*ln(1+(SELECT count(*) FROM drop_likes l WHERE l.drop_id=d.id AND l.scope='CLUB_INTERNAL'))+2*ln(1+(SELECT count(*) FROM comments x WHERE x.drop_id=d.id AND x.scope='CLUB_INTERNAL' AND x.deleted_at IS NULL))+2.5*ln(1+(SELECT count(*) FROM redrops r WHERE r.original_drop_id=d.id AND r.scope='CLUB_INTERNAL' AND r.deleted_at IS NULL))+.5*ln(1+(SELECT count(*) FROM drop_views v WHERE v.drop_id=d.id AND v.scope='CLUB_INTERNAL')))*exp(-extract(epoch FROM(now()-d.published_at))/259200) score FROM drops d WHERE d.club_id=$1 AND d.status='PUBLISHED' AND d.deleted_at IS NULL ORDER BY score DESC,d.id LIMIT 50`,
      [club.id],
    );
    return q.rows;
  }
  async search(query: string) {
    const term = query.trim().slice(0, 100);
    const q = await this.pool.query(
      "SELECT id,name,slug,description,visibility,member_count FROM clubs WHERE deleted_at IS NULL AND (visibility='PUBLIC' OR visibility='PRIVATE') AND (name ILIKE '%'||$1||'%' OR slug ILIKE $1||'%') ORDER BY member_count DESC,id LIMIT 30",
      [term],
    );
    return q.rows.map((r) =>
      r.visibility === 'PRIVATE'
        ? {
            id: r.id,
            name: r.name,
            slug: r.slug,
            visibility: r.visibility,
            member_count: r.member_count,
          }
        : r,
    );
  }
}
