import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { processImage } from './processor.js';
import { assertKey, type MediaStorage } from './storage.js';
import { MAX_DROP_IMAGES } from './constants.js';
class MemoryStorage implements MediaStorage {
  writes = new Map<string, Uint8Array>();
  async signQuarantineUpload() {
    return { url: 'https://upload.invalid/signed', headers: {} };
  }
  async headQuarantine() {
    return null;
  }
  async readQuarantine() {
    return new Uint8Array();
  }
  async writeProcessed(k: string, b: Uint8Array) {
    this.writes.set(k, b);
  }
  async deleteQuarantine() {}
  async deleteProcessed() {}
  publicUrl(k: string) {
    return `https://cdn.invalid/${k}`;
  }
}
describe('media security', () => {
  it('uses exactly nine as the Drop ceiling', () =>
    expect(MAX_DROP_IMAGES).toBe(9));
  it('rejects traversal and accepts generated keys', () => {
    expect(() => assertKey('../secret')).toThrow('INVALID_STORAGE_KEY');
    expect(() =>
      assertKey('processed/00000000-0000-0000-0000-000000000000/full.webp'),
    ).not.toThrow();
  });
  it('rejects MIME spoofing', async () => {
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await expect(
      processImage(
        '00000000-0000-0000-0000-000000000000',
        bytes,
        'image/jpeg',
        new MemoryStorage(),
      ),
    ).rejects.toMatchObject({ code: 'MIME_MISMATCH' });
  });
  it('strips EXIF and writes three bounded variants', async () => {
    const input = await sharp({
      create: { width: 20, height: 10, channels: 3, background: 'blue' },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: 'private' } } })
      .toBuffer();
    const store = new MemoryStorage();
    await processImage(
      '00000000-0000-0000-0000-000000000000',
      input,
      'image/jpeg',
      store,
    );
    expect(store.writes.size).toBe(3);
    for (const bytes of store.writes.values())
      expect((await sharp(bytes).metadata()).exif).toBeUndefined();
  });
});
