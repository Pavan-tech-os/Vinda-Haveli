import { requireRole } from '@/lib/session';
import OwnerDashboard from '@/components/owner/OwnerDashboard';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Owner Dashboard | VINDU HAVELI' };
export default async function Page() { const u = await requireRole('owner', '/owner/dashboard'); return <OwnerDashboard name={u.name} />; }
