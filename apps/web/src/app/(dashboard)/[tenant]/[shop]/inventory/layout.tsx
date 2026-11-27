import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Suspense } from 'react';
import InventoryTabs, { TabsView } from '@/features/inventory/components/InventoryTabs';
import LocationSelect from '@/features/inventory/components/LocationSelect';
import { getLocationOptions } from '@/features/locations/api/locations.server';
import { can } from '@/features/tenant/permissions';
import { getMe } from '@/lib/session';

// Encabezado común de Stock y Movimientos. Al ser un layout se conserva al cambiar de pestaña:
// solo se recarga (y muestra skeleton) el contenido de la página.
export default function InventoryLayout({ children, params }: LayoutProps<'/[tenant]/[shop]/inventory'>) {
  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
            Inventario
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Stock real por bodega. Cada cambio queda registrado en Movimientos.
          </Typography>
        </Box>
        <Suspense fallback={<Skeleton variant="rounded" width={220} height={40} />}>
          <LocationPicker params={params} />
        </Suspense>
      </Stack>
      {/* useSearchParams (bodega elegida) va dentro de Suspense; mientras tanto, las mismas pestañas sin conservar la bodega. */}
      <Suspense fallback={<TabsView query="" />}>
        <InventoryTabs />
      </Suspense>
      {children}
    </Stack>
  );
}

async function LocationPicker({ params }: { params: LayoutProps<'/[tenant]/[shop]/inventory'>['params'] }) {
  const { tenant } = await params;
  const me = await getMe();
  const membership = me?.memberships.find((m) => m.slug === tenant);
  if (!membership || !can(membership, 'inventory:read')) return null;
  const locations = await getLocationOptions(tenant);
  return locations.length > 0 ? <LocationSelect locations={locations} /> : null;
}
