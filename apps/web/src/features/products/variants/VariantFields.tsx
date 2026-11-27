'use client';

import { type LocationOptionResponse, WEIGHT_UNITS } from '@erp/contracts';
import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';
import Link from '@/components/ui/Link';
import { allCountries } from '@/lib/countries';
import { WEIGHT_UNIT_LABELS } from '../product-labels';
import { profitAndMargin, type VariantFields } from './variant-ops';

// Bloques de una variante como en Shopify: Precio, Inventario y Envío. Cada uno muestra lo principal
// y deja los campos secundarios como chips ("+ Precio de comparación") que se despliegan al hacer clic.
// Se usan como secciones del producto sin opciones y dentro del diálogo de cada variante.

type Props = {
  fields: VariantFields;
  onChange: (patch: Partial<VariantFields>) => void;
  /** Errores de esta variante: { price: '...' }. */
  errors: Record<string, string>;
  currency: string;
  disabled?: boolean;
};

const money = (currency: string) => ({
  slotProps: {
    input: { startAdornment: <InputAdornment position="start">{currency}</InputAdornment> },
    htmlInput: { inputMode: 'decimal' as const },
  },
});

/** Campos secundarios: visibles si se abrieron, tienen valor o tienen error. */
function useReveal(initial: Record<string, boolean>) {
  const [open, setOpen] = useState(() => new Set(Object.keys(initial).filter((k) => initial[k])));
  return {
    shown: (key: string, force = false) => force || open.has(key),
    reveal: (key: string) => setOpen((prev) => new Set(prev).add(key)),
  };
}

/** Fila de chips para desplegar campos secundarios. */
function MoreChips({ items, disabled }: { items: { key: string; label: string; value?: string; onClick: () => void }[]; disabled?: boolean }) {
  if (items.length === 0) return null;
  return (
    <>
      <Divider sx={{ mx: -2.5 }} />
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, pt: 1.5 }}>
        {items.map((item) => (
          <Chip
            key={item.key}
            size="small"
            variant="outlined"
            disabled={disabled}
            icon={item.value ? undefined : <AddIcon />}
            onClick={item.onClick}
            label={
              item.value ? (
                <>
                  {item.label} <strong>· {item.value}</strong>
                </>
              ) : (
                item.label
              )
            }
          />
        ))}
      </Stack>
    </>
  );
}

function Header({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2, minHeight: 32 }}>
      <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {action}
    </Stack>
  );
}

// ---------------------------------------------------------------- Precio

