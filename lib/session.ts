// Server-only helpers that tie the cookie to the database session (use in route handlers and server components).
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from './db';
import { PublicUser, Role, createSession, destroySession, userFromToken } from './services/auth';

export const COOKIE = 'vh_session';

export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null; // visitors without a cookie never touch the database
  return userFromToken(await getDb(), token);
}
export async function startSession(userId: number) {
  const { token, maxAgeSec } = await createSession(await getDb(), userId);
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/', maxAge: maxAgeSec });
}
export async function endSession() {
  const token = cookies().get(COOKIE)?.value;
  if (token) await destroySession(await getDb(), token);
  cookies().set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}
export const homeFor = (role: Role) => (role === 'owner' ? '/owner/dashboard' : '/dashboard');

/** For server pages: send visitors to /login, or to their own dashboard if the role is wrong. */
export async function requireRole(role: Role, nextPath: string): Promise<PublicUser> {
  const u = await getCurrentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (u.role !== role) redirect(homeFor(u.role));
  return u;
}
export const clientIp = () => headers().get('x-forwarded-for')?.split(',')[0].trim() || headers().get('x-real-ip') || 'local';
