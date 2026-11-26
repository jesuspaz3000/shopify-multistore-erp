'use client';

import { type CreateShopData, createShopSchema, type ShopResponse, type UpdateShopData, updateShopSchema } from '@erp/contracts';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useMemo } from 'react';
import type { z } from 'zod';
import { useZodForm } from '@/hooks/useZodForm';
import { createShop, updateShop } from '../api/shops.api';
import { COUNTRIES, CURRENCIES, timezoneOptions } from '../shop-options';

type ShopFormValues = { name: string; currencyCode: string; countryCode: string; ianaTimezone: string };

// Mismo formulario para crear y editar: al editar, un campo opcional vacío se borra (updateShopSchema).
const schemaFor = (editing: boolean) =>
  (editing ? updateShopSchema : createShopSchema) as unknown as z.ZodType<UpdateShopData, ShopFormValues>;

type Props = {
  tenant: string;
  /** Tienda a editar; sin ella el diálogo crea una nueva. */
  shop?: ShopResponse;
  onClose: () => void;
  onSaved: (shop: ShopResponse) => void;
};

export default function ShopFormDialog({ tenant, shop, onClose, onSaved }: Props) {
  const timezones = useMemo(() => timezoneOptions(), []);
  const editing = !!shop;

  const { values, setField, setValue, fieldErrors, formError, submitting, handleSubmit } = useZodForm(
    schemaFor(editing),
    {
      name: shop?.name ?? '',
      currencyCode: shop?.currencyCode ?? 'USD',
      countryCode: shop?.countryCode ?? '',
      ianaTimezone: shop?.ianaTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    async (input) => {
      const saved = editing ? await updateShop(tenant, shop.id, input) : await createShop(tenant, input as CreateShopData);
      onSaved(saved);
    },
  );

  return (
    <Dialog open onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{editing ? 'Editar tienda' : 'Agregar tienda'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {!editing && (
              <Alert severity="info" variant="outlined">
                La tienda se crea en el ERP como <strong>pendiente de conexión</strong>. Se vinculará con Shopify cuando
                se configure la app.
              </Alert>
            )}
            {formError && <Alert severity="error">{formError}</Alert>}

            <TextField
              label="Nombre de la tienda"
              autoFocus
              value={values.name}
              onChange={setField('name')}
              error={!!fieldErrors.name}
              helperText={fieldErrors.name ?? (editing ? `URL: /${tenant}/${shop.handle} (no cambia al renombrar)` : undefined)}
              fullWidth
            />
            <TextField
              select
              label="Moneda"
              value={values.currencyCode}
              onChange={setField('currencyCode')}
              error={!!fieldErrors.currencyCode}
              helperText={fieldErrors.currencyCode ?? 'Moneda en que la tienda registra sus precios y ventas'}
              fullWidth
            >
              {CURRENCIES.map((c) => (
                <MenuItem key={c.code} value={c.code}>
                  {c.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="País (opcional)"
              value={values.countryCode}
              onChange={setField('countryCode')}
              error={!!fieldErrors.countryCode}
              helperText={fieldErrors.countryCode}
              fullWidth
            >
              <MenuItem value="">
                <em>Sin especificar</em>
              </MenuItem>
              {COUNTRIES.map((c) => (
                <MenuItem key={c.code} value={c.code}>
                  {c.label}
                </MenuItem>
              ))}
            </TextField>
            <Autocomplete
              options={timezones}
              value={values.ianaTimezone || null}
              onChange={(_, value) => setValue('ianaTimezone', value ?? '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Zona horaria (opcional)"
                  error={!!fieldErrors.ianaTimezone}
                  helperText={fieldErrors.ianaTimezone ?? 'Se usa para reportes por día de la tienda'}
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={submitting} color="inherit">
            Cancelar
          </Button>
          <Button type="submit" variant="contained" loading={submitting}>
            {editing ? 'Guardar cambios' : 'Agregar tienda'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
