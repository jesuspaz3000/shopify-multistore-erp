'use client';

import type { LocationOptionResponse } from '@erp/contracts';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { usePathname } from 'next/navigation';
import { useTableParams } from '@/components/data-table/useTableParams';
import { ALL_LOCATIONS, LOCATION_PARAM } from '../inventory-labels';

/**
 * Selector de bodega (?location=12 | all). Sin parámetro: todas las bodegas (la misma suma que la
 * lista de Productos). Misma regla que resolveLocation() en el servidor.
 */
export default function LocationSelect({ locations }: { locations: LocationOptionResponse[] }) {
  const pathname = usePathname();
  const { setParams, current } = useTableParams();
  const kardex = pathname.endsWith('/adjustments');
  const raw = current(LOCATION_PARAM);
  const value = locations.some((l) => String(l.id) === raw) ? raw! : ALL_LOCATIONS;

  return (
    <TextField
      select
      size="small"
      label="Bodega"
      value={value}
      onChange={(e) => setParams({ [LOCATION_PARAM]: e.target.value, page: 1 })}
      sx={{ minWidth: 220 }}
    >
      <MenuItem value={ALL_LOCATIONS}>{kardex ? 'Todas las bodegas' : 'Todas las bodegas (solo ver)'}</MenuItem>
      {locations.map((l) => (
        <MenuItem key={l.id} value={String(l.id)}>
          {l.name} ({l.code})
        </MenuItem>
      ))}
    </TextField>
  );
}
