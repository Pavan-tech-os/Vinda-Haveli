import { handle } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { ownerListBookings, expireHolds } from '@/lib/services/bookings';

export const GET = handle('owner', async ({ req, db }) => {
  await expireHolds(db); const q = new URL(req.url).searchParams;
  return { bookings: await ownerListBookings(db, { date: q.get('date') || undefined, q: q.get('q') || undefined }) };
});
