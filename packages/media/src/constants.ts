export const MEDIA_PURPOSES = [
  'PROFILE_AVATAR',
  'PROFILE_COVER',
  'CLUB_AVATAR',
  'CLUB_COVER',
  'DROP_IMAGE',
  'CLUB_IMAGE',
  'CHAT_IMAGE',
] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];
export const MEDIA_STATUSES = [
  'PENDING',
  'UPLOADED',
  'PROCESSING',
  'READY',
  'FAILED',
  'DELETED',
] as const;
export const ALLOWED_INPUTS = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_DIMENSION = 12000;
export const MAX_PIXELS = 40_000_000;
export const MAX_DROP_IMAGES = 9;
export const VARIANTS = {
  thumbnail: { width: 320, height: 320, quality: 76 },
  feed: { width: 1280, height: 1280, quality: 80 },
  full: { width: 2560, height: 2560, quality: 82 },
} as const;
