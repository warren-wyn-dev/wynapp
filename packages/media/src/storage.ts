import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
export type ObjectMetadata = { bytes: number; contentType?: string | undefined };
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
