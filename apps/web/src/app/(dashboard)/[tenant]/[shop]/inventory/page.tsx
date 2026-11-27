import { inventoryQuerySchema } from '@erp/contracts';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { TableSectionSkeleton } from '@/components/skeletons';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import Link from '@/components/ui/Link';
import { getInventoryPage } from '@/features/inventory/api/inventory.server';
import StockTable from '@/features/inventory/components/StockTable';
import { resolveLocation } from '@/features/inventory/resolve-location';
import { getLocationOptions } from '@/features/locations/api/locations.server';
import { can } from '@/features/tenant/permissions';
import { getMe } from '@/lib/session';
import { readTableQuery } from '@/lib/table-query';

export const metadata: Metadata = { title: 'Inventario' };

type Props = PageProps<'/[tenant]/[shop]/inventory'>;

export default function InventoryPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<TableSectionSkeleton />}>
      <InventorySection params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function InventorySection({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  const [{ tenant, shop }, search] = await Promise.all([params, searchParams]);
  const me = await getMe();
  const membership = me?.memberships.find((m) => m.slug === tenant);
  if (!membership) notFound();
  if (!can(membership, 'inventory:read')) {
    return <Alert severity="info">Tu rol no permite ver el inventario.</Alert>;
  }

  const locations = await getLocationOptions(tenant);
  if (locations.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderStyle: 'dashed' }}>
        <WarehouseOutlinedIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
        <Typography variant="subtitle1" sx={{ mt: 1 }}>
          Primero crea una bodega
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          El stock se lleva por bodega: agrega al menos una (activa) para registrar cantidades.
        </Typography>
        <Button component={Link} href={`/${tenant}/settings/locations`} variant="contained">
          Ir a Bodegas
        </Button>
      </Paper>
    );
  }

  const location = resolveLocation(search, locations, 'first');
  const query = inventoryQuerySchema.parse({ ...readTableQuery(search), locationId: location.locationId });
  const page = await getInventoryPage(tenant, query);

  return (
    <StockTable
        // Otra bodega = cambios pendientes descartados.
        key={location.value}
        tenant={tenant}
        shopPath={`/${tenant}/${shop}`}
        page={page}
        searchQuery={query.q}
        locationId={location.locationId ?? null}
      canWrite={can(membership, 'inventory:write')}
    />
  );
}
