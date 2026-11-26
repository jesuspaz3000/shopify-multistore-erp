'use client';

import type { ShopResponse } from '@erp/contracts';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/http';
import { deleteShop } from '../api/shops.api';
import { countryLabel, STATUS_LABELS } from '../shop-options';
import ShopFormDialog from './ShopFormDialog';

type Props = { tenant: string; shops: ShopResponse[]; canManage: boolean };

/** Configuración → Tiendas: listado y alta/edición/baja (las tiendas aún no se conectan a Shopify). */
export default function ShopsManager({ tenant, shops, canManage }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<ShopResponse | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ShopResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const afterChange = (message: string) => {
    setToast(message);
    router.refresh(); // vuelve a pedir los datos del servidor (lista y selector de tienda)
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

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h6" component="h2">
            Tiendas
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Las tiendas Shopify que administras desde este ERP.
          </Typography>
        </Box>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
            Agregar tienda
          </Button>
        )}
      </Stack>

      {shops.length === 0 ? (
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
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tienda</TableCell>
                <TableCell>Moneda</TableCell>
                <TableCell>País</TableCell>
                <TableCell>Zona horaria</TableCell>
                <TableCell>Estado</TableCell>
                {canManage && <TableCell align="right">Acciones</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {shops.map((shop) => {
                const status = STATUS_LABELS[shop.status];
                return (
                  <TableRow key={shop.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {shop.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        /{tenant}/{shop.handle}
                      </Typography>
                    </TableCell>
                    <TableCell>{shop.currencyCode}</TableCell>
                    <TableCell>{countryLabel(shop.countryCode)}</TableCell>
                    <TableCell>{shop.ianaTimezone ?? '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={status.label} color={status.color} />
                    </TableCell>
                    {canManage && (
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
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
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
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

      <Dialog open={!!deleting} onClose={busy ? undefined : () => setDeleting(null)}>
        <DialogTitle>¿Eliminar la tienda?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Se eliminará <strong>{deleting?.name}</strong> del ERP. Esta acción no se puede deshacer.
          </DialogContentText>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)} disabled={busy} color="inherit">
            Cancelar
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained" loading={busy}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Stack>
  );
}
