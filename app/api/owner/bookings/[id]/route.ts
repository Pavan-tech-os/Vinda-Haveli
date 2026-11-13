import { handle } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { ownerMarkRefunded, ownerSetStatus } from '@/lib/services/bookings';
import { int, optStr } from '@/lib/validate';
import { notifyCustomerBooking } from '@/lib/notify';

export const PATCH = handle('owner', async ({ db, params, body }) => {
  const id = int(params.id, 'id', 1, 1e9);
  if (body.action === 'refunded') return { booking: await ownerMarkRefunded(db, id) };
  const booking = await ownerSetStatus(db, id, String(body.status ?? ''), optStr(body.reason, 'Reason', 300));
  await notifyCustomerBooking(booking); // success or failure email to the customer
  return { booking };
});