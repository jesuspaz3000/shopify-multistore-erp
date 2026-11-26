'use client';

import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import { useEffect, useRef, useState } from 'react';
import { useTableParams } from './useTableParams';

type Props = {
  placeholder?: string;
  /** Mismo prefijo que la DataTable a la que filtra. */
  paramPrefix?: string;
};

/** Búsqueda de una tabla: escribe ?q= en la URL (con espera de 400 ms) y vuelve a la página 1. */
export default function TableSearch({ placeholder = 'Buscar…', paramPrefix = '' }: Props) {
  const { setParams, current } = useTableParams(paramPrefix);
  const urlQuery = current('q') ?? '';
  const [value, setValue] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Si la URL cambia por fuera (Atrás/Adelante, un link), el campo se actualiza.
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setValue(urlQuery);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (next: string) => {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setParams({ q: next.trim(), page: 1 }, 'replace'), 400);
  };

  return (
    <TextField
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      sx={{ width: { xs: '100%', sm: 280 } }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        },
        htmlInput: { 'aria-label': placeholder },
      }}
    />
  );
}
