import { adjustmentsQuerySchema } from '@erp/contracts';
import Alert from '@mui/material/Alert';
import { TableSectionSkeleton } from '@/components/skeletons';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getAdjustmentsPage } from '@/features/inventory/api/inventory.server';
import AdjustmentsTable from '@/features/inventory/components/AdjustmentsTable';
import { resolveLocation } from '@/features/inventory/resolve-location';
import { getLocationOptions } from '@/features/locations/api/locations.server';
import { can } from '@/features/tenant/permissions';
import { getMe } from '@/lib/session';
import { readTableQuery } from '@/lib/table-query';

export const metadata: Metadata = { title: 'Movimientos de inventario' };

type Props = PageProps<'/[tenant]/[shop]/inventory/adjustments'>;

export default function AdjustmentsPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<TableSectionSkeleton columns={7} />}>
      <AdjustmentsSection params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function AdjustmentsSection({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  const [{ tenant }, search] = await Promise.all([params, searchParams]);
  const me = await getMe();
  const membership = me?.memberships.find((m) => m.slug === tenant);
  if (!membership) notFound();
  if (!can(membership, 'inventory:read')) {
    return <Alert severity="info">Tu rol no permite ver el inventario.</Alert>;
  }

  const locations = await getLocationOptions(tenant);
  const location = resolveLocation(search, locations);
  const query = adjustmentsQuerySchema.parse({ ...readTableQuery(search), locationId: location.locationId });
  const page = await getAdjustmentsPage(tenant, query);

  return <AdjustmentsTable page={page} searchQuery={query.q} />;

}
