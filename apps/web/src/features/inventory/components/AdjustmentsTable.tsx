'use client';

import type { AdjustmentResponse, Paginated } from '@erp/contracts';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import DataTable, { type Column } from '@/components/data-table/DataTable';
import TableSearch from '@/components/data-table/TableSearch';
import { REASON_LABELS } from '../inventory-labels';

type Props = { page: Paginated<AdjustmentResponse>; searchQuery?: string };

const formatDate = (iso: string) => new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });

/** Kardex: cada movimiento de stock, el más reciente primero. */
export default function AdjustmentsTable({ page, searchQuery }: Props) {
  const columns: Column<AdjustmentResponse>[] = [
    { key: 'date', header: 'Fecha', nowrap: true, render: (a) => formatDate(a.createdAt) },
    {
      key: 'product',
      header: 'Producto',
      minWidth: 200,
      render: (a) => (
        <>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {a.productTitle}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {[a.variantTitle, a.sku].filter(Boolean).join(' · ') || '—'}
          </Typography>
        </>
      ),
    },
    { key: 'location', header: 'Bodega', render: (a) => a.locationName },
    {
      key: 'delta',
      header: 'Cambio',
      align: 'right',
      render: (a) => (
        <Typography variant="body2" sx={{ fontWeight: 600, color: a.delta > 0 ? 'success.main' : 'error.main' }}>
          {a.delta > 0 ? `+${a.delta}` : a.delta}
        </Typography>
      ),
    },
    { key: 'after', header: 'Quedó en', align: 'right', render: (a) => a.quantityAfter ?? '—' },
    {
      key: 'reason',
      header: 'Motivo',
      minWidth: 180,
      render: (a) => (
        <>
          <Typography variant="body2">{REASON_LABELS[a.reason] ?? a.reason}</Typography>
          {a.note && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {a.note}
            </Typography>
          )}
        </>
      ),
    },
    { key: 'user', header: 'Por', render: (a) => (a.source === 'SHOPIFY' ? 'Shopify' : (a.userName ?? '—')) },
  ];

  return (
    <Stack spacing={2}>
      <TableSearch placeholder="Buscar por producto, variante o SKU…" />
      <DataTable
        columns={columns}
        data={page}
        getRowId={(a) => a.id}
        searchQuery={searchQuery}
        emptyMessage="Aún no hay movimientos."
        aria-label="Movimientos de inventario"
      />
    </Stack>
  );
}
