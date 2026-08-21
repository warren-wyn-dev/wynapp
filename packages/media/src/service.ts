import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  ALLOWED_INPUTS,
  MAX_DROP_IMAGES,
  MAX_UPLOAD_BYTES,
  type MediaPurpose,
} from './constants.js';
import { processImage } from './processor.js';
import type { MediaStorage } from './storage.js';
type Asset = {
  id: string;
  owner_user_id: string;
  purpose: MediaPurpose;
  status: string;
  source_mime: string;
  byte_size: number;
  storage_key: string;
  thumbnail_key?: string;
  feed_variant_key?: string;
  full_variant_key?: string;
};
async function outbox(
  c: PoolClient,
  type: string,
  id: string,
  owner: string,
  requestId: string,
) {
  await c.query(
    "INSERT INTO outbox_events(event_type,aggregate_type,aggregate_id,payload,request_id) VALUES($1,'MediaAsset',$2,jsonb_build_object('owner_user_id',$3::text),$4)",
    [type, id, owner, requestId],
  );
}
export class MediaService {
  constructor(
    private readonly pool: Pool,
    private readonly storage: MediaStorage,
  ) {}
  private async tx<T>(fn: (c: PoolClient) => Promise<T>) {
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
  async createIntent(
    owner: string,
    input: { purpose: MediaPurpose; mime: string; bytes: number },
    requestId: string,
  ) {
    if (
      !(ALLOWED_INPUTS as readonly string[]).includes(input.mime) ||
      input.bytes < 1 ||
      input.bytes > MAX_UPLOAD_BYTES
    )
      throw new MediaError('INVALID_MEDIA');
    const id = randomUUID(),
      key = `quarantine/${id}/source`;
    await this.tx(async (c) => {
      await c.query(
        "INSERT INTO media_assets(id,owner_user_id,purpose,source_mime,byte_size,storage_key,intent_expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '15 minutes')",
        [id, owner, input.purpose, input.mime, input.bytes, key],
      );
      await outbox(c, 'MediaUploadRequested', id, owner, requestId);
    });
    return {
      id,
      expiresIn: 900,
      upload: await this.storage.signQuarantineUpload(
        key,
        input.mime,
        input.bytes,
        900,
      ),
    };
  }
  async complete(owner: string, id: string, requestId: string) {
    const asset = await this.tx(async (c) => {
      const q = await c.query(
        'SELECT * FROM media_assets WHERE id=$1 AND owner_user_id=$2 FOR UPDATE',
        [id, owner],
      );
      const a = q.rows[0] as Asset | undefined;
      if (!a) throw new MediaError('NOT_FOUND');
      if (
        a.status === 'UPLOADED' ||
        a.status === 'PROCESSING' ||
        a.status === 'READY'
      )
        return a;
      if (a.status !== 'PENDING') throw new MediaError('INVALID_STATE');
      const head = await this.storage.headQuarantine(a.storage_key);
      if (
        !head ||
        head.bytes !== Number(a.byte_size) ||
        head.contentType !== a.source_mime
      )
        throw new MediaError('UPLOAD_INVALID');
      await c.query(
        "UPDATE media_assets SET status='UPLOADED',updated_at=now() WHERE id=$1",
        [id],
      );
      await outbox(c, 'MediaUploaded', id, owner, requestId);
      await outbox(c, 'MediaProcessingRequested', id, owner, requestId);
      return { ...a, status: 'UPLOADED' };
    });
    return { id: asset.id, status: asset.status };
  }
  async process(id: string, requestId: string) {
    const claimed = await this.tx(async (c) => {
      const q = await c.query(
        'SELECT * FROM media_assets WHERE id=$1 FOR UPDATE',
        [id],
      );
      const a = q.rows[0] as Asset | undefined;
      if (!a) throw new MediaError('NOT_FOUND');
      if (a.status === 'READY') return null;
      if (a.status !== 'UPLOADED' && a.status !== 'PROCESSING')
        throw new MediaError('INVALID_STATE');
      await c.query(
        "UPDATE media_assets SET status='PROCESSING',updated_at=now() WHERE id=$1",
        [id],
      );
      return a;
    });
    if (!claimed) return { id, status: 'READY' as const };
    try {
      const output = await processImage(
        id,
        await this.storage.readQuarantine(claimed.storage_key),
        claimed.source_mime,
        this.storage,
      );
      await this.tx(async (c) => {
        await c.query(
          "UPDATE media_assets SET status='READY',processed_mime=$2,width=$3,height=$4,checksum_sha256=$5,thumbnail_key=$6,feed_variant_key=$7,full_variant_key=$8,processed_at=now(),updated_at=now() WHERE id=$1 AND status='PROCESSING'",
          [
            id,
            output.mime,
            output.width,
            output.height,
            output.checksum,
            output.keys.thumbnail,
            output.keys.feed,
            output.keys.full,
          ],
        );
        await outbox(c, 'MediaReady', id, claimed.owner_user_id, requestId);
      });
      await this.storage.deleteQuarantine(claimed.storage_key);
      return { id, status: 'READY' as const };
    } catch (error) {
      await this.tx(async (c) => {
        await c.query(
          "UPDATE media_assets SET status='FAILED',updated_at=now() WHERE id=$1 AND status='PROCESSING'",
          [id],
        );
        await outbox(c, 'MediaFailed', id, claimed.owner_user_id, requestId);
      });
      throw error;
    }
  }
  async get(viewer: string | undefined, id: string) {
    // Once an asset is READY it's meant to be publicly viewable (it's
    // rendered as a plain <img src="/v1/media/:id"> for Drop images,
    // avatars, etc. by anyone who can see the content it's attached to —
    // and the underlying storage URL has no auth of its own either). While
    // still processing, only the owner can poll its status.
    const q = await this.pool.query(
      "SELECT id,purpose,status,width,height,thumbnail_key,feed_variant_key,full_variant_key,created_at,processed_at FROM media_assets WHERE id=$1 AND status<>'DELETED' AND (owner_user_id=$2 OR status='READY')",
      [id, viewer ?? null],
    );
    if (!q.rowCount) throw new MediaError('NOT_FOUND');
    const a = q.rows[0];
    return {
      ...a,
      ...(a.status === 'READY'
        ? {
            urls: {
              thumbnail: this.storage.publicUrl(a.thumbnail_key),
              feed: this.storage.publicUrl(a.feed_variant_key),
              full: this.storage.publicUrl(a.full_variant_key),
            },
          }
        : {}),
    };
  }
  async remove(owner: string, id: string, requestId: string) {
    await this.tx(async (c) => {
      const q = await c.query(
        "UPDATE media_assets SET status='DELETED',deleted_at=now(),updated_at=now() WHERE id=$1 AND owner_user_id=$2 AND status<>'DELETED' AND NOT EXISTS(SELECT 1 FROM profiles WHERE avatar_media_id=$1 OR cover_media_id=$1) AND NOT EXISTS(SELECT 1 FROM drop_media_attachments WHERE media_asset_id=$1) RETURNING id",
        [id, owner],
      );
      if (!q.rowCount) throw new MediaError('NOT_FOUND_OR_REFERENCED');
      await outbox(c, 'MediaDeleted', id, owner, requestId);
    });
  }
  async attachProfile(owner: string, id: string, kind: 'avatar' | 'cover') {
    const purpose = kind === 'avatar' ? 'PROFILE_AVATAR' : 'PROFILE_COVER',
      idColumn = kind === 'avatar' ? 'avatar_media_id' : 'cover_media_id',
      urlColumn = kind === 'avatar' ? 'avatar_url' : 'cover_url';
    await this.tx(async (c) => {
      const q = await c.query(
        "SELECT feed_variant_key FROM media_assets WHERE id=$1 AND owner_user_id=$2 AND purpose=$3 AND status='READY' FOR UPDATE",
        [id, owner, purpose],
      );
      if (!q.rowCount) throw new MediaError('NOT_FOUND');
      // profiles.avatar_url/cover_url (not avatar_media_id/cover_media_id)
      // is what every read path actually serves — GET /v1/me, GET
      // /v1/users/:username, etc. — so this has to be kept in sync here,
      // not just the media reference, or the picture never shows up
      // anywhere despite processing successfully.
      await c.query(
        `UPDATE profiles SET ${idColumn}=$1,${urlColumn}=$2,updated_at=now() WHERE user_id=$3`,
        [id, this.storage.publicUrl(q.rows[0].feed_variant_key), owner],
      );
    });
  }
  async attachDrop(owner: string, dropId: string, ids: readonly string[]) {
    if (
      ids.length < 1 ||
      ids.length > MAX_DROP_IMAGES ||
      new Set(ids).size !== ids.length
    )
      throw new MediaError('DROP_MEDIA_LIMIT');
    await this.tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        dropId,
      ]);
      const count = await c.query(
        'SELECT count(*)::int n FROM drop_media_attachments WHERE drop_id=$1',
        [dropId],
      );
      if (Number(count.rows[0].n) + ids.length > MAX_DROP_IMAGES)
        throw new MediaError('DROP_MEDIA_LIMIT');
      for (const [position, id] of ids.entries()) {
        const valid = await c.query(
          "SELECT 1 FROM media_assets WHERE id=$1 AND owner_user_id=$2 AND purpose='DROP_IMAGE' AND status='READY'",
          [id, owner],
        );
        if (!valid.rowCount) throw new MediaError('NOT_FOUND');
        await c.query(
          'INSERT INTO drop_media_attachments(drop_id,media_asset_id,position) VALUES($1,$2,$3)',
          [dropId, id, Number(count.rows[0].n) + position],
        );
      }
    });
  }
}
export class MediaError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
/**
 * Turns a MediaProcessingRequested outbox event into an actual call to
 * MediaService.process (variant generation via sharp + storage writes),
 * using the same claim-lease/retry/dead-letter mechanics as
 * NotificationWorker in apps/worker. Nothing previously consumed this
 * event at all, so uploaded media stayed at status UPLOADED forever.
 */
