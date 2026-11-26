'use client';

import StorefrontIcon from '@mui/icons-material/Storefront';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import { usePathname, useRouter } from 'next/navigation';
import type { ShopOption } from '../types';

export const ALL_SHOPS = 'all';

/**
 * Selector de tienda. Cambia el segmento [shop] de la URL manteniendo la sección actual:
 * /acme/all/orders -> /acme/tienda-cl/orders
 */
export default function ShopSwitcher({ tenant, shop, shops }: { tenant: string; shop: string; shops: ShopOption[] }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (event: SelectChangeEvent) => {
    const rest = pathname.split('/').slice(3).join('/');
    router.push(`/${tenant}/${event.target.value}${rest ? `/${rest}` : ''}`);
  };

  return (
    <Select
      size="small"
      value={shop}
      onChange={handleChange}
      startAdornment={<StorefrontIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />}
      sx={{ minWidth: { xs: 160, sm: 220 } }}
      inputProps={{ 'aria-label': 'Tienda' }}
    >
      <MenuItem value={ALL_SHOPS}>Todas las tiendas</MenuItem>
      {shops.length === 0 ? (
        <ListSubheader sx={{ lineHeight: 2.5 }}>Aún no hay tiendas conectadas</ListSubheader>
      ) : (
        shops.map((s) => (
          <MenuItem key={s.handle} value={s.handle}>
            {s.name}
          </MenuItem>
        ))
      )}
    </Select>
  );
}
