import { requireRole } from '@/lib/session';
import { getDb } from '@/lib/db';
import { listUserOrders } from '@/lib/services/orders';
import OrdersLive from '@/components/OrdersLive';
import { plain } from '@/lib/labels';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Orders | VINDU HAVELI' };
export default async function Orders() {
  const user = await requireRole('customer', '/orders');
  const orders = plain(await listUserOrders(await getDb(), user.id));
  return (<main className="section pt-28"><h1 className="font-serif text-4xl md:text-5xl gold-text">My Orders</h1><p className="mb-8 mt-2 text-taupe">Status updates appear here automatically.</p><OrdersLive initial={orders} /></main>);
}
