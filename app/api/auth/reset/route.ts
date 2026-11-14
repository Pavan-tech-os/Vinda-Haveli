import { handle, ipOf } from '@/lib/api';
import { ApiError } from '@/lib/validate';
import { resetPassword } from '@/lib/services/reset';
import { limited } from '@/lib/rate-limit';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = handle('public', async ({ req, db, body }) => {
  if (limited(`reset:${ipOf(req)}`, 30, 15 * 60_000)) throw new ApiError(429, 'Too many attempts. Please wait a few minutes and try again.');
  await resetPassword(db, body.email, body.resetToken, body.password, body.confirm);
  return { ok: true };
});
