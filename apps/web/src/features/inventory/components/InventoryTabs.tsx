'use client';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from '@/components/ui/Link';
import { LOCATION_PARAM } from '../inventory-labels';

/** Pestañas Stock / Movimientos (al cambiar de pestaña se conserva la bodega elegida). */
export function TabsView({ query }: { query: string }) {
  const pathname = usePathname();
  const base = pathname.replace(/\/adjustments$/, '');
  const tab = pathname.endsWith('/adjustments') ? 'adjustments' : 'stock';
  return (
    <Tabs value={tab} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tab value="stock" label="Stock" component={Link} href={`${base}${query}`} />
      <Tab value="adjustments" label="Movimientos" component={Link} href={`${base}/adjustments${query}`} />
    </Tabs>
  );
}

export default function InventoryTabs() {
  const location = useSearchParams().get(LOCATION_PARAM);
  return <TabsView query={location ? `?${LOCATION_PARAM}=${encodeURIComponent(location)}` : ''} />;
}
