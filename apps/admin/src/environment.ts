import { z } from 'zod';
export const environment = z
  .object({ NEXT_PUBLIC_API_ORIGIN: z.string().url().optional() })
  .parse({ NEXT_PUBLIC_API_ORIGIN: process.env.NEXT_PUBLIC_API_ORIGIN });
