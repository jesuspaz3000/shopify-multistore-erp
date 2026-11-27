'use client';

import {
  type CreateLocationData,
  createLocationSchema,
  LOCATION_TYPES,
  type LocationResponse,
  type UpdateLocationData,
  updateLocationSchema,
} from '@erp/contracts';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { z } from 'zod';
import { COUNTRIES } from '@/features/shops/shop-options';
import { useZodForm } from '@/hooks/useZodForm';
import { createLocation, updateLocation } from '../api/locations.api';
import { LOCATION_TYPE_LABELS } from '../location-labels';

type FormValues = {
  code: string;
  name: string;
  type: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  countryCode: string;
  zip: string;
  phone: string;
};

// Mismo formulario para crear y editar: al editar, un campo opcional vacío se borra (updateLocationSchema).
const schemaFor = (editing: boolean) =>
  (editing ? updateLocationSchema : createLocationSchema) as unknown as z.ZodType<UpdateLocationData, FormValues>;

type Props = {
  tenant: string;
  /** Bodega a editar; sin ella el diálogo crea una nueva. */
  location?: LocationResponse;
  onClose: () => void;
  onSaved: (location: LocationResponse) => void;
};

export default function LocationFormDialog({ tenant, location, onClose, onSaved }: Props) {
  const editing = !!location;
  const { values, setField, fieldErrors, formError, submitting, handleSubmit } = useZodForm(
    schemaFor(editing),
    {
      code: location?.code ?? '',
      name: location?.name ?? '',
      type: location?.type ?? 'warehouse',
      address1: location?.address1 ?? '',
      address2: location?.address2 ?? '',
      city: location?.city ?? '',
      province: location?.province ?? '',
      countryCode: location?.countryCode ?? '',
      zip: location?.zip ?? '',
      phone: location?.phone ?? '',
    },
    async (input) => {
      const saved = editing
        ? await updateLocation(tenant, location.id, input)
        : await createLocation(tenant, input as CreateLocationData);
      onSaved(saved);
    },
  );

  const text = (name: keyof FormValues, label: string, helper?: string) => ({
    label,
    value: values[name],
    onChange: setField(name),
    error: !!fieldErrors[name],
    helperText: fieldErrors[name] ?? helper,
    fullWidth: true,
  });

  return (
    <Dialog open onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{editing ? 'Editar bodega' : 'Agregar bodega'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            {formError && (
              <Grid size={12}>
                <Alert severity="error">{formError}</Alert>
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                {...text('code', 'Código', 'Ej. BOD-LIMA-01')}
                autoFocus
                slotProps={{ htmlInput: { style: { textTransform: 'uppercase' } } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 7 }}>
              <TextField {...text('name', 'Nombre')} />
            </Grid>
            <Grid size={12}>
              <TextField select {...text('type', 'Tipo')}>
                {LOCATION_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {LOCATION_TYPE_LABELS[type]}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                Dirección (opcional)
              </Typography>
            </Grid>
            <Grid size={12}>
              <TextField {...text('address1', 'Dirección')} />
            </Grid>
            <Grid size={12}>
              <TextField {...text('address2', 'Referencia / interior')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField {...text('city', 'Ciudad')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField {...text('province', 'Región / provincia')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select {...text('countryCode', 'País')}>
                <MenuItem value="">
                  <em>Sin especificar</em>
                </MenuItem>
                {COUNTRIES.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField {...text('zip', 'Código postal')} />
            </Grid>
            <Grid size={12}>
              <TextField {...text('phone', 'Teléfono')} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={submitting} color="inherit">
            Cancelar
          </Button>
          <Button type="submit" variant="contained" loading={submitting}>
            {editing ? 'Guardar cambios' : 'Agregar bodega'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
