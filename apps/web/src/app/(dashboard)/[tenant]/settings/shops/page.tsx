import Skeleton from '@mui/material/Skeleton';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getTenantShops } from '@/features/shops/api/shops.server';
import ShopsManager from '@/features/shops/components/ShopsManager';
import { can } from '@/features/tenant/permissions';
import { getMe } from '@/lib/session';

export const metadata: Metadata = { title: 'Tiendas' };

export default function SettingsShopsPage({ params }: PageProps<'/[tenant]/settings/shops'>) {
  return (
    <Suspense fallback={<Skeleton variant="rounded" height={220} />}>
      <ShopsSection params={params} />
    </Suspense>
  );
}

async function ShopsSection({ params }: { params: PageProps<'/[tenant]/settings/shops'>['params'] }) {
  const { tenant } = await params;
  const [me, shops] = await Promise.all([getMe(), getTenantShops(tenant)]);
  const membership = me?.memberships.find((m) => m.slug === tenant);
  if (!membership) notFound();

  return <ShopsManager tenant={tenant} shops={shops} canManage={can(membership, 'shops:manage')} />;
}
