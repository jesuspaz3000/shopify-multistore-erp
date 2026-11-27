import Alert from '@mui/material/Alert';
import { ListPageSkeleton } from '@/components/skeletons';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getLocationsPage } from '@/features/locations/api/locations.server';
import LocationsManager from '@/features/locations/components/LocationsManager';
import { getShopOptions } from '@/features/shops/api/shops.server';
import { can } from '@/features/tenant/permissions';
import { getMe } from '@/lib/session';
import { readTableQuery } from '@/lib/table-query';

export const metadata: Metadata = { title: 'Bodegas' };

type Props = PageProps<'/[tenant]/settings/locations'>;

export default function SettingsLocationsPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<ListPageSkeleton columns={6} />}>
      <LocationsSection params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function LocationsSection({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  const [{ tenant }, search] = await Promise.all([params, searchParams]);
  const me = await getMe();
  const membership = me?.memberships.find((m) => m.slug === tenant);
  if (!membership) notFound();

  if (!can(membership, 'inventory:read')) {
    return <Alert severity="info">Tu rol no permite ver las bodegas. Pídeselo a un administrador de la empresa.</Alert>;
  }

  const query = readTableQuery(search);
  const [page, shops] = await Promise.all([getLocationsPage(tenant, query), getShopOptions(tenant)]);

  return (
    <LocationsManager
      tenant={tenant}
      page={page}
      searchQuery={query.q}
      shops={shops}
      canManage={can(membership, 'inventory:write')}
    />
  );
}
