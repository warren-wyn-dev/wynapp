export type EngagementCounts = {
  likes_count: number;
  comments_count: number;
  redrops_count: number;
  views_count: number;
  liked: boolean;
  saved: boolean;
};

export type FeedDrop = EngagementCounts & {
  id: string;
  body?: string;
  caption?: string;
  created_at?: string;
  published_at?: string;
  username: string;
  display_name: string;
  hashtags?: string[];
  media?: { id: string; position: number }[];
  relationship_state?: 'NONE' | 'FOLLOWING' | 'REQUESTED';
  follow_request_id?: string;
};

export type PublicUser = {
  id?: string;
  username: string;
  display_name: string;
  bio?: string;
  rank?: number;
  relationship_state?: 'NONE' | 'FOLLOWING' | 'REQUESTED';
  follow_request_id?: string;
};

export type Topic = {
  slug: string;
  label?: string;
  score?: number;
  drop_count?: number;
};

export type PageData<T> = { items: T[]; next_cursor?: string | null };

export function pageData<T>(payload: unknown): PageData<T> {
  const envelope = payload as { data?: unknown };
  const data = envelope?.data ?? payload;
  if (Array.isArray(data)) return { items: data as T[], next_cursor: null };
  const page = data as {
    items?: T[];
    drops?: T[];
    next_cursor?: string | null;
  };
  return {
    items: page?.items ?? page?.drops ?? [],
    next_cursor: page?.next_cursor ?? null,
  };
}
