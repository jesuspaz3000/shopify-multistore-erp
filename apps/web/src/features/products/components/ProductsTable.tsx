'use client';

import type { Paginated, ProductBulkAction, ProductListItem, ProductStatus } from '@erp/contracts';
import AddIcon from '@mui/icons-material/Add';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import DataTable, { type Column } from '@/components/data-table/DataTable';
import TableSearch from '@/components/data-table/TableSearch';
import { useTableParams } from '@/components/data-table/useTableParams';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Link from '@/components/ui/Link';
import TextLink from '@/components/ui/TextLink';
import { ApiError } from '@/lib/http';
import { useUiStore } from '@/stores/UiStoreProvider';
import { mediaSrc } from '../api/media.api';
import { bulkProducts } from '../api/products.api';
import { PRODUCT_STATUS_LABELS, priceRange } from '../product-labels';

type Props = {
  tenant: string;
  /** Base de las rutas de producto: /{tenant}/{shop}/products */
  basePath: string;
  page: Paginated<ProductListItem>;
  searchQuery?: string;
  status?: ProductStatus;
  /** Hay algún filtro activo (búsqueda o estado). */
  filtered: boolean;
  canWrite: boolean;
};

const TABS: { value: ProductStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'DRAFT', label: 'Borradores' },
  { value: 'ARCHIVED', label: 'Archivados' },
];

const BULK_DONE: Record<ProductBulkAction, string> = {
  activate: 'activado',
  draft: 'pasado a borrador',
  archive: 'archivado',
  delete: 'eliminado',
};

/** "50 en existencias para 3 variantes" (en rojo si no hay), como en Shopify. */
function InventoryText({ product }: { product: ProductListItem }) {
  if (product.trackedVariants === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        No se hace seguimiento del inventario
      </Typography>
    );
  }
  return (
    <Typography variant="body2">
      <Box component="span" sx={{ color: product.available <= 0 ? 'error.main' : undefined }}>
        {product.available} en existencias
      </Box>
      {product.variantsCount > 1 && ` para ${product.trackedVariants} variante${product.trackedVariants === 1 ? '' : 's'}`}
    </Typography>
  );
}

/** Catálogo maestro: pestañas por estado, búsqueda, selección y acciones en bloque. */
export default function ProductsTable({ tenant, basePath, page, searchQuery, status, filtered, canWrite }: Props) {
  const router = useRouter();
  const notify = useUiStore((s) => s.notify);
  const { setParams } = useTableParams();
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number[] | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // La selección es de la página visible: al cambiar de página o filtro se descarta.
  const [selectionPage, setSelectionPage] = useState(page);
  if (selectionPage !== page) {
    setSelectionPage(page);
    setSelected(new Set());
  }

  const run = async (action: ProductBulkAction, ids: number[]) => {
    setBusy(true);
    try {
      const { affected } = await bulkProducts(tenant, { action, ids });
      notify(`${affected} producto${affected === 1 ? '' : 's'} ${BULK_DONE[action]}${affected === 1 ? '' : 's'}`);
      setSelected(new Set());
      setConfirmDelete(null);
      router.refresh();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No se pudo completar la acción';
      if (action === 'delete') setDeleteError(message);
      else notify(message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const ids = [...selected].map(Number);

  const columns: Column<ProductListItem>[] = [
    {
      key: 'title',
      header: 'Producto',
      minWidth: 260,
      render: (p) => (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {/* Miniatura: imagen principal o un ícono si aún no tiene. */}
          <Avatar
            variant="rounded"
            src={p.imageUrl ? mediaSrc(p.imageUrl) : undefined}
            alt=""
            sx={{ width: 40, height: 40, bgcolor: 'action.hover', color: 'text.disabled', border: 1, borderColor: 'divider', '& img': { objectFit: 'contain' } }}
          >
            <ImageOutlinedIcon fontSize="small" />
          </Avatar>
          <TextLink href={`${basePath}/${p.id}`} variant="body2" sx={{ fontWeight: 500 }}>
            {p.title}
          </TextLink>
        </Stack>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (p) => {
        const s = PRODUCT_STATUS_LABELS[p.status];
        return <Chip size="small" label={s.label} color={s.color} variant={p.status === 'ACTIVE' ? 'filled' : 'outlined'} />;
      },
    },
    { key: 'inventory', header: 'Inventario', minWidth: 200, render: (p) => <InventoryText product={p} /> },
    { key: 'price', header: 'Precio', nowrap: true, render: (p) => priceRange(p.minPrice, p.maxPrice, p.currency) },
    { key: 'type', header: 'Tipo', render: (p) => p.productType ?? '—' },
    { key: 'vendor', header: 'Proveedor', render: (p) => p.vendor ?? '—' },
  ];

  const noneAtAll = page.total === 0 && !filtered;

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          Productos
        </Typography>
        {canWrite && (
          <Button component={Link} href={`${basePath}/new`} variant="contained" startIcon={<AddIcon />} sx={{ flexShrink: 0 }}>
            Agregar producto
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
            {canWrite ? 'Agrega tu primer producto con sus variantes (talla, color…).' : 'Alguien con permiso de catálogo debe crearlos.'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={0}>
          {/* Pestañas de estado + búsqueda, sobre la tabla (como en Shopify). */}
          <Paper variant="outlined" sx={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: 0, px: 1 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between', gap: 1, py: 1 }}>
              <Tabs
                value={status ?? ''}
                onChange={(_, value: string) => setParams({ status: value, page: 1 })}
                aria-label="Filtrar por estado"
                sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, py: 0 } }}
              >
                {TABS.map((t) => (
                  <Tab key={t.value} value={t.value} label={t.label} />
                ))}
              </Tabs>
              <TableSearch placeholder="Buscar por título, proveedor o SKU…" />
            </Stack>
          </Paper>
          <Box sx={{ '& > .MuiPaper-root': { borderTopLeftRadius: 0, borderTopRightRadius: 0 } }}>
            <DataTable
              columns={columns}
              data={page}
              getRowId={(p) => p.id}
              searchQuery={searchQuery}
              emptyMessage="No hay productos con ese filtro."
              aria-label="Productos"
              selection={
                canWrite
                  ? {
                      selected,
                      onChange: setSelected,
                      rowLabel: (p) => p.title,
                      actions: (
                        <>
                          <Button size="small" variant="outlined" disabled={busy} onClick={() => run('activate', ids)}>
                            Activar
                          </Button>
                          <Button size="small" variant="outlined" disabled={busy} onClick={() => run('draft', ids)}>
                            Pasar a borrador
                          </Button>
                          <Button size="small" variant="outlined" disabled={busy} onClick={() => run('archive', ids)}>
                            Archivar
                          </Button>
                          <Button size="small" color="error" disabled={busy} onClick={() => setConfirmDelete(ids)}>
                            Eliminar
                          </Button>
                        </>
                      ),
                    }
                  : undefined
              }
            />
          </Box>
        </Stack>
      )}

      <ConfirmDialog
        item={confirmDelete}
        title={(list) => `¿Eliminar ${list.length} producto${list.length === 1 ? '' : 's'}?`}
        description={() => 'Desaparecerán del catálogo junto con sus variantes. Sus SKU quedarán libres.'}
        busy={busy}
        error={deleteError}
        onConfirm={() => confirmDelete && run('delete', confirmDelete)}
        onCancel={() => {
          setConfirmDelete(null);
          setDeleteError(null);
        }}
      />
    </Stack>
  );
}
