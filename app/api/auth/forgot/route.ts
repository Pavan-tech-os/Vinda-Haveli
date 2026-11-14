import { handle, ipOf } from '@/lib/api';
import { ApiError } from '@/lib/validate';
import { requestOtp } from '@/lib/services/reset';
import { limited } from '@/lib/rate-limit';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = handle('public', async ({ req, db, body }) => {
  if (limited(`forgot:${ipOf(req)}`, 20, 15 * 60_000)) throw new ApiError(429, 'Too many requests. Please wait a few minutes and try again.');
  await requestOtp(db, body.email);
  return { ok: true };
});
