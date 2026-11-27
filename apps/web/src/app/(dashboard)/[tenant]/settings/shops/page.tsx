import { ListPageSkeleton } from '@/components/skeletons';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getShopsPage } from '@/features/shops/api/shops.server';
import ShopsManager from '@/features/shops/components/ShopsManager';
import { can } from '@/features/tenant/permissions';
import { getMe } from '@/lib/session';
import { readTableQuery } from '@/lib/table-query';

export const metadata: Metadata = { title: 'Tiendas' };

type Props = PageProps<'/[tenant]/settings/shops'>;

export default function SettingsShopsPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<ListPageSkeleton columns={6} />}>
      <ShopsSection params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ShopsSection({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  const [{ tenant }, search] = await Promise.all([params, searchParams]);
  const query = readTableQuery(search);
  const [me, page] = await Promise.all([getMe(), getShopsPage(tenant, query)]);
  const membership = me?.memberships.find((m) => m.slug === tenant);
  if (!membership) notFound();

  return <ShopsManager tenant={tenant} page={page} searchQuery={query.q} canManage={can(membership, 'shops:manage')} />;
}
