'use client';

import {
  type LocationResponse,
  setLocationShopsSchema,
  type ShopOptionResponse,
  STOCK_SYNC_MODES,
  type StockSyncMode,
} from '@erp/contracts';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Fragment, useState } from 'react';
import { ApiError } from '@/lib/http';
import { setLocationShops } from '../api/locations.api';
import { STOCK_MODE_LABELS } from '../location-labels';

type Row = { enabled: boolean; mode: StockSyncMode; percentage: string; buffer: string };

type Props = {
  tenant: string;
  location: LocationResponse;
  /** Tiendas visibles para el usuario (solo estas se pueden vincular o desvincular). */
  shops: ShopOptionResponse[];
  onClose: () => void;
  onSaved: () => void;
};

/** Qué tiendas abastece la bodega y cuánto de su stock publica en cada una. */
export default function LocationShopsDialog({ tenant, location, shops, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<Record<number, Row>>(() =>
    Object.fromEntries(
      shops.map((shop) => {
        const link = location.shops.find((l) => l.shopId === shop.id);
        const row: Row = {
          enabled: !!link,
          mode: link?.stockSyncMode ?? 'MIRROR',
          percentage: link?.stockPercentage?.toString() ?? '',
          buffer: link?.stockBuffer?.toString() ?? '',
        };
        return [shop.id, row];
      }),
    ),
  );
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const change = (shopId: number, patch: Partial<Row>) => {
    setRows((prev) => ({ ...prev, [shopId]: { ...prev[shopId], ...patch } }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[shopId];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const selected = shops.filter((shop) => rows[shop.id].enabled);
    const toNumber = (value: string) => (value.trim() === '' ? undefined : Number(value));
    const body = {
      shops: selected.map((shop) => {
        const row = rows[shop.id];
        return {
          shopId: shop.id,
          stockSyncMode: row.mode,
          ...(row.mode === 'PERCENTAGE' ? { stockPercentage: toNumber(row.percentage) } : {}),
          ...(row.mode === 'BUFFER' ? { stockBuffer: toNumber(row.buffer) } : {}),
        };
      }),
    };

    const parsed = setLocationShopsSchema.safeParse(body);
    if (!parsed.success) {
      // Errores por fila: path = ['shops', índice, campo]
      const next: Record<number, string> = {};
      for (const issue of parsed.error.issues) {
        const index = issue.path[1];
        if (typeof index === 'number') next[selected[index].id] ??= issue.message;
        else setFormError(issue.message);
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      await setLocationShops(tenant, location.id, parsed.data);
      onSaved();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Ocurrió un error inesperado');
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>Tiendas que abastece {location.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Si varias tiendas venden de la misma bodega, publicar solo una parte del stock en cada una evita sobreventas.
            </Typography>
            {formError && <Alert severity="error">{formError}</Alert>}
            {shops.length === 0 ? (
              <Alert severity="info" variant="outlined">
                Aún no hay tiendas. Agrégalas en la pestaña Tiendas.
              </Alert>
            ) : (
              <Box>
                {shops.map((shop, index) => {
                  const row = rows[shop.id];
                  return (
                    <Fragment key={shop.id}>
                      {index > 0 && <Divider />}
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        sx={{ py: 1.5, alignItems: { sm: 'flex-start' } }}
                      >
                        <FormControlLabel
                          sx={{ flex: 1, minWidth: 0, mt: { sm: 0.5 } }}
                          control={
                            <Checkbox checked={row.enabled} onChange={(e) => change(shop.id, { enabled: e.target.checked })} />
                          }
                          label={shop.name}
                        />
                        {row.enabled && (
                          <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
                            <TextField
                              select
                              size="small"
                              label="Stock publicado"
                              value={row.mode}
                              onChange={(e) => change(shop.id, { mode: e.target.value as StockSyncMode })}
                              helperText={errors[shop.id] ? undefined : STOCK_MODE_LABELS[row.mode].help}
                              sx={{ width: 200 }}
                            >
                              {STOCK_SYNC_MODES.map((mode) => (
                                <MenuItem key={mode} value={mode}>
                                  {STOCK_MODE_LABELS[mode].label}
                                </MenuItem>
                              ))}
                            </TextField>
                            {row.mode === 'PERCENTAGE' && (
                              <TextField
                                size="small"
                                type="number"
                                label="Porcentaje"
                                value={row.percentage}
                                onChange={(e) => change(shop.id, { percentage: e.target.value })}
                                error={!!errors[shop.id]}
                                helperText={errors[shop.id]}
                                slotProps={{
                                  input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                                  htmlInput: { min: 1, max: 100, 'aria-label': `Porcentaje para ${shop.name}` },
                                }}
                                sx={{ width: 130 }}
                              />
                            )}
                            {row.mode === 'BUFFER' && (
                              <TextField
                                size="small"
                                type="number"
                                label="Reserva"
                                value={row.buffer}
                                onChange={(e) => change(shop.id, { buffer: e.target.value })}
                                error={!!errors[shop.id]}
                                helperText={errors[shop.id]}
                                slotProps={{
                                  input: { endAdornment: <InputAdornment position="end">u.</InputAdornment> },
                                  htmlInput: { min: 0, step: 1, 'aria-label': `Unidades de reserva para ${shop.name}` },
                                }}
                                sx={{ width: 130 }}
                              />
                            )}
                          </Stack>
                        )}
                      </Stack>
                    </Fragment>
                  );
                })}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={submitting} color="inherit">
            Cancelar
          </Button>
          <Button type="submit" variant="contained" loading={submitting} disabled={shops.length === 0}>
            Guardar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
