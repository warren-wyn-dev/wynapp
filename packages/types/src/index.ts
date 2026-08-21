export type Environment =
  | 'local'
  | 'development'
  | 'staging'
  | 'production'
  | 'test';
export interface ApiError {
  error: { code: string; message: string; requestId: string };
}
export interface RequestContext {
  requestId: string;
  correlationId: string;
}
export interface Pagination {
  limit: number;
  cursor?: string;
}
export interface FeatureFlags {
  clubs_enabled: boolean;
  chat_enabled: boolean;
  trending_enabled: boolean;
  top100_enabled: boolean;
}
export const defaultFeatureFlags: FeatureFlags = {
  clubs_enabled: false,
  chat_enabled: false,
  trending_enabled: false,
  top100_enabled: false,
};
