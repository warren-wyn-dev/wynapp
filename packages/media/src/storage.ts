import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
export type ObjectMetadata = {
  bytes: number;
  contentType?: string | undefined;
};
export interface MediaStorage {
  signQuarantineUpload(
    key: string,
    mime: string,
    bytes: number,
    expiresSeconds: number,
  ): Promise<{ url: string; headers: Record<string, string> }>;
  headQuarantine(key: string): Promise<ObjectMetadata | null>;
  readQuarantine(key: string): Promise<Uint8Array>;
  writeProcessed(key: string, body: Uint8Array, mime: string): Promise<void>;
  deleteQuarantine(key: string): Promise<void>;
  deleteProcessed(key: string): Promise<void>;
  publicUrl(key: string): string;
}
export class S3MediaStorage implements MediaStorage {
  constructor(
    private readonly client: S3Client,
    private readonly quarantineBucket: string,
    private readonly processedBucket: string,
    private readonly cdnOrigin: string,
  ) {}
  async signQuarantineUpload(
    key: string,
    mime: string,
    bytes: number,
    expiresSeconds: number,
  ) {
    assertKey(key);
    const command = new PutObjectCommand({
      Bucket: this.quarantineBucket,
      Key: key,
      ContentType: mime,
      ContentLength: bytes,
    });
    return {
      url: await getSignedUrl(this.client, command, {
        expiresIn: expiresSeconds,
      }),
      headers: { 'content-type': mime },
    };
  }
  async headQuarantine(key: string) {
    assertKey(key);
    try {
      const v = await this.client.send(
        new HeadObjectCommand({ Bucket: this.quarantineBucket, Key: key }),
      );
      return { bytes: v.ContentLength ?? 0, contentType: v.ContentType };
    } catch (e) {
      if (
        (e as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      )
        return null;
      throw e;
    }
  }
  async readQuarantine(key: string) {
    assertKey(key);
    const v = await this.client.send(
      new GetObjectCommand({ Bucket: this.quarantineBucket, Key: key }),
    );
    if (!v.Body) throw new Error('OBJECT_MISSING');
    return new Uint8Array(await v.Body.transformToByteArray());
  }
  async writeProcessed(key: string, body: Uint8Array, mime: string) {
    assertKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.processedBucket,
        Key: key,
        Body: body,
        ContentType: mime,
        CacheControl: 'public,max-age=31536000,immutable',
      }),
    );
  }
  async deleteQuarantine(key: string) {
    assertKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.quarantineBucket, Key: key }),
    );
  }
  async deleteProcessed(key: string) {
    assertKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.processedBucket, Key: key }),
    );
  }
  publicUrl(key: string) {
    assertKey(key);
    return `${this.cdnOrigin.replace(/\/$/, '')}/${key}`;
  }
}
export function assertKey(key: string) {
  if (
    !/^(quarantine|processed)\/[0-9a-f-]{36}\/[a-z0-9._/-]+$/.test(key) ||
    key.includes('..')
  )
    throw new Error('INVALID_STORAGE_KEY');
}
/**
 * Shared by apps/api (signs uploads, serves media) and apps/worker
 * (processes uploads into variants) so the object-storage env contract
 * lives in one place. Returns undefined when storage isn't configured,
 * matching today's behavior of media routes responding 503 rather than
 * failing hard.
 */
export function createS3MediaStorageFromEnv(
  env: NodeJS.ProcessEnv,
): MediaStorage | undefined {
  const region = env.OBJECT_STORAGE_REGION;
  const quarantineBucket = env.OBJECT_STORAGE_QUARANTINE_BUCKET;
  const processedBucket = env.OBJECT_STORAGE_BUCKET;
  const cdnOrigin = env.OBJECT_STORAGE_CDN_ORIGIN;
  if (!region || !quarantineBucket || !processedBucket || !cdnOrigin)
    return undefined;
  const client = new S3Client({
    region,
    ...(env.OBJECT_STORAGE_ENDPOINT
      ? { endpoint: env.OBJECT_STORAGE_ENDPOINT }
      : {}),
    ...(env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true'
      ? { forcePathStyle: true }
      : {}),
    ...(env.OBJECT_STORAGE_ACCESS_KEY_ID && env.OBJECT_STORAGE_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
            secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });
  return new S3MediaStorage(
    client,
    quarantineBucket,
    processedBucket,
    cdnOrigin,
  );
}
