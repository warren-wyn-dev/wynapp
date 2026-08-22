export const CONSUMER_COOKIE = '__Host-wyn_session';
export const ADMIN_COOKIE = '__Host-wyn_admin_session';
export const CSRF_COOKIE = '__Host-wyn_csrf';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type CookieOptions = {
  path: string;
  secure?: boolean;
  sameSite?: 'lax';
  maxAge?: number;
  httpOnly?: boolean;
};
type CookieReply = {
  setCookie(name: string, value: string, options: CookieOptions): unknown;
  clearCookie(name: string, options: Pick<CookieOptions, 'path'>): unknown;
};

export function setConsumerCookies(
  reply: CookieReply,
  token: string,
  csrf: string,
): void {
  const common = {
    path: '/',
    // __Host- prefixed cookies are rejected by browsers unless Secure is set,
    // even on http://localhost, which Chrome/Firefox treat as a secure origin.
    secure: true,
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
  reply.setCookie(CONSUMER_COOKIE, token, { ...common, httpOnly: true });
  reply.setCookie(CSRF_COOKIE, csrf, { ...common, httpOnly: false });
}
export function clearConsumerCookies(reply: CookieReply): void {
  reply.clearCookie(CONSUMER_COOKIE, { path: '/' });
  reply.clearCookie(CSRF_COOKIE, { path: '/' });
}
export function clearAdminCookies(reply: CookieReply): void {
  reply.clearCookie(ADMIN_COOKIE, { path: '/' });
}
