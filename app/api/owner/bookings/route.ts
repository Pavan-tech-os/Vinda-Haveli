import { handle } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { ownerOrderRefunded, ownerSetOrderStatus } from '@/lib/services/orders';
import { int, optStr } from '@/lib/validate';
import { notifyCustomerOrder } from '@/lib/notify';

export const PATCH = handle('owner', async ({ db, params, body }) => {
  const id = int(params.id, 'id', 1, 1e9);
  if (body.action === 'refunded') return { order: await ownerOrderRefunded(db, id) };
  const order = await ownerSetOrderStatus(db, id, String(body.status ?? ''), optStr(body.reason, 'Reason', 300));
  await notifyCustomerOrder(db, order); // success or failure email to the customer
  return { order };
});