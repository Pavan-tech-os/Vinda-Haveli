import { handle } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { createOrder, listUserOrders } from '@/lib/services/orders';
import { createIntent } from '@/lib/services/payments';
import { notifyOwnerOrder } from '@/lib/notify';

export const GET = handle('customer', async ({ db, user }) => ({ orders: await listUserOrders(db, user!.id) }));

export const POST = handle('customer', async ({ db, user, body }) => {
  const order = await createOrder(db, user!, body);
  if (order.payment_method === 'cod') { await notifyOwnerOrder(order); return { order, intent: null }; }
  const intent = await createIntent(db, { purpose: 'order', refId: order.id, userId: user!.id, amountPaise: order.total * 100, receipt: order.code });
  return { order, intent };
});