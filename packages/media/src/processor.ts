import sharp from 'sharp';
import {
  ALLOWED_INPUTS,
  MAX_DIMENSION,
  MAX_PIXELS,
  VARIANTS,
} from './constants.js';
import type { MediaStorage } from './storage.js';
export type Processed = {
  mime: 'image/webp';
  width: number;
  height: number;
  checksum: string;
  keys: { thumbnail: string; feed: string; full: string };
};
export async function processImage(
  id: string,
  input: Uint8Array,
  declaredMime: string,
  storage: MediaStorage,
): Promise<Processed> {
  if (!input.byteLength) throw new MediaValidationError('EMPTY_FILE');
  const base = sharp(input, {
    failOn: 'error',
    limitInputPixels: MAX_PIXELS,
    unlimited: false,
  });
  const meta = await base.metadata();
  const actual = `image/${meta.format === 'jpg' ? 'jpeg' : meta.format}`;
  if (!(ALLOWED_INPUTS as readonly string[]).includes(actual))
    throw new MediaValidationError('UNSUPPORTED_FORMAT');
  if (actual !== declaredMime) throw new MediaValidationError('MIME_MISMATCH');
  if (
    !meta.width ||
    !meta.height ||
    meta.width > MAX_DIMENSION ||
    meta.height > MAX_DIMENSION ||
    meta.width * meta.height > MAX_PIXELS
  )
    throw new MediaValidationError('DIMENSIONS_EXCEEDED');
  const keys = {
    thumbnail: `processed/${id}/thumbnail.webp`,
    feed: `processed/${id}/feed.webp`,
    full: `processed/${id}/full.webp`,
  };
  for (const [name, v] of Object.entries(VARIANTS)) {
    const output = await sharp(input, {
      failOn: 'error',
      limitInputPixels: MAX_PIXELS,
    })
      .rotate()
      .resize(v.width, v.height, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: v.quality })
      .toBuffer();
    await storage.writeProcessed(
      keys[name as keyof typeof keys],
      output,
      'image/webp',
    );
  }
  const { createHash } = await import('node:crypto');
  return {
    mime: 'image/webp',
    width: meta.width,
    height: meta.height,
    checksum: createHash('sha256').update(input).digest('hex'),
    keys,
  };
}
export class MediaValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
