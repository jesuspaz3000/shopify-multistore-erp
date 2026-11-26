'use client';

import type { Paginated, ShopResponse } from '@erp/contracts';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import DataTable, { type Column } from '@/components/data-table/DataTable';
import TableSearch from '@/components/data-table/TableSearch';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { ApiError } from '@/lib/http';
import { deleteShop } from '../api/shops.api';
import { countryLabel, STATUS_LABELS } from '../shop-options';
import ShopFormDialog from './ShopFormDialog';

type Props = { tenant: string; page: Paginated<ShopResponse>; searchQuery?: string; canManage: boolean };

/** Configuración → Tiendas: listado paginado y alta/edición/baja (aún sin conexión a Shopify). */
export default function ShopsManager({ tenant, page, searchQuery, canManage }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<ShopResponse | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ShopResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const afterChange = (message: string) => {
    setToast(message);
    router.refresh(); // vuelve a pedir los datos del servidor (tabla y selector de tienda)
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteShop(tenant, deleting.id);
      setDeleting(null);
      afterChange('Tienda eliminada');
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : 'No se pudo eliminar la tienda');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<ShopResponse>[] = [
    {
      key: 'name',
      header: 'Tienda',
      minWidth: 200,
      render: (shop) => (
        <>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {shop.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            /{tenant}/{shop.handle}
          </Typography>
        </>
      ),
    },
    { key: 'currency', header: 'Moneda', render: (shop) => shop.currencyCode },
    { key: 'country', header: 'País', render: (shop) => countryLabel(shop.countryCode) },
    { key: 'timezone', header: 'Zona horaria', render: (shop) => shop.ianaTimezone ?? '—' },
    {
      key: 'status',
      header: 'Estado',
      render: (shop) => {
        const status = STATUS_LABELS[shop.status];
        return <Chip size="small" variant="outlined" label={status.label} color={status.color} />;
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      nowrap: true,
      hidden: !canManage,
      render: (shop) => (
        <>
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => setEditing(shop)} aria-label={`Editar ${shop.name}`}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={shop.status === 'pending_connection' ? 'Eliminar' : 'Solo se eliminan tiendas no conectadas'}>
            <span>
              <IconButton
                size="small"
                disabled={shop.status !== 'pending_connection'}
                onClick={() => setDeleting(shop)}
                aria-label={`Eliminar ${shop.name}`}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </>
      ),
    },
  ];

  // Sin tiendas y sin búsqueda: estado vacío ilustrado en lugar de una tabla vacía.
  const noShopsAtAll = page.total === 0 && !searchQuery;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h6" component="h2">
            Tiendas
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Las tiendas Shopify que administras desde este ERP.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {!noShopsAtAll && <TableSearch placeholder="Buscar tienda…" />}
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')} sx={{ flexShrink: 0 }}>
              Agregar tienda
            </Button>
          )}
        </Stack>
      </Stack>

      {noShopsAtAll ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderStyle: 'dashed' }}>
          <StorefrontIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            Aún no hay tiendas
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {canManage ? 'Agrega tu primera tienda para empezar.' : 'Un administrador debe agregar las tiendas.'}
          </Typography>
        </Paper>
      ) : (
        <DataTable columns={columns} data={page} getRowId={(s) => s.id} searchQuery={searchQuery} aria-label="Tiendas" />
      )}

      {editing && (
        <ShopFormDialog
          key={editing === 'new' ? 'new' : editing.id}
          tenant={tenant}
          shop={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            afterChange(editing === 'new' ? `Tienda "${saved.name}" agregada` : 'Cambios guardados');
          }}
        />
      )}

      <ConfirmDialog
        item={deleting}
        title={() => '¿Eliminar la tienda?'}
        description={(shop) => (
          <>
            Se eliminará <strong>{shop.name}</strong> del ERP. Esta acción no se puede deshacer.
          </>
        )}
        busy={busy}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
      />

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} message={toast} />
    </Stack>
  );
}