export function PricingFields({ fields, onChange, errors, currency, disabled }: Props) {
  const { shown, reveal } = useReveal({ compareAtPrice: !!fields.compareAtPrice, cost: !!fields.cost, taxable: !fields.taxable });
  const result = profitAndMargin(fields.price, fields.cost);
  const showCompare = shown('compareAtPrice', !!errors.compareAtPrice || !!fields.compareAtPrice);
  const showCost = shown('cost', !!errors.cost || !!fields.cost);
  const showTax = shown('taxable');

  return (
    <Box>
      <Header title="Precio" />
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Precio"
            value={fields.price}
            onChange={(e) => onChange({ price: e.target.value })}
            error={!!errors.price}
            helperText={errors.price}
            disabled={disabled}
            placeholder="0.00"
            fullWidth
            {...money(currency)}
          />
        </Grid>
        {showCompare && (
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Precio de comparación"
              value={fields.compareAtPrice}
              onChange={(e) => onChange({ compareAtPrice: e.target.value })}
              error={!!errors.compareAtPrice}
              helperText={errors.compareAtPrice ?? 'Precio "antes", se muestra tachado'}
              disabled={disabled}
              autoFocus={!fields.compareAtPrice}
              fullWidth
              {...money(currency)}
            />
          </Grid>
        )}
        {showCost && (
          <>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Costo por artículo"
                value={fields.cost}
                onChange={(e) => onChange({ cost: e.target.value })}
                error={!!errors.cost}
                helperText={errors.cost ?? 'Los clientes no lo ven'}
                disabled={disabled}
                autoFocus={!fields.cost}
                fullWidth
                {...money(currency)}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Metric label="Ganancia" value={result ? `${currency} ${result.profit}` : '—'} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Metric label="Margen" value={result?.margin ?? '—'} />
            </Grid>
          </>
        )}
        {showTax && (
          <Grid size={12}>
            <FormControlLabel
              disabled={disabled}
              control={<Checkbox checked={fields.taxable} onChange={(e) => onChange({ taxable: e.target.checked })} />}
              label="Cobrar impuestos sobre este producto"
            />
          </Grid>
        )}
      </Grid>
      <MoreChips
        disabled={disabled}
        items={[
          ...(!showCompare ? [{ key: 'compare', label: 'Precio de comparación', onClick: () => reveal('compareAtPrice') }] : []),
          ...(!showTax ? [{ key: 'tax', label: 'Cobrar impuesto', value: fields.taxable ? 'Sí' : 'No', onClick: () => reveal('taxable') }] : []),
          ...(!showCost ? [{ key: 'cost', label: 'Costo por artículo', onClick: () => reveal('cost') }] : []),
        ]}
      />
    </Box>
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

// ---------------------------------------------------------------- Inventario

type InventoryProps = Props & {
  /** Bodegas activas: cantidad inicial (variante nueva) o disponible actual (guardada). */
  locations: LocationOptionResponse[];
  /** Disponible por bodega de una variante ya guardada (undefined = variante nueva). */
  levels?: { locationId: number; available: number }[];
  /** Página de Inventario para ajustar las cantidades de una variante guardada. */
  inventoryHref?: string;
  /** Configuración → Bodegas (si aún no hay ninguna). */
  locationsHref?: string;
};

export function InventoryFields(props: InventoryProps) {
  const { fields, onChange, errors, disabled, locations, levels, inventoryHref, locationsHref } = props;
  const { shown, reveal } = useReveal({ sku: !!fields.sku, barcode: !!fields.barcode, policy: fields.inventoryPolicy === 'CONTINUE' });
  const isNew = levels === undefined;
  const showSku = shown('sku', !!errors.sku || !!fields.sku);
  const showBarcode = shown('barcode', !!errors.barcode || !!fields.barcode);
  const showPolicy = fields.tracked && shown('policy', fields.inventoryPolicy === 'CONTINUE');
  const quantityError = Object.entries(errors).find(([k]) => k.startsWith('quantities'))?.[1];

  return (
    <Box>
      <Header
        title="Inventario"
        action={
          <FormControlLabel
            disabled={disabled}
            labelPlacement="start"
            control={<Switch size="small" checked={fields.tracked} onChange={(e) => onChange({ tracked: e.target.checked })} />}
            label={<Typography variant="body2">Inventario con seguimiento</Typography>}
          />
        }
      />

      {fields.tracked && (
        <Box sx={{ mb: 2, border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', px: 2, py: 1, bgcolor: 'action.hover' }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Bodega
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {isNew ? 'Cantidad' : 'Disponible'}
            </Typography>
          </Stack>
          {locations.length === 0 ? (
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Aún no hay bodegas.{' '}
                {locationsHref && (
                  <Link href={locationsHref} style={{ color: 'inherit' }}>
                    Crea una
                  </Link>
                )}{' '}
                para registrar cantidades.
              </Typography>
            </Box>
          ) : (
            locations.map((location, index) => {
              const current = levels?.find((l) => l.locationId === location.id)?.available ?? 0;
              return (
                <Box key={location.id}>
                  {index > 0 && <Divider />}
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
                    <Typography variant="body2">{location.name}</Typography>
                    {isNew ? (
                      <TextField
                        size="small"
                        value={fields.quantities[location.id] ?? ''}
                        placeholder="0"
                        disabled={disabled}
                        onChange={(e) => onChange({ quantities: { ...fields.quantities, [location.id]: e.target.value } })}
                        sx={{ width: 110 }}
                        slotProps={{ htmlInput: { inputMode: 'numeric', style: { textAlign: 'right' }, 'aria-label': `Cantidad en ${location.name}` } }}
                      />
                    ) : (
                      <Typography variant="body2" sx={{ fontWeight: 600, color: current <= 0 ? 'error.main' : undefined }}>
                        {current}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              );
            })
          )}
          {!isNew && inventoryHref && locations.length > 0 && (
            <>
              <Divider />
              <Stack direction="row" sx={{ justifyContent: 'flex-end', px: 1, py: 0.5 }}>
                <Button component={Link} href={inventoryHref} size="small">
                  Ajustar cantidades
                </Button>
              </Stack>
            </>
          )}
        </Box>
      )}
      {quantityError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Cantidad: {quantityError}
        </Alert>
      )}

      {(showSku || showBarcode || showPolicy) && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {showSku && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="SKU (código de artículo)"
                value={fields.sku}
                onChange={(e) => onChange({ sku: e.target.value })}
                error={!!errors.sku}
                helperText={errors.sku}
                disabled={disabled}
                autoFocus={!fields.sku}
                fullWidth
              />
            </Grid>
          )}
          {showBarcode && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Código de barras (ISBN, UPC, GTIN…)"
                value={fields.barcode}
                onChange={(e) => onChange({ barcode: e.target.value })}
                error={!!errors.barcode}
                helperText={errors.barcode}
                disabled={disabled}
                autoFocus={!fields.barcode}
                fullWidth
              />
            </Grid>
          )}
          {showPolicy && (
            <Grid size={12}>
              <FormControlLabel
                disabled={disabled}
                control={
                  <Checkbox
                    checked={fields.inventoryPolicy === 'CONTINUE'}
                    onChange={(e) => onChange({ inventoryPolicy: e.target.checked ? 'CONTINUE' : 'DENY' })}
                  />
                }
                label="Vender cuando no haya existencias"
              />
            </Grid>
          )}
        </Grid>
      )}
      <MoreChips
        disabled={disabled}
        items={[
          ...(!showSku ? [{ key: 'sku', label: 'SKU', onClick: () => reveal('sku') }] : []),
          ...(!showBarcode ? [{ key: 'barcode', label: 'Código de barras', onClick: () => reveal('barcode') }] : []),
          ...(fields.tracked && !showPolicy
            ? [{ key: 'policy', label: 'Vender sin existencias', value: 'Desactivado', onClick: () => reveal('policy') }]
            : []),
        ]}
      />
    </Box>
  );
}

// ---------------------------------------------------------------- Envío

export function ShippingFields({ fields, onChange, errors, disabled }: Props) {
  const countries = useMemo(() => allCountries(), []);
  const { shown, reveal } = useReveal({ origin: !!fields.countryCodeOfOrigin, hs: !!fields.harmonizedSystemCode });
  const showOrigin = shown('origin', !!errors.countryCodeOfOrigin || !!fields.countryCodeOfOrigin);
  const showHs = shown('hs', !!errors.harmonizedSystemCode || !!fields.harmonizedSystemCode);

  return (
    <Box>
      <Header
        title="Envío"
        action={
          <FormControlLabel
            disabled={disabled}
            labelPlacement="start"
            control={<Switch size="small" checked={fields.requiresShipping} onChange={(e) => onChange({ requiresShipping: e.target.checked })} />}
            label={<Typography variant="body2">Producto físico</Typography>}
          />
        }
      />
      {fields.requiresShipping ? (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 8 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                label="Peso"
                value={fields.weight}
                onChange={(e) => onChange({ weight: e.target.value })}
                error={!!errors.weight}
                helperText={errors.weight ?? 'Para calcular el envío'}
                disabled={disabled}
                placeholder="0.0"
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
          {showOrigin && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Autocomplete
                options={countries}
                disabled={disabled}
                value={countries.find((c) => c.code === fields.countryCodeOfOrigin) ?? null}
                onChange={(_, country) => onChange({ countryCodeOfOrigin: country?.code ?? '' })}
                getOptionLabel={(c) => c.label}
                isOptionEqualToValue={(a, b) => a.code === b.code}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="País de origen"
                    error={!!errors.countryCodeOfOrigin}
                    helperText={errors.countryCodeOfOrigin ?? 'Donde se fabricó (aduanas)'}
                  />
                )}
              />
            </Grid>
          )}
          {showHs && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Código SA (Sistema Armonizado)"
                value={fields.harmonizedSystemCode}
                onChange={(e) => onChange({ harmonizedSystemCode: e.target.value })}
                error={!!errors.harmonizedSystemCode}
                helperText={errors.harmonizedSystemCode ?? 'Clasificación arancelaria (ej. 610910)'}
                disabled={disabled}
                autoFocus={!fields.harmonizedSystemCode}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                fullWidth
              />
            </Grid>
          )}
        </Grid>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Producto digital o servicio: no se envía.
        </Typography>
      )}
      {fields.requiresShipping && (
        <MoreChips
          disabled={disabled}
          items={[
            ...(!showOrigin ? [{ key: 'origin', label: 'País de origen', onClick: () => reveal('origin') }] : []),
            ...(!showHs ? [{ key: 'hs', label: 'Código SA', onClick: () => reveal('hs') }] : []),
          ]}
        />
      )}
    </Box>
  );
}
