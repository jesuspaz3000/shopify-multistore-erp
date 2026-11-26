import Skeleton from '@mui/material/Skeleton';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import OverviewPanel from '@/features/dashboard/components/OverviewPanel';
import { getTenantShops } from '@/features/shops/api/shops.server';
import { getMe } from '@/lib/session';

export const metadata: Metadata = { title: 'Resumen' };

// Los datos se leen dentro de <Suspense>: la página aparece al instante con un placeholder.
export default function OverviewPage({ params }: PageProps<'/[tenant]/[shop]'>) {
  return (
    <Suspense fallback={<Skeleton variant="rounded" height={160} />}>
      <Overview params={params} />
    </Suspense>
  );
}

async function Overview({ params }: { params: PageProps<'/[tenant]/[shop]'>['params'] }) {
  const { tenant, shop } = await params;
  const [me, shops] = await Promise.all([getMe(), getTenantShops(tenant)]);
  if (!me) redirect('/login');

  const current = shops.find((s) => s.handle === shop);
  return (
    <OverviewPanel
      tenant={tenant}
      firstName={me.user.firstName}
      shopsCount={shops.length}
      scopeLabel={current ? `Tienda ${current.name}` : 'Vista consolidada de todas tus tiendas'}
    />
  );
}
