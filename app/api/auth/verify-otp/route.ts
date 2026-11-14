import { handle, ipOf } from '@/lib/api';
import { ApiError } from '@/lib/validate';
import { verifyOtp } from '@/lib/services/reset';
import { limited } from '@/lib/rate-limit';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = handle('public', async ({ req, db, body }) => {
  if (limited(`verify-otp:${ipOf(req)}`, 30, 15 * 60_000)) throw new ApiError(429, 'Too many attempts. Please wait a few minutes and try again.');
  return await verifyOtp(db, body.email, body.otp); // { resetToken }
});
