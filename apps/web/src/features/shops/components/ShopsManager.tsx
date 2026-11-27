'use client';

import type { Paginated, ShopResponse } from '@erp/contracts';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SyncIcon from '@mui/icons-material/Sync';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import DataTable, { type Column } from '@/components/data-table/DataTable';
import TableSearch from '@/components/data-table/TableSearch';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { ApiError } from '@/lib/http';
import { useUiStore } from '@/stores/UiStoreProvider';
import { deleteShop, disconnectShopify, refreshShopify } from '../api/shops.api';
import { countryLabel, STATUS_LABELS } from '../shop-options';
import ConnectShopifyDialog from './ConnectShopifyDialog';

type Props = { tenant: string; page: Paginated<ShopResponse>; searchQuery?: string; canManage: boolean };

/**
 * Configuración → Tiendas: las tiendas llegan desde Shopify al conectarlas (con su nombre, moneda,
 * país y zona horaria). Se pueden actualizar desde Shopify, desconectar, reconectar y eliminar.
 */
export default function ShopsManager({ tenant, page, searchQuery, canManage }: Props) {
  const router = useRouter();
  // 'new' = conectar una tienda nueva; una tienda = reconectar esa (dominio fijo).
  const [connecting, setConnecting] = useState<ShopResponse | 'new' | null>(null);
  const [disconnecting, setDisconnecting] = useState<ShopResponse | null>(null);
  const [deleting, setDeleting] = useState<ShopResponse | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // Aviso global (AppShell): sobrevive al router.refresh() que vuelve a montar la página.
  const notify = useUiStore((s) => s.notify);

  const afterChange = (message: string, severity?: 'info') => {
    notify(message, severity);
    router.refresh(); // vuelve a pedir los datos del servidor (tabla y selector de tienda)
  };

  /** Ejecuta la acción de un diálogo de confirmación y muestra su error dentro del diálogo. */
  const confirm = async (action: () => Promise<unknown>, done: string, close: () => void, fallback: string) => {
    setBusy(true);
    setDialogError(null);
    try {
      await action();
      close();
      afterChange(done);
    } catch (error) {
      setDialogError(error instanceof ApiError ? error.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const refresh = async (shop: ShopResponse) => {
    setRefreshing(shop.id);
    try {
      const saved = await refreshShopify(tenant, shop.id);
      afterChange(`"${saved.name}" actualizada desde Shopify`);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'No se pudo actualizar desde Shopify', 'error');
    } finally {
      setRefreshing(null);
    }
  };

  const columns: Column<ShopResponse>[] = [
    {
      key: 'name',
      header: 'Tienda',
      minWidth: 220,
      render: (shop) => (
        <>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {shop.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {shop.myshopifyDomain ?? `/${tenant}/${shop.handle}`}
          </Typography>
        </>
      ),
    },
    { key: 'currency', header: 'Moneda', render: (shop) => shop.currencyCode },
    { key: 'country', header: 'País', render: (shop) => countryLabel(shop.countryCode) },
    { key: 'timezone', header: 'Zona horaria', render: (shop) => shop.ianaTimezone ?? '—' },
    { key: 'plan', header: 'Plan', render: (shop) => shop.shopify?.planName ?? '—' },
    {
      key: 'status',
      header: 'Estado',
      render: (shop) => {
        const status = STATUS_LABELS[shop.status];
        const missing = shop.shopify?.missingScopes ?? [];
        return (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Chip size="small" variant="outlined" label={status.label} color={status.color} />
            {missing.length > 0 && (
              <Tooltip
                title={`Faltan permisos en la app de Shopify: ${missing.join(', ')}. Agrégalos en el Dev Dashboard, lanza una versión nueva y vuelve a conectar.`}
              >
                <WarningAmberIcon fontSize="small" color="warning" aria-label="Faltan permisos" />
              </Tooltip>
            )}
          </Stack>
        );
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      nowrap: true,
      hidden: !canManage,
      render: (shop) =>
        shop.status === 'installed' ? (
          <>
            <Tooltip title="Actualizar desde Shopify">
              <span>
                <IconButton
                  size="small"
                  disabled={refreshing === shop.id}
                  onClick={() => void refresh(shop)}
                  aria-label={`Actualizar ${shop.name} desde Shopify`}
                >
                  {refreshing === shop.id ? <CircularProgress size={18} /> : <SyncIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Desconectar de Shopify">
              <IconButton size="small" onClick={() => setDisconnecting(shop)} aria-label={`Desconectar ${shop.name} de Shopify`}>
                <LinkOffIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <>
            <Tooltip title="Volver a conectar">
              <IconButton size="small" color="primary" onClick={() => setConnecting(shop)} aria-label={`Volver a conectar ${shop.name}`}>
                <LinkIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eliminar">
              <IconButton size="small" onClick={() => setDeleting(shop)} aria-label={`Eliminar ${shop.name}`}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
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
            Las tiendas Shopify conectadas a este ERP. Su nombre, moneda y zona horaria vienen de Shopify.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {!noShopsAtAll && <TableSearch placeholder="Buscar tienda…" />}
          {canManage && (
            <Button variant="contained" startIcon={<LinkIcon />} onClick={() => setConnecting('new')} sx={{ flexShrink: 0 }}>
              Conectar tienda de Shopify
            </Button>
          )}
        </Stack>
      </Stack>

      {noShopsAtAll ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderStyle: 'dashed' }}>
          <StorefrontIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            Aún no hay tiendas conectadas
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {canManage
              ? 'Conecta tu tienda de Shopify con la app que creaste en el Dev Dashboard.'
              : 'Un administrador debe conectar las tiendas.'}
          </Typography>
        </Paper>
      ) : (
        <DataTable columns={columns} data={page} getRowId={(s) => s.id} searchQuery={searchQuery} aria-label="Tiendas" />
      )}

      {connecting && (
        <ConnectShopifyDialog
          key={connecting === 'new' ? 'new' : connecting.id}
          tenant={tenant}
          shop={connecting === 'new' ? undefined : connecting}
          onClose={() => setConnecting(null)}
          onConnected={(saved) => {
            setConnecting(null);
            const missing = saved.shopify?.missingScopes ?? [];
            if (missing.length) afterChange(`"${saved.name}" conectada, pero faltan permisos: ${missing.join(', ')}`, 'info');
            else afterChange(`"${saved.name}" conectada con Shopify`);
          }}
        />
      )}

      <ConfirmDialog
        item={disconnecting}
        title={() => '¿Desconectar de Shopify?'}
        description={(shop) => (
          <>
            Se borrarán las credenciales guardadas de <strong>{shop.name}</strong>. La app seguirá instalada en Shopify y
            podrás volver a conectar la misma tienda cuando quieras.
          </>
        )}
        confirmLabel="Desconectar"
        busy={busy}
        error={dialogError}
        onConfirm={() =>
          disconnecting &&
          confirm(() => disconnectShopify(tenant, disconnecting.id), 'Tienda desconectada de Shopify', () => setDisconnecting(null), 'No se pudo desconectar la tienda')
        }
        onCancel={() => {
          setDisconnecting(null);
          setDialogError(null);
        }}
      />

      <ConfirmDialog
        item={deleting}
        title={() => '¿Eliminar la tienda?'}
        description={(shop) => (
          <>
            Se eliminará <strong>{shop.name}</strong> del ERP. En Shopify no se borra nada. Esta acción no se puede deshacer.
          </>
        )}
        busy={busy}
        error={dialogError}
        onConfirm={() =>
          deleting && confirm(() => deleteShop(tenant, deleting.id), 'Tienda eliminada', () => setDeleting(null), 'No se pudo eliminar la tienda')
        }
        onCancel={() => {
          setDeleting(null);
          setDialogError(null);
        }}
      />
    </Stack>
  );
}
