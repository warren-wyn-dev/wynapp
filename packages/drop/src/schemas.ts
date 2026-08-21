import { z } from 'zod';

const httpUrl = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'https:' || protocol === 'http:';
  }, 'Only HTTP(S) links are allowed.')
  .transform((value) => new URL(value).toString());
const poll = z.object({
  question: z.string().trim().min(1).max(280),
  options: z
    .array(z.string().trim().min(1).max(100))
    .min(2)
    .max(4)
    .refine(
      (v) => new Set(v.map((x) => x.toLocaleLowerCase())).size === v.length,
      'Poll options must be unique.',
    ),
  expiresAt: z.iso.datetime().optional(),
});
export const dropInputSchema = z
  .object({
    body: z.string().max(5000).default(''),
    caption: z.string().max(2200).default(''),
    visibility: z.enum(['PUBLIC', 'FOLLOWERS']).default('PUBLIC'),
    externalUrl: httpUrl.nullish(),
    locationLabel: z.string().trim().min(1).max(120).nullish(),
    mediaIds: z
      .array(z.uuid())
      .max(9)
      .default([])
      .refine(
        (v) => new Set(v).size === v.length,
        'Duplicate media is not allowed.',
      ),
    poll: poll.nullish(),
  })
  .refine(
    (v) =>
      Boolean(v.body.trim() || v.caption.trim() || v.mediaIds.length || v.poll),
    'A Drop cannot be empty.',
  );
export const dropPatchSchema = z.object({
  body: z.string().max(5000).optional(),
  caption: z.string().max(2200).optional(),
  visibility: z.enum(['PUBLIC', 'FOLLOWERS']).optional(),
  externalUrl: httpUrl.nullish(),
  locationLabel: z.string().trim().min(1).max(120).nullish(),
});
export type DropInput = z.infer<typeof dropInputSchema>;
export const HASHTAG = /#[\p{L}\p{N}_]{1,50}/gu;
export const MENTION = /@([a-z0-9_]{3,30})/gi;
export function extractTags(text: string) {
  return [
    ...new Set(
      [...text.matchAll(HASHTAG)].map((x) =>
        x[0].slice(1).normalize('NFKC').toLocaleLowerCase(),
      ),
    ),
  ].slice(0, 30);
}
export function extractMentions(text: string) {
  return [
    ...new Set(
      [...text.matchAll(MENTION)].map((x) => x[1]!.toLocaleLowerCase()),
    ),
  ].slice(0, 20);
}
