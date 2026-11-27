'use client';

import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useTableParams } from './useTableParams';

type Props = {
  /** Nombre del parámetro en la URL (ej. "status"). */
  param: string;
  label: string;
  options: readonly { value: string; label: string }[];
  /** Texto de la opción "sin filtro". */
  allLabel?: string;
  /** Mismo prefijo que la DataTable a la que filtra. */
  paramPrefix?: string;
};

/** Filtro de una tabla en la URL (?status=ACTIVE); al cambiarlo vuelve a la página 1. */
export default function TableFilterSelect({ param, label, options, allLabel = 'Todos', paramPrefix = '' }: Props) {
  const { setParams, current } = useTableParams(paramPrefix);
  const value = current(param) ?? '';

  return (
    <TextField
      select
      size="small"
      label={label}
      value={options.some((o) => o.value === value) ? value : ''}
      onChange={(e) => setParams({ [param]: e.target.value, page: 1 })}
      sx={{ minWidth: 150 }}
      slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
    >
      <MenuItem value="">{allLabel}</MenuItem>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
