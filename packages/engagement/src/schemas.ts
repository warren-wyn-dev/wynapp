import { z } from 'zod';
const safeText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (v) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(v),
      'Invalid control character',
    );
export const commentSchema = z.strictObject({ text: safeText(2000) });
export const quoteSchema = z.strictObject({ text: safeText(2000) });
export const shareSchema = z.strictObject({
  channel: z.enum(['WEB_SHARE', 'COPY_LINK']),
});
export const pageSchema = z.strictObject({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
