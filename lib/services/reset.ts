// Forgot password (customers) with an emailed one-time code:  1) request OTP  2) verify OTP  3) set new password.
// OTP: 6 digits, stored hashed, valid 5 minutes, 5 wrong tries, single use. After a correct OTP the server issues a single-use
// "reset permission" (random token, valid 10 minutes) that is required to set the new password.
import crypto from 'node:crypto';
import { Db } from '../db';
import { ApiError, bad, email as vEmail } from '../validate';
import { hashPassword, passwordProblem, safeEqual } from '../password';
import { sendEmail } from '../mail';

const OTP_TTL_MS = 5 * 60_000, TOKEN_TTL_MS = 10 * 60_000, MAX_TRIES = 5, RESEND_MS = 60_000;
const ready = new WeakSet<Db>();
async function ensure(db: Db) {
  if (ready.has(db)) return;
  await db.exec(`CREATE TABLE IF NOT EXISTS pw_reset (
    email TEXT PRIMARY KEY, otp_hash TEXT, otp_expires INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
    token_hash TEXT, token_expires INTEGER, sent_at INTEGER NOT NULL);`);
  ready.add(db);
}
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const otpHash = (email: string, otp: string) => sha(`otp|${email}|${otp}`);
const tokenHash = (email: string, token: string) => sha(`tok|${email}|${token}`);

/** Step 1. The caller always sees the same answer, whether or not the email belongs to a customer. */
export async function requestOtp(db: Db, rawEmail: unknown, now = Date.now()) {
  const email = vEmail(rawEmail); await ensure(db);
  const user = await db.prepare("SELECT name FROM users WHERE email = ? AND role = 'customer'").get(email); if (!user) return;
  const row = await db.prepare('SELECT sent_at FROM pw_reset WHERE email = ?').get(email);
  if (row && now - row.sent_at < RESEND_MS) return; // resend cooldown
  const otp = String(crypto.randomInt(100000, 1000000));
  await db.prepare('INSERT OR REPLACE INTO pw_reset (email, otp_hash, otp_expires, attempts, token_hash, token_expires, sent_at) VALUES (?,?,?,?,NULL,NULL,?)')
    .run(email, otpHash(email, otp), now + OTP_TTL_MS, 0, now);
  await sendEmail('otp', { to_email: email, customer_name: user.name, otp, valid_minutes: OTP_TTL_MS / 60_000 });
}

/** Step 2. A correct OTP is used up immediately and exchanged for a single-use reset permission. */
export async function verifyOtp(db: Db, rawEmail: unknown, otp: unknown, now = Date.now()): Promise<{ resetToken: string }> {
  const email = vEmail(rawEmail); await ensure(db);
  const wrong = () => new ApiError(400, 'That OTP is incorrect or has expired. Please try again or request a new OTP.');
  const row = await db.prepare('SELECT * FROM pw_reset WHERE email = ?').get(email);
  if (!row || !row.otp_hash || row.otp_expires < now) throw wrong();
  if (row.attempts >= MAX_TRIES) throw new ApiError(429, 'Too many wrong attempts. Please request a new OTP.');
  if (!/^\d{6}$/.test(String(otp ?? '').trim()) || !safeEqual(otpHash(email, String(otp).trim()), row.otp_hash)) {
    await db.prepare('UPDATE pw_reset SET attempts = attempts + 1 WHERE email = ?').run(email); throw wrong();
  }
  const resetToken = crypto.randomBytes(32).toString('hex');
  await db.prepare('UPDATE pw_reset SET otp_hash = NULL, otp_expires = NULL, token_hash = ?, token_expires = ? WHERE email = ?').run(tokenHash(email, resetToken), now + TOKEN_TTL_MS, email);
  return { resetToken };
}

/** Step 3. Needs the reset permission from step 2. Signs the customer out everywhere; does NOT log them in. */
export async function resetPassword(db: Db, rawEmail: unknown, resetToken: unknown, password: unknown, confirm: unknown, now = Date.now()) {
  const email = vEmail(rawEmail); await ensure(db);
  const pw = String(password ?? ''); const problem = passwordProblem(pw); if (problem) throw bad(problem);
  if (pw !== String(confirm ?? '')) throw bad('The two passwords do not match.');
  const expired = () => new ApiError(400, 'This reset session has expired. Please start again.');
  const row = await db.prepare('SELECT * FROM pw_reset WHERE email = ?').get(email);
  if (!row || !row.token_hash || row.token_expires < now) throw expired();
  if (!safeEqual(tokenHash(email, String(resetToken ?? '')), row.token_hash)) throw expired();
  const user = await db.prepare("SELECT id FROM users WHERE email = ? AND role = 'customer'").get(email); if (!user) throw expired();
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(pw), user.id);
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  await db.prepare('DELETE FROM pw_reset WHERE email = ?').run(email); // permission is single-use
}
