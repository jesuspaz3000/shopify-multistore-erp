'use client';

import { PRODUCT_STATUSES, productInputSchema, type ProductResponse, type ProductStatus } from '@erp/contracts';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Link from '@/components/ui/Link';
import { ApiError } from '@/lib/http';
import { createProduct, deleteProduct, updateProduct } from '../api/products.api';
import { PRODUCT_STATUS_LABELS } from '../product-labels';
import { InventoryFields, PricingFields, ShippingFields } from '../variants/VariantFields';
import type { VariantFields } from '../variants/variant-ops';
import VariantsSection from '../variants/VariantsSection';
import { errorsOf, initialState, mapErrors, type ProductFormState, toInput } from './product-form-state';
import SeoSection from './SeoSection';

type Props = {
  /** Base de las rutas de producto: /{tenant}/{shop}/products */
  basePath: string;
  tenant: string;
  /** Producto a editar; sin él se crea uno nuevo. */
  product?: ProductResponse;
  currency: string;
  canWrite: boolean;
};

const CHECK_FIELDS = 'Revisa los campos marcados';
const STALE_PREFIX = 'Otra persona';

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      {title && (
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, mb: 2 }}>
          {title}
        </Typography>
      )}
      {children}
    </Paper>
  );
}

/** Página de producto al estilo de Shopify: contenido a la izquierda, estado y organización a la derecha. */
export default function ProductForm({ basePath, tenant, product, currency, canWrite }: Props) {
  const router = useRouter();
  const [state, setState] = useState<ProductFormState>(() => initialState(product));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [heading, setHeading] = useState(product?.title ?? 'Nuevo producto');
  const [savedHandle, setSavedHandle] = useState(product?.handle);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const initialRef = useRef(product);
  const disabled = !canWrite;

  // Next 16 conserva las páginas ocultas (<Activity>): al salir se descarta lo escrito,
  // para que "Nuevo producto" no muestre el borrador del producto anterior.
  useLayoutEffect(() => {
    const initial = initialRef.current;
    return () => {
      setState(initialState(initial));
      setErrors({});
      setFormError(null);
      setSaving(false);
    };
  }, []);

  const set = (patch: Partial<ProductFormState>, clear: string[] = []) => {
    setState((prev) => ({ ...prev, ...patch }));
    if (clear.length) setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !clear.includes(k))));
    setFormError((prev) => (prev === CHECK_FIELDS ? null : prev));
  };

  const single = state.options.length === 0 ? state.variants[0] : undefined;
  const changeSingle = (patch: Partial<VariantFields>) => {
    if (!single) return;
    set(
      { variants: [{ ...single, fields: { ...single.fields, ...patch } }] },
      Object.keys(patch).map((k) => `${single.uid}.${k}`),
    );
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const input = toInput(state);
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join('.')] ??= issue.message;
      setErrors(mapErrors(next, state));
      setFormError(CHECK_FIELDS);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (product) {
        const saved = await updateProduct(tenant, product.id, input);
        setState(initialState(saved)); // las variantes nuevas ya tienen id
        setHeading(saved.title);
        setSavedHandle(saved.handle);
        initialRef.current = saved;
        setToast('Producto guardado');
        router.refresh();
      } else {
        const saved = await createProduct(tenant, input);
        router.push(`${basePath}/${saved.id}`);
        return; // el formulario se descarta al salir
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(mapErrors(error.fieldErrors, state));
        setFormError(error.message);
      } else {
        setFormError('Ocurrió un error inesperado');
      }
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!product) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteProduct(tenant, product.id);
      router.push(basePath);
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : 'No se pudo eliminar el producto');
      setDeleting(false);
    }
  };

  const status = product ? PRODUCT_STATUS_LABELS[product.status] : null;
  const inventoryPath = basePath.replace(/\/products$/, '/inventory');
  const singleProps = single && {
    fields: single.fields,
    onChange: changeSingle,
    errors: errorsOf(errors, single.uid),
    currency,
    disabled,
  };

  return (
    <Box component="form" onSubmit={save} noValidate sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 3 }}>
        <IconButton component={Link} href={basePath} aria-label="Volver a productos">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
          {heading}
        </Typography>
        {status && <Chip size="small" variant="outlined" label={status.label} color={status.color} />}
        {canWrite && (
          <Stack direction="row" spacing={1}>
            {product && (
              <Button color="error" onClick={() => setConfirmDelete(true)} disabled={saving}>
                Eliminar
              </Button>
            )}
            <Button type="submit" variant="contained" loading={saving}>
              Guardar
            </Button>
          </Stack>
        )}
      </Stack>

      {!canWrite && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Tu rol solo permite ver el catálogo.
        </Alert>
      )}
      {formError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            formError.startsWith(STALE_PREFIX) ? (
              <Button color="inherit" size="small" onClick={() => window.location.reload()}>
                Recargar
              </Button>
            ) : undefined
          }
        >
          {formError}
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={2.5}>
            <Section>
              <Stack spacing={2}>
                <TextField
                  label="Título"
                  placeholder="Polera de manga corta"
                  value={state.title}
                  onChange={(e) => set({ title: e.target.value }, ['title'])}
                  error={!!errors.title}
                  helperText={errors.title}
                  disabled={disabled}
                  autoFocus={!product}
                  fullWidth
                />
                <TextField
                  label="Descripción"
                  value={state.description}
                  onChange={(e) => set({ description: e.target.value }, ['description'])}
                  error={!!errors.description}
                  helperText={errors.description}
                  disabled={disabled}
                  multiline
                  minRows={5}
                  fullWidth
                />
              </Stack>
            </Section>

            {/* Sin variantes, precio/inventario/envío son del producto; con variantes, de cada variante. */}
            {singleProps && (
              <>
                <Section title="Precio">
                  <PricingFields {...singleProps} />
                </Section>
                <Section title="Inventario">
                  <InventoryFields
                    {...singleProps}
                    available={single?.available}
                    inventoryHref={single?.fields.sku ? `${inventoryPath}?q=${encodeURIComponent(single.fields.sku)}` : inventoryPath}
                  />
                </Section>
                <Section title="Envío">
                  <ShippingFields {...singleProps} />
                </Section>
              </>
            )}

            <Section title="Variantes">
              {errors.variants && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errors.variants}
                </Alert>
              )}
              {errors.options && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errors.options}
                </Alert>
              )}
              <VariantsSection
                options={state.options}
                variants={state.variants}
                onChange={(options, variants) => set({ options, variants }, ['options', 'variants'])}
                errors={errors}
                currency={currency}
                disabled={disabled}
              />
            </Section>

            <Section>
              <SeoSection
                title={state.title}
                description={state.description}
                seoTitle={state.seoTitle}
                seoDescription={state.seoDescription}
                handle={state.handle === savedHandle ? '' : state.handle}
                savedHandle={savedHandle}
                errors={errors}
                disabled={disabled}
                onChange={(patch) => set(patch, Object.keys(patch))}
              />
            </Section>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2.5}>
            <Section title="Estado">
              <TextField
                select
                value={state.status}
                onChange={(e) => set({ status: e.target.value as ProductStatus })}
                disabled={disabled}
                helperText="Borrador: aún no se vende. Archivado: ya no se vende."
                fullWidth
                slotProps={{ htmlInput: { 'aria-label': 'Estado' } }}
              >
                {PRODUCT_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {PRODUCT_STATUS_LABELS[s].label}
                  </MenuItem>
                ))}
              </TextField>
            </Section>
            <Section title="Organización del producto">
              <Stack spacing={2}>
                <TextField
                  label="Tipo"
                  value={state.productType}
                  onChange={(e) => set({ productType: e.target.value }, ['productType'])}
                  error={!!errors.productType}
                  helperText={errors.productType ?? 'Ej. Poleras, Tazas'}
                  disabled={disabled}
                  fullWidth
                />
                <TextField
                  label="Proveedor / marca"
                  value={state.vendor}
                  onChange={(e) => set({ vendor: e.target.value }, ['vendor'])}
                  error={!!errors.vendor}
                  helperText={errors.vendor}
                  disabled={disabled}
                  fullWidth
                />
                <Autocomplete
                  multiple
                  freeSolo
                  autoSelect
                  disabled={disabled}
                  options={[]}
                  value={state.tags}
                  onChange={(_, tags) => set({ tags: tags.map((t) => t.trim()).filter(Boolean) }, ['tags'])}
                  renderValue={(values, getItemProps) =>
                    values.map((value, i) => {
                      const { key, ...itemProps } = getItemProps({ index: i });
                      return <Chip key={key} size="small" label={value} {...itemProps} />;
                    })
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Etiquetas" helperText={errors.tags ?? 'Escribe y presiona Enter'} error={!!errors.tags} />
                  )}
                />
              </Stack>
            </Section>
          </Stack>
        </Grid>
      </Grid>

      <ConfirmDialog
        item={confirmDelete ? (product ?? null) : null}
        title={() => '¿Eliminar el producto?'}
        description={(p) => (
          <>
            <strong>{p.title}</strong> y sus {p.variants.length} variante{p.variants.length === 1 ? '' : 's'} desaparecerán del
            catálogo. Sus SKU quedarán libres.
          </>
        )}
        busy={deleting}
        error={deleteError}
        onConfirm={remove}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteError(null);
        }}
      />
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} message={toast} />
    </Box>
  );
}
