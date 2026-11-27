'use client';

import { WEIGHT_UNITS } from '@erp/contracts';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Link from '@/components/ui/Link';
import { WEIGHT_UNIT_LABELS } from '../product-labels';
import { profitAndMargin, type VariantFields } from './variant-ops';

// Campos de una variante, en los mismos bloques que Shopify: Precio, Inventario y Envío.
// Se usan en el producto sin opciones (como secciones) y en el diálogo de cada variante.

type Props = {
  fields: VariantFields;
  onChange: (patch: Partial<VariantFields>) => void;
  /** Errores de esta variante: { price: '...' }. */
  errors: Record<string, string>;
  currency: string;
  disabled?: boolean;
};

const money = (currency: string) => ({
  slotProps: { input: { startAdornment: <InputAdornment position="start">{currency}</InputAdornment> }, htmlInput: { inputMode: 'decimal' as const } },
});

export function PricingFields({ fields, onChange, errors, currency, disabled }: Props) {
  const result = profitAndMargin(fields.price, fields.cost);
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          label="Precio"
          value={fields.price}
          onChange={(e) => onChange({ price: e.target.value })}
          error={!!errors.price}
          helperText={errors.price}
          disabled={disabled}
          fullWidth
          {...money(currency)}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          label="Precio comparativo"
          value={fields.compareAtPrice}
          onChange={(e) => onChange({ compareAtPrice: e.target.value })}
          error={!!errors.compareAtPrice}
          helperText={errors.compareAtPrice ?? 'Precio "antes" que se muestra tachado'}
          disabled={disabled}
          fullWidth
          {...money(currency)}
        />
      </Grid>
      <Grid size={12}>
        <FormControlLabel
          disabled={disabled}
          control={<Checkbox checked={fields.taxable} onChange={(e) => onChange({ taxable: e.target.checked })} />}
          label="Cobrar impuestos sobre este producto"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <TextField
          label="Costo por artículo"
          value={fields.cost}
          onChange={(e) => onChange({ cost: e.target.value })}
          error={!!errors.cost}
          helperText={errors.cost ?? 'Los clientes no lo ven'}
          disabled={disabled}
          fullWidth
          {...money(currency)}
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 4 }}>
        <Metric label="Ganancia" value={result ? `${currency} ${result.profit}` : '—'} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4 }}>
        <Metric label="Margen" value={result?.margin ?? '—'} />
      </Grid>
    </Grid>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ pt: 0.5 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body1">{value}</Typography>
    </Box>
  );
}

type InventoryProps = Props & {
  /** Disponible total en bodegas (variante ya guardada). */
  available?: number;
  /** Página de Inventario para ajustar las cantidades. */
  inventoryHref?: string;
};

export function InventoryFields({ fields, onChange, errors, disabled, available, inventoryHref }: InventoryProps) {
  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <FormControlLabel
          disabled={disabled}
          control={<Checkbox checked={fields.tracked} onChange={(e) => onChange({ tracked: e.target.checked })} />}
          label="Controlar cantidad"
        />
        {fields.tracked && (
          <Alert
            severity="info"
            variant="outlined"
            sx={{ mt: 1 }}
            action={
              inventoryHref && available !== undefined ? (
                <Button component={Link} href={inventoryHref} size="small" color="inherit">
                  Ajustar
                </Button>
              ) : undefined
            }
          >
            {available !== undefined ? (
              <>
                <strong>{available}</strong> disponible{available === 1 ? '' : 's'} sumando todas las bodegas. Las cantidades se
                ajustan en Inventario.
              </>
            ) : (
              <>Al guardar, registra las cantidades por bodega en <strong>Inventario</strong>.</>
            )}
          </Alert>
        )}
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          label="SKU (código de artículo)"
          value={fields.sku}
          onChange={(e) => onChange({ sku: e.target.value })}
          error={!!errors.sku}
          helperText={errors.sku}
          disabled={disabled}
          fullWidth
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          label="Código de barras (ISBN, UPC, GTIN…)"
          value={fields.barcode}
          onChange={(e) => onChange({ barcode: e.target.value })}
          error={!!errors.barcode}
          helperText={errors.barcode}
          disabled={disabled}
          fullWidth
        />
      </Grid>
      {fields.tracked && (
        <Grid size={12}>
          <FormControlLabel
            disabled={disabled}
            control={
              <Checkbox
                checked={fields.inventoryPolicy === 'CONTINUE'}
                onChange={(e) => onChange({ inventoryPolicy: e.target.checked ? 'CONTINUE' : 'DENY' })}
              />
            }
            label="Seguir vendiendo cuando no haya stock"
          />
        </Grid>
      )}
    </Grid>
  );
}

export function ShippingFields({ fields, onChange, errors, disabled }: Props) {
  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <FormControlLabel
          disabled={disabled}
          control={<Checkbox checked={fields.requiresShipping} onChange={(e) => onChange({ requiresShipping: e.target.checked })} />}
          label="Es un producto físico"
        />
      </Grid>
      {fields.requiresShipping ? (
        <Grid size={{ xs: 12, sm: 8 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Peso"
              value={fields.weight}
              onChange={(e) => onChange({ weight: e.target.value })}
              error={!!errors.weight}
              helperText={errors.weight ?? 'Para calcular el envío'}
              disabled={disabled}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              fullWidth
            />
            <TextField
              select
              label="Unidad"
              value={fields.weightUnit}
              onChange={(e) => onChange({ weightUnit: e.target.value as VariantFields['weightUnit'] })}
              disabled={disabled}
              sx={{ width: 110, flexShrink: 0 }}
            >
              {WEIGHT_UNITS.map((u) => (
                <MenuItem key={u} value={u}>
                  {WEIGHT_UNIT_LABELS[u]}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Grid>
      ) : (
        <Grid size={12}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Producto digital o servicio: no se envía.
          </Typography>
        </Grid>
      )}
    </Grid>
  );
}
