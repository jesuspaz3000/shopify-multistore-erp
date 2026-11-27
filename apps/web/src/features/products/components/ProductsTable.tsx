'use client';

import type { Paginated, ProductListItem } from '@erp/contracts';
import AddIcon from '@mui/icons-material/Add';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DataTable, { type Column } from '@/components/data-table/DataTable';
import TableFilterSelect from '@/components/data-table/TableFilterSelect';
import TableSearch from '@/components/data-table/TableSearch';
import Link from '@/components/ui/Link';
import TextLink from '@/components/ui/TextLink';
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUS_OPTIONS, priceRange } from '../product-labels';

type Props = {
  /** Base de las rutas de producto: /{tenant}/{shop}/products */
  basePath: string;
  page: Paginated<ProductListItem>;
  searchQuery?: string;
  /** Hay algún filtro activo (búsqueda o estado). */
  filtered: boolean;
  canWrite: boolean;
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es', { dateStyle: 'medium' });

/** Catálogo maestro: listado paginado con búsqueda y filtro por estado. */
export default function ProductsTable({ basePath, page, searchQuery, filtered, canWrite }: Props) {
  const columns: Column<ProductListItem>[] = [
    {
      key: 'title',
      header: 'Producto',
      minWidth: 240,
      render: (p) => (
        <>
          <TextLink href={`${basePath}/${p.id}`} variant="body2" sx={{ fontWeight: 500, display: 'block' }}>
            {p.title}
          </TextLink>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {[p.vendor, p.productType].filter(Boolean).join(' · ') || p.handle}
          </Typography>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (p) => {
        const status = PRODUCT_STATUS_LABELS[p.status];
        return <Chip size="small" variant="outlined" label={status.label} color={status.color} />;
      },
    },
    { key: 'variants', header: 'Variantes', align: 'right', render: (p) => p.variantsCount },
    { key: 'price', header: 'Precio', nowrap: true, render: (p) => priceRange(p.minPrice, p.maxPrice, p.currency) },
    { key: 'updated', header: 'Actualizado', nowrap: true, render: (p) => formatDate(p.updatedAt) },
  ];

  const noneAtAll = page.total === 0 && !filtered;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
            Productos
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Catálogo maestro de la empresa: un mismo producto podrá publicarse en varias tiendas.
          </Typography>
        </Box>
        {canWrite && (
          <Button component={Link} href={`${basePath}/new`} variant="contained" startIcon={<AddIcon />} sx={{ flexShrink: 0 }}>
            Nuevo producto
          </Button>
        )}
      </Stack>

      {noneAtAll ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderStyle: 'dashed' }}>
          <SellOutlinedIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            Aún no hay productos
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {canWrite ? 'Crea tu primer producto con sus variantes (talla, color…).' : 'Alguien con permiso de catálogo debe crearlos.'}
          </Typography>
        </Paper>
      ) : (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TableSearch placeholder="Buscar por título, marca o SKU…" />
            <TableFilterSelect param="status" label="Estado" options={PRODUCT_STATUS_OPTIONS} />
          </Stack>
          <DataTable
            columns={columns}
            data={page}
            getRowId={(p) => p.id}
            searchQuery={searchQuery}
            emptyMessage="No hay productos con ese filtro."
            aria-label="Productos"
          />
        </>
      )}
    </Stack>
  );
}