export class MediaWorker {
  constructor(
    private readonly pool: Pool,
    private readonly service: MediaService,
  ) {}
  async dispatch(): Promise<number> {
    const q = await this.pool.query(
      `WITH pending AS (SELECT id FROM outbox_events WHERE dispatched_at IS NULL AND event_type='MediaProcessingRequested' ORDER BY occurred_at LIMIT 100 FOR UPDATE SKIP LOCKED), deliveries AS (INSERT INTO outbox_deliveries(event_id,consumer) SELECT id,'media' FROM pending ON CONFLICT DO NOTHING) UPDATE outbox_events SET dispatched_at=now() WHERE id IN(SELECT id FROM pending) RETURNING id`,
    );
    return q.rowCount ?? 0;
  }
  async runOnce(): Promise<'IDLE' | 'PROCESSED' | 'RETRY' | 'DEAD_LETTER'> {
    const claimed = await this.pool.query(
      `UPDATE outbox_deliveries SET locked_until=now()+interval '30 seconds' WHERE (event_id,consumer)=(SELECT event_id,consumer FROM outbox_deliveries WHERE consumer='media' AND delivered_at IS NULL AND dead_lettered_at IS NULL AND available_at<=now() AND (locked_until IS NULL OR locked_until<now()) ORDER BY available_at,event_id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING event_id,attempt_count`,
    );
    if (!claimed.rowCount) return 'IDLE';
    const row = claimed.rows[0] as { event_id: string; attempt_count: number };
    try {
      const event = await this.pool.query(
        'SELECT aggregate_id,request_id FROM outbox_events WHERE id=$1',
        [row.event_id],
      );
      if (!event.rowCount) throw new MediaError('EVENT_NOT_FOUND');
      await this.service.process(
        event.rows[0].aggregate_id as string,
        event.rows[0].request_id as string,
      );
      await this.pool.query(
        "UPDATE outbox_deliveries SET delivered_at=now(),locked_until=NULL WHERE event_id=$1 AND consumer='media'",
        [row.event_id],
      );
      return 'PROCESSED';
    } catch (error) {
      const attempts = row.attempt_count + 1,
        dead = attempts >= 5;
      await this.pool.query(
        `UPDATE outbox_deliveries SET attempt_count=$2::integer,locked_until=NULL,last_error_code=$3,available_at=now()+make_interval(secs=>LEAST(300,power(2,$2::integer)::int)),dead_lettered_at=CASE WHEN $4 THEN now() END WHERE event_id=$1 AND consumer='media'`,
        [
          row.event_id,
          attempts,
          error instanceof Error ? error.name : 'UNKNOWN',
          dead,
        ],
      );
      return dead ? 'DEAD_LETTER' : 'RETRY';
    }
  }
}
