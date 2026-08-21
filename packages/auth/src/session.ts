import type { FastifyReply } from 'fastify';
export const CONSUMER_COOKIE = '__Host-wyn_session';
export const ADMIN_COOKIE = '__Host-wyn_admin_session';
export const CSRF_COOKIE = '__Host-wyn_csrf';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export function setConsumerCookies(reply: FastifyReply, token: string, csrf: string): void {
 const common = { path: '/', secure: process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test', sameSite: 'lax' as const, maxAge: SESSION_MAX_AGE_SECONDS };
 reply.setCookie(CONSUMER_COOKIE, token, { ...common, httpOnly: true }); reply.setCookie(CSRF_COOKIE, csrf, { ...common, httpOnly: false });
}
export function clearConsumerCookies(reply: FastifyReply): void { reply.clearCookie(CONSUMER_COOKIE,{path:'/'}); reply.clearCookie(CSRF_COOKIE,{path:'/'}); }
