'use client';

import type { Paginated } from '@erp/contracts';
import { PAGE_SIZE_OPTIONS } from '@erp/contracts';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useTableParams } from './useTableParams';

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  /** Ancho mínimo de la columna (px). */
  minWidth?: number;
  /** Evita el salto de línea (ej. columna de acciones). */
  nowrap?: boolean;
  /** Ocultar la columna (ej. acciones sin permiso). */
  hidden?: boolean;
};

type Props<T> = {
  columns: Column<T>[];
  /** Página que devolvió la API. */
  data: Paginated<T>;
  getRowId: (row: T) => string | number;
  /** Prefijo en la URL si la página tiene varias tablas (ej. 'inv' -> ?invPage=2). */
  paramPrefix?: string;
  /** Mensaje cuando no hay filas (con búsqueda activa se muestra "Sin resultados"). */
  emptyMessage?: ReactNode;
  /** Texto buscado actualmente (para el mensaje de vacío). */
  searchQuery?: string;
  'aria-label'?: string;
  /**
   * Selección múltiple (casillas) con acciones en bloque, como en Shopify: al seleccionar, la
   * cabecera muestra "N seleccionados" y las acciones. La selección es de la página visible.
   */
  selection?: {
    selected: Set<string | number>;
    onChange: (selected: Set<string | number>) => void;
    /** Nombre de la fila para el lector de pantalla ("Seleccionar Polera"). */
    rowLabel: (row: T) => string;
    /** Botones de acción mostrados cuando hay selección. */
    actions: ReactNode;
  };
};

/**
 * Tabla paginada reutilizable. La página y su tamaño viven en la URL (query params), así que
 * se pueden compartir, recargar y navegar con "Atrás". Los datos los trae el servidor.
 */
export default function DataTable<T>({
  columns,
  data,
  getRowId,
  paramPrefix = '',
  emptyMessage = 'No hay registros.',
  searchQuery,
  'aria-label': ariaLabel,
  selection,
}: Props<T>) {
  const { setParams, isPending } = useTableParams(paramPrefix);
  const visible = columns.filter((c) => !c.hidden);
  const pageIds = data.items.map(getRowId);
  const selectedHere = selection ? pageIds.filter((id) => selection.selected.has(id)).length : 0;
  const toggle = (ids: (string | number)[], on: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    selection.onChange(next);
  };
  const colSpan = visible.length + (selection ? 1 : 0);
  return (
    <Paper variant="outlined" sx={{ position: 'relative', overflow: 'hidden' }}>
      {/* Indicador mientras llega la nueva página (la anterior sigue visible) */}
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 1 }}>{isPending && <LinearProgress />}</Box>

      <TableContainer sx={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 150ms' }}>
        <Table size="small" aria-label={ariaLabel}>
          <TableHead>
            <TableRow>
              {selection && (
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={pageIds.length > 0 && selectedHere === pageIds.length}
                    indeterminate={selectedHere > 0 && selectedHere < pageIds.length}
                    onChange={(e) => toggle(pageIds, e.target.checked)}
                    disabled={pageIds.length === 0}
                    slotProps={{ input: { 'aria-label': 'Seleccionar todos' } }}
                  />
                </TableCell>
              )}
              {selection && selectedHere > 0 ? (
                // Con selección, la cabecera muestra el conteo y las acciones en bloque.
                <TableCell colSpan={visible.length} sx={{ py: 0.5 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mr: 1 }}>
                      {selectedHere} seleccionado{selectedHere === 1 ? '' : 's'}
                    </Typography>
                    {selection.actions}
                  </Stack>
                </TableCell>
              ) : (
                visible.map((c) => (
                  <TableCell key={c.key} align={c.align} sx={{ minWidth: c.minWidth, whiteSpace: c.nowrap ? 'nowrap' : undefined }}>
                    {c.header}
                  </TableCell>
                ))
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {searchQuery ? `Sin resultados para "${searchQuery}".` : emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((row) => (
                <TableRow key={getRowId(row)} hover selected={selection?.selected.has(getRowId(row))}>
                  {selection && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={selection.selected.has(getRowId(row))}
                        onChange={(e) => toggle([getRowId(row)], e.target.checked)}
                        slotProps={{ input: { 'aria-label': `Seleccionar ${selection.rowLabel(row)}` } }}
                      />
                    </TableCell>
                  )}
                  {visible.map((c) => (
                    <TableCell key={c.key} align={c.align} sx={{ whiteSpace: c.nowrap ? 'nowrap' : undefined }}>
                      {c.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {data.total > 0 && (
        <TablePagination
          component="div"
          count={data.total}
          page={Math.min(data.page, data.totalPages) - 1}
          rowsPerPage={data.pageSize}
          rowsPerPageOptions={[...PAGE_SIZE_OPTIONS]}
          onPageChange={(_, page) => setParams({ page: page + 1 })}
          onRowsPerPageChange={(e) => setParams({ pageSize: Number(e.target.value), page: 1 })}
          labelRowsPerPage="Filas por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
          getItemAriaLabel={(type) =>
            ({ first: 'Primera página', last: 'Última página', next: 'Página siguiente', previous: 'Página anterior' })[type]
          }
        />
      )}
    </Paper>
  );
}
