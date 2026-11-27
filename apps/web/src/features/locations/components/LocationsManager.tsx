'use client';

import type { LocationResponse, Paginated, ShopOptionResponse } from '@erp/contracts';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
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
import { countryLabel } from '@/features/shops/shop-options';
import { ApiError } from '@/lib/http';
import { deleteLocation, updateLocation } from '../api/locations.api';
import { LOCATION_TYPE_LABELS, STOCK_MODE_LABELS, stockRuleSummary } from '../location-labels';
import LocationFormDialog from './LocationFormDialog';
import LocationShopsDialog from './LocationShopsDialog';

type Props = {
  tenant: string;
  page: Paginated<LocationResponse>;
  searchQuery?: string;
  /** Tiendas visibles para el usuario (nombres en la tabla y diálogo de tiendas). */
  shops: ShopOptionResponse[];
  canManage: boolean;
};

/** Configuración → Bodegas: ubicaciones físicas del ERP y qué tiendas abastece cada una. */
export default function LocationsManager({ tenant, page, searchQuery, shops, canManage }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<LocationResponse | 'new' | null>(null);
  const [linking, setLinking] = useState<LocationResponse | null>(null);
  const [deleting, setDeleting] = useState<LocationResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const afterChange = (message: string) => {
    setToast(message);
    router.refresh();
  };

  const shopName = (id: number) => shops.find((s) => s.id === id)?.name ?? `#${id}`;

  const toggleActive = async (location: LocationResponse) => {
    try {
      await updateLocation(tenant, location.id, { isActive: !location.isActive });
      afterChange(location.isActive ? 'Bodega desactivada' : 'Bodega activada');
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : 'No se pudo cambiar el estado');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteLocation(tenant, deleting.id);
      setDeleting(null);
      afterChange('Bodega eliminada');
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : 'No se pudo eliminar la bodega');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<LocationResponse>[] = [
    {
      key: 'name',
      header: 'Bodega',
      minWidth: 200,
      render: (l) => (
        <>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {l.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
            {l.code}
          </Typography>
        </>
      ),
    },
    { key: 'type', header: 'Tipo', render: (l) => LOCATION_TYPE_LABELS[l.type] },
    {
      key: 'place',
      header: 'Ubicación',
      render: (l) => [l.city, l.countryCode ? countryLabel(l.countryCode) : null].filter(Boolean).join(', ') || '—',
    },
    {
      key: 'shops',
      header: 'Abastece a',
      minWidth: 200,
      render: (l) =>
        l.shops.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Ninguna tienda
          </Typography>
        ) : (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {l.shops.map((link) => (
              <Tooltip key={link.shopId} title={STOCK_MODE_LABELS[link.stockSyncMode].help}>
                <Chip size="small" variant="outlined" label={`${shopName(link.shopId)} · ${stockRuleSummary(link)}`} />
              </Tooltip>
            ))}
          </Stack>
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (l) => (
        <Chip size="small" variant="outlined" label={l.isActive ? 'Activa' : 'Inactiva'} color={l.isActive ? 'success' : 'default'} />
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      nowrap: true,
      hidden: !canManage,
      render: (l) => (
        <>
          <Tooltip title="Tiendas que abastece">
            <IconButton size="small" onClick={() => setLinking(l)} aria-label={`Tiendas de ${l.name}`}>
              <StorefrontOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => setEditing(l)} aria-label={`Editar ${l.name}`}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={l.isActive ? 'Desactivar' : 'Activar'}>
            <IconButton size="small" onClick={() => toggleActive(l)} aria-label={`${l.isActive ? 'Desactivar' : 'Activar'} ${l.name}`}>
              {l.isActive ? <ToggleOnOutlinedIcon fontSize="small" /> : <ToggleOffOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton size="small" onClick={() => setDeleting(l)} aria-label={`Eliminar ${l.name}`}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  const noneAtAll = page.total === 0 && !searchQuery;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h6" component="h2">
            Bodegas
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Lugares donde guardas stock. Una bodega puede abastecer a varias tiendas.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {!noneAtAll && <TableSearch placeholder="Buscar por código, nombre o ciudad…" />}
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')} sx={{ flexShrink: 0 }}>
              Agregar bodega
            </Button>
          )}
        </Stack>
      </Stack>

      {noneAtAll ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderStyle: 'dashed' }}>
          <WarehouseOutlinedIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            Aún no hay bodegas
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {canManage ? 'Agrega tu primera bodega para empezar a llevar stock.' : 'Un encargado debe agregar las bodegas.'}
          </Typography>
        </Paper>
      ) : (
        <DataTable columns={columns} data={page} getRowId={(l) => l.id} searchQuery={searchQuery} aria-label="Bodegas" />
      )}

      {editing && (
        <LocationFormDialog
          key={editing === 'new' ? 'new' : editing.id}
          tenant={tenant}
          location={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            afterChange(editing === 'new' ? `Bodega "${saved.name}" agregada` : 'Cambios guardados');
          }}
        />
      )}

      {linking && (
        <LocationShopsDialog
          key={linking.id}
          tenant={tenant}
          location={linking}
          shops={shops}
          onClose={() => setLinking(null)}
          onSaved={() => {
            setLinking(null);
            afterChange('Tiendas actualizadas');
          }}
        />
      )}

      <ConfirmDialog
        item={deleting}
        title={() => '¿Eliminar la bodega?'}
        description={(l) => (
          <>
            <strong>{l.name}</strong> dejará de abastecer a todas las tiendas y desaparecerá de las listas. Su código quedará
            libre para otra bodega.
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
