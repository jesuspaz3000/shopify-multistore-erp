'use client';

import { MAX_PRODUCT_OPTIONS } from '@erp/contracts';
import AddIcon from '@mui/icons-material/Add';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Fragment, useState } from 'react';
import { errorsOf } from '../components/product-form-state';
import { OptionEditor, OptionSummary } from './OptionCard';
import { useDragReorder } from './useDragReorder';
import { AddVariantDialog, BulkEditDialog, VariantDialog } from './VariantDialogs';
import {
  addVariant,
  applyOptionChange,
  combinations,
  groupVariants,
  newUid,
  type OptionDraft,
  priceSummary,
  sortVariants,
  type VariantDraft,
  type VariantFields,
  variantLabel,
} from './variant-ops';

type Props = {
  options: OptionDraft[];
  variants: VariantDraft[];
  onChange: (options: OptionDraft[], variants: VariantDraft[]) => void;
  /** Errores por uid de variante ("v12.price"). */
  errors: Record<string, string>;
  currency: string;
  disabled?: boolean;
};

/** Sección "Variantes" al estilo de Shopify: opciones arriba, variantes (agrupadas) abajo. */
export default function VariantsSection({ options, variants, onChange, errors, currency, disabled }: Props) {
  const [editing, setEditing] = useState<{ option: OptionDraft; isNew: boolean } | null>(null);
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openVariant, setOpenVariant] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const [adding, setAdding] = useState(false);

  const reorderOptions = (next: OptionDraft[]) => onChange(next, sortVariants(variants, next));
  const { itemProps } = useDragReorder(options, reorderOptions);

  const commitOptions = (next: OptionDraft[]) => {
    onChange(next, applyOptionChange(options, next, variants));
    setSelected(new Set());
    setEditing(null);
  };

  const updateVariants = (uids: Set<string> | string[], patch: Partial<VariantFields>) => {
    const set = uids instanceof Set ? uids : new Set(uids);
    onChange(options, variants.map((v) => (set.has(v.uid) ? { ...v, fields: { ...v.fields, ...patch } } : v)));
  };
  const removeVariants = (uids: Set<string>) => {
    onChange(options, variants.filter((v) => !uids.has(v.uid)));
    setSelected(new Set());
  };

  const toggle = (uids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const uid of uids) {
        if (on) next.add(uid);
        else next.delete(uid);
      }
      return next;
    });

  const groupOption = options.length >= 2 ? (options.find((o) => o.uid === groupBy) ?? options[0]) : null;
  const totalCombos = combinations(options).length;
  const dialogVariant = variants.find((v) => v.uid === openVariant);
  const hasErrors = (uid: string) => Object.keys(errorsOf(errors, uid)).length > 0;

  // ---------- Filas ----------
  const priceInput = (value: string, onValue: (v: string) => void, label: string, opts: { placeholder?: string; error?: boolean } = {}) => (
    <TextField
      size="small"
      value={value}
      placeholder={opts.placeholder}
      onChange={(e) => onValue(e.target.value)}
      error={opts.error}
      disabled={disabled}
      sx={{ width: 140 }}
      slotProps={{
        input: { startAdornment: <InputAdornment position="start">{currency}</InputAdornment> },
        htmlInput: { 'aria-label': label, inputMode: 'decimal' },
      }}
    />
  );

  const variantRow = (variant: VariantDraft, indent: boolean) => {
    const label = variantLabel(variant, options, indent ? groupOption?.uid : undefined);
    const fullLabel = variantLabel(variant, options);
    const invalid = hasErrors(variant.uid);
    return (
      <TableRow key={variant.uid} hover>
        <TableCell padding="checkbox" sx={{ pl: indent ? 4 : undefined }}>
          <Checkbox
            size="small"
            disabled={disabled}
            checked={selected.has(variant.uid)}
            onChange={(e) => toggle([variant.uid], e.target.checked)}
            slotProps={{ input: { 'aria-label': `Seleccionar ${fullLabel}` } }}
          />
        </TableCell>
        <TableCell>
          <Link
            component="button"
            type="button"
            underline="hover"
            color={invalid ? 'error' : 'inherit'}
            onClick={() => setOpenVariant(variant.uid)}
            sx={{ fontWeight: 500, textAlign: 'left' }}
            aria-label={`Editar variante ${fullLabel}`}
          >
            {label}
          </Link>
          {invalid && (
            <Typography variant="caption" sx={{ color: 'error.main', display: 'block' }}>
              Revisa esta variante
            </Typography>
          )}
        </TableCell>
        <TableCell>
          {priceInput(variant.fields.price, (price) => updateVariants([variant.uid], { price }), `Precio de ${fullLabel}`, {
            error: !!errors[`${variant.uid}.price`],
          })}
        </TableCell>
        <TableCell sx={{ color: variant.fields.sku ? 'text.primary' : 'text.disabled' }}>{variant.fields.sku || 'Sin SKU'}</TableCell>
      </TableRow>
    );
  };

  return (
    <Stack spacing={2}>
      {/* ---------- Opciones ---------- */}
      {options.length > 0 && (
        <Box>
          {options.map((option, index) => (
            <Fragment key={option.uid}>
              {index > 0 && <Divider />}
              {editing && !editing.isNew && editing.option.uid === option.uid ? (
                <Box sx={{ py: 1 }}>
                  <OptionEditor
                    option={option}
                    otherNames={options.filter((o) => o.uid !== option.uid).map((o) => o.name)}
                    isNew={false}
                    onDone={(updated) => commitOptions(options.map((o) => (o.uid === updated.uid ? updated : o)))}
                    onDelete={() => commitOptions(options.filter((o) => o.uid !== option.uid))}
                    onCancel={() => setEditing(null)}
                  />
                </Box>
              ) : (
                <OptionSummary
                  option={option}
                  disabled={disabled || !!editing}
                  onEdit={() => setEditing({ option, isNew: false })}
                  dragProps={itemProps(index)}
                />
              )}
            </Fragment>
          ))}
        </Box>
      )}
      {editing?.isNew && (
        <OptionEditor
          option={editing.option}
          otherNames={options.map((o) => o.name)}
          isNew
          onDone={(created) => commitOptions([...options, created])}
          onDelete={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      )}
      {!disabled && !editing && options.length < MAX_PRODUCT_OPTIONS && (
        <Button
          startIcon={<AddIcon />}
          onClick={() => setEditing({ option: { uid: newUid('o'), name: '', values: [] }, isNew: true })}
          sx={{ alignSelf: 'flex-start' }}
        >
          {options.length === 0 ? 'Agregar opciones como talla o color' : 'Agregar otra opción'}
        </Button>
      )}

      {/* ---------- Variantes ---------- */}
      {options.length > 0 && (
        <Box>
          <Divider sx={{ mb: 1 }} />
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minHeight: 48, flexWrap: 'wrap' }}>
            {selected.size > 0 ? (
              <>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {selected.size} seleccionada{selected.size === 1 ? '' : 's'}
                </Typography>
                <Button size="small" variant="outlined" onClick={() => setBulk(true)}>
                  Editar
                </Button>
                <Tooltip title={selected.size === variants.length ? 'El producto necesita al menos una variante' : ''}>
                  <span>
                    <Button
                      size="small"
                      color="error"
                      disabled={selected.size === variants.length}
                      onClick={() => removeVariants(selected)}
                    >
                      Eliminar
                    </Button>
                  </span>
                </Tooltip>
                <Button size="small" color="inherit" onClick={() => setSelected(new Set())}>
                  Quitar selección
                </Button>
              </>
            ) : (
              groupOption && (
                <TextField
                  select
                  size="small"
                  label="Agrupar por"
                  value={groupOption.uid}
                  onChange={(e) => {
                    setGroupBy(e.target.value);
                    setExpanded(new Set());
                  }}
                  sx={{ minWidth: 160 }}
                >
                  {options.map((o) => (
                    <MenuItem key={o.uid} value={o.uid}>
                      {o.name}
                    </MenuItem>
                  ))}
                </TextField>
              )
            )}
          </Stack>

          <Table size="small" aria-label="Variantes">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    disabled={disabled}
                    checked={selected.size > 0 && selected.size === variants.length}
                    indeterminate={selected.size > 0 && selected.size < variants.length}
                    onChange={(e) => toggle(variants.map((v) => v.uid), e.target.checked)}
                    slotProps={{ input: { 'aria-label': 'Seleccionar todas las variantes' } }}
                  />
                </TableCell>
                <TableCell>Variante</TableCell>
                <TableCell>Precio</TableCell>
                <TableCell>SKU</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groupOption
                ? groupVariants(variants, groupOption).map((group) => {
                    const uids = group.variants.map((v) => v.uid);
                    const selectedCount = uids.filter((u) => selected.has(u)).length;
                    const open = expanded.has(group.value.uid);
                    const { common, range } = priceSummary(group.variants);
                    const invalid = uids.some(hasErrors);
                    return (
                      <Fragment key={group.value.uid}>
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              disabled={disabled}
                              checked={selectedCount === uids.length}
                              indeterminate={selectedCount > 0 && selectedCount < uids.length}
                              onChange={(e) => toggle(uids, e.target.checked)}
                              slotProps={{ input: { 'aria-label': `Seleccionar grupo ${group.value.name}` } }}
                            />
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: invalid ? 'error.main' : undefined }}>
                                  {group.value.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  {group.variants.length} variante{group.variants.length === 1 ? '' : 's'}
                                </Typography>
                              </Box>
                              <IconButton
                                size="small"
                                onClick={() =>
                                  setExpanded((prev) => {
                                    const next = new Set(prev);
                                    if (open) next.delete(group.value.uid);
                                    else next.add(group.value.uid);
                                    return next;
                                  })
                                }
                                aria-label={`${open ? 'Contraer' : 'Expandir'} ${group.value.name}`}
                                aria-expanded={open}
                              >
                                {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                              </IconButton>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            {/* Precio del grupo: cambia el de todas sus variantes (como en Shopify). */}
                            {priceInput(common ?? '', (price) => updateVariants(uids, { price }), `Precio del grupo ${group.value.name}`, {
                              placeholder: range,
                            })}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                        {open && group.variants.map((v) => variantRow(v, true))}
                      </Fragment>
                    );
                  })
                : variants.map((v) => variantRow(v, false))}
            </TableBody>
          </Table>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {variants.length} variante{variants.length === 1 ? '' : 's'}
            </Typography>
            {!disabled && variants.length < totalCombos && (
              <Button size="small" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
                Agregar variante
              </Button>
            )}
          </Stack>
        </Box>
      )}

      {dialogVariant && (
        <VariantDialog
          label={variantLabel(dialogVariant, options)}
          fields={dialogVariant.fields}
          errors={errorsOf(errors, dialogVariant.uid)}
          currency={currency}
          disabled={disabled}
          canDelete={variants.length > 1}
          onSave={(fields) => {
            updateVariants([dialogVariant.uid], fields);
            setOpenVariant(null);
          }}
          onDelete={() => {
            removeVariants(new Set([dialogVariant.uid]));
            setOpenVariant(null);
          }}
          onClose={() => setOpenVariant(null)}
        />
      )}
      {bulk && (
        <BulkEditDialog
          count={selected.size}
          currency={currency}
          onApply={(patch) => {
            updateVariants(selected, patch);
            setBulk(false);
          }}
          onClose={() => setBulk(false)}
        />
      )}
      {adding && (
        <AddVariantDialog
          options={options}
          onAdd={(values) => {
            const next = addVariant(variants, options, values);
            if (!next) return false;
            onChange(options, next);
            setAdding(false);
            return true;
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </Stack>
  );
}
