'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { InventoryFields, PricingFields, ShippingFields } from './VariantFields';
import type { OptionDraft, VariantFields } from './variant-ops';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">{title}</Typography>
      {children}
    </Stack>
  );
}

type VariantDialogProps = {
  label: string;
  fields: VariantFields;
  errors: Record<string, string>;
  currency: string;
  disabled?: boolean;
  canDelete: boolean;
  onSave: (fields: VariantFields) => void;
  onDelete: () => void;
  onClose: () => void;
};

/** Detalle de una variante: precio, inventario y envío (se aplica al pulsar "Listo"). */
export function VariantDialog({ label, fields, errors, currency, disabled, canDelete, onSave, onDelete, onClose }: VariantDialogProps) {
  const [draft, setDraft] = useState(fields);
  const change = (patch: Partial<VariantFields>) => setDraft((prev) => ({ ...prev, ...patch }));
  const props = { fields: draft, onChange: change, errors, currency, disabled };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Variante {label}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }} divider={<Divider />}>
          <Block title="Precio">
            <PricingFields {...props} />
          </Block>
          <Block title="Inventario">
            <InventoryFields {...props} />
          </Block>
          <Block title="Envío">
            <ShippingFields {...props} />
          </Block>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        {!disabled && canDelete ? (
          <Button color="error" onClick={onDelete}>
            Eliminar variante
          </Button>
        ) : (
          <span />
        )}
        <Stack direction="row" spacing={1}>
          <Button color="inherit" onClick={onClose}>
            {disabled ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!disabled && (
            <Button variant="contained" onClick={() => onSave(draft)}>
              Listo
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

type BulkProps = {
  count: number;
  currency: string;
  onApply: (patch: Partial<VariantFields>) => void;
  onClose: () => void;
};

/** Editar en bloque las variantes seleccionadas: solo cambia lo que se completa. */
export function BulkEditDialog({ count, currency, onApply, onClose }: BulkProps) {
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [cost, setCost] = useState('');
  const [weight, setWeight] = useState('');
  const money = { slotProps: { input: { startAdornment: <InputAdornment position="start">{currency}</InputAdornment> } } };

  const apply = () => {
    const patch: Partial<VariantFields> = {};
    if (price.trim()) patch.price = price.trim();
    if (compareAtPrice.trim()) patch.compareAtPrice = compareAtPrice.trim();
    if (cost.trim()) patch.cost = cost.trim();
    if (weight.trim()) patch.weight = weight.trim();
    onApply(patch);
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        Editar {count} variante{count === 1 ? '' : 's'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info" variant="outlined">
            Deja vacío lo que no quieras cambiar.
          </Alert>
          <TextField label="Precio" value={price} onChange={(e) => setPrice(e.target.value)} autoFocus {...money} />
          <TextField label="Precio comparativo" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} {...money} />
          <TextField label="Costo por artículo" value={cost} onChange={(e) => setCost(e.target.value)} {...money} />
          <TextField label="Peso" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={apply} disabled={![price, compareAtPrice, cost, weight].some((v) => v.trim())}>
          Aplicar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type AddProps = {
  options: OptionDraft[];
  /** Devuelve false si la combinación ya existe. */
  onAdd: (values: Record<string, string>) => boolean;
  onClose: () => void;
};

/** Agregar una variante a mano eligiendo un valor por opción (ej. recuperar una borrada). */
export function AddVariantDialog({ options, onAdd, onClose }: AddProps) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(options.map((o) => [o.uid, o.values[0].uid])));
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Agregar variante</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ pt: 1 }}>
          {error && (
            <Grid size={12}>
              <Alert severity="error">{error}</Alert>
            </Grid>
          )}
          {options.map((o) => (
            <Grid key={o.uid} size={12}>
              <TextField
                select
                label={o.name}
                value={values[o.uid]}
                onChange={(e) => {
                  setValues({ ...values, [o.uid]: e.target.value });
                  setError(null);
                }}
                fullWidth
              >
                {o.values.map((v) => (
                  <MenuItem key={v.uid} value={v.uid}>
                    {v.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => !onAdd(values) && setError('Esa variante ya existe')}>
          Agregar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
