import { handle } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { getBookingByCode, customerCancel } from '@/lib/services/bookings';
import { ApiError } from '@/lib/validate';

export const GET = handle('user', async ({ db, user, params }) => {
  const b = await getBookingByCode(db, params.code);
  if (!b || (user!.role !== 'owner' && b.user_id !== user!.id)) throw new ApiError(404, 'Booking not found.');
  return { booking: b };
});
export const DELETE = handle('customer', async ({ db, user, params }) => ({ booking: await customerCancel(db, user!, params.code) }));
