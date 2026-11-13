import { handle } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { ownerListOrders } from '@/lib/services/orders';

export const GET = handle('owner', async ({ req, db }) => {
  const q = new URL(req.url).searchParams;
  return { orders: await ownerListOrders(db, { status: q.get('status') || undefined, active: q.get('active') === '1' }) };
});
