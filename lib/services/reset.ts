// Forgot password with a one-time code (OTP) sent by email. The code is valid for 10 minutes and allows 5 wrong tries.
import crypto from 'node:crypto';
import { Db } from '../db';
import { ApiError, bad, email as vEmail } from '../validate';
import { hashPassword, passwordProblem, safeEqual } from '../password';
import { esc, layout, sendMail } from '../mail';

const TTL_MS = 10 * 60_000, MAX_TRIES = 5, RESEND_MS = 60_000;
const ready = new WeakSet<Db>();
async function ensure(db: Db) {
  if (ready.has(db)) return;
  await db.exec('CREATE TABLE IF NOT EXISTS password_resets (email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);');
  ready.add(db);
}
const hashCode = (email: string, code: string) => crypto.createHash('sha256').update(`${email}|${code}`).digest('hex');

/** Step 1. Always behaves the same whether or not the email has an account (so nobody can probe for accounts). */
export async function requestReset(db: Db, rawEmail: unknown, now = Date.now()) {
  const email = vEmail(rawEmail); await ensure(db);
  const user = await db.prepare('SELECT name FROM users WHERE email = ?').get(email); if (!user) return;
  const old = await db.prepare('SELECT created_at FROM password_resets WHERE email = ?').get(email);
  if (old && now - Date.parse(old.created_at) < RESEND_MS) return; // at most one email per minute
  const code = String(crypto.randomInt(100000, 1000000));
  await db.prepare('INSERT OR REPLACE INTO password_resets (email, code_hash, expires_at, attempts, created_at) VALUES (?,?,?,?,?)').run(email, hashCode(email, code), now + TTL_MS, 0, new Date(now).toISOString());
  await sendMail(email, 'Your Vindu Haveli password reset code', layout('Reset your password',
    `<p>Hi ${esc(String(user.name).split(' ')[0])}, use this code to set a new password:</p><p style="font-size:32px;letter-spacing:8px;margin:14px 0"><b>${code}</b></p><p>It is valid for 10 minutes. If you did not ask for this, you can ignore this email; your password has not changed.</p>`));
}

/** Step 2. Checks the code, sets the new password and signs the user out everywhere. */
export async function resetPassword(db: Db, rawEmail: unknown, code: unknown, newPassword: unknown, now = Date.now()) {
  const email = vEmail(rawEmail); await ensure(db);
  const problem = passwordProblem(String(newPassword ?? '')); if (problem) throw bad(problem);
  const wrong = () => new ApiError(400, 'That code is incorrect or has expired. Please request a new one.');
  const row = await db.prepare('SELECT * FROM password_resets WHERE email = ?').get(email);
  if (!row || row.expires_at < now) throw wrong();
  if (row.attempts >= MAX_TRIES) throw new ApiError(429, 'Too many wrong attempts. Please request a new code.');
  if (!safeEqual(hashCode(email, String(code ?? '').trim()), row.code_hash)) { await db.prepare('UPDATE password_resets SET attempts = attempts + 1 WHERE email = ?').run(email); throw wrong(); }
  const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email); if (!user) throw wrong();
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(newPassword)), user.id);
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  await db.prepare('DELETE FROM password_resets WHERE email = ?').run(email);
}