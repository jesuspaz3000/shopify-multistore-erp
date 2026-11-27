'use client';

import { type AdjustmentReason, type InventoryRow, MANUAL_ADJUSTMENT_REASONS, type Paginated } from '@erp/contracts';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import DataTable, { type Column } from '@/components/data-table/DataTable';
import TableSearch from '@/components/data-table/TableSearch';
import TextLink from '@/components/ui/TextLink';
import { ApiError } from '@/lib/http';
import { adjustInventory } from '../api/inventory.api';
import { parseAvailableInput, REASON_LABELS } from '../inventory-labels';
import { useUiStore } from '@/stores/UiStoreProvider';

type Props = {
  tenant: string;
  /** /{tenant}/{shop}: para enlazar al producto. */
  shopPath: string;
  page: Paginated<InventoryRow>;
  searchQuery?: string;
  /** Bodega elegida; null = todas (solo lectura). */
  locationId: number | null;
  canWrite: boolean;
};

/** Cambio pendiente en una fila: lo escrito y el disponible que se veía al escribir (compare-and-set). */
type Edit = { text: string; original: number; row: InventoryRow };

/** Stock por variante. Con una bodega elegida, "Disponible" se edita en la tabla y se guarda en lote. */
export default function StockTable({ tenant, shopPath, page, searchQuery, locationId, canWrite }: Props) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [reason, setReason] = useState<Exclude<AdjustmentReason, 'initial'>>('correction');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Aviso global (AppShell): sobrevive al router.refresh() que vuelve a montar la página.
  const setToast = useUiStore((s) => s.notify);
  // Cantidades que devolvió el último guardado: se muestran al instante, hasta que llega la página refrescada.
  const [saved, setSaved] = useState<{ forPage: Paginated<InventoryRow>; levels: Record<number, { available: number; onHand: number }> }>({
    forPage: page,
    levels: {},
  });
  if (saved.forPage !== page) setSaved({ forPage: page, levels: {} });
  const editable = canWrite && locationId !== null;
  const shown = (r: InventoryRow) => ({ ...r, ...saved.levels[r.inventoryItemId] });

  const pending = Object.entries(edits).filter(([, e]) => e.text.trim() !== '' && e.text.trim() !== String(e.original));
  const invalid = pending.filter(([, e]) => !parseAvailableInput(e.text));

  const setEdit = (row: InventoryRow, text: string) => {
    setError(null);
    setEdits((prev) => ({ ...prev, [row.inventoryItemId]: { text, original: prev[row.inventoryItemId]?.original ?? row.available, row } }));
  };

  const save = async () => {
    if (!locationId || invalid.length) return;
    setSaving(true);
    setError(null);
    try {
      const result = await adjustInventory(tenant, {
        locationId,
        reason,
        note,
        changes: pending.map(([itemId, e]) => ({
          inventoryItemId: Number(itemId),
          ...parseAvailableInput(e.text)!,
          compareQuantity: e.original,
        })),
      });
      setSaved({ forPage: page, levels: Object.fromEntries(result.levels.map((l) => [l.inventoryItemId, l])) });
      setEdits({});
      setNote('');
      setToast(`${pending.length} cambio${pending.length === 1 ? '' : 's'} guardado${pending.length === 1 ? '' : 's'}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el ajuste');
    } finally {
      setSaving(false);
    }
  };

  const preview = (e: Edit | undefined) => {
    const parsed = e && parseAvailableInput(e.text);
    if (!e || !parsed) return null;
    return 'delta' in parsed ? e.original + parsed.delta : parsed.quantity;
  };

  const columns: Column<InventoryRow>[] = [
    {
      key: 'product',
      header: 'Producto',
      minWidth: 240,
      render: (r) => (
        <>
          <TextLink href={`${shopPath}/products/${r.productId}`} variant="body2" sx={{ fontWeight: 500, display: 'block' }}>
            {r.productTitle}
          </TextLink>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {[r.variantTitle, r.sku ?? 'Sin SKU'].filter(Boolean).join(' · ')}
          </Typography>
        </>
      ),
    },
    {
      key: 'unavailable',
      header: <Tooltip title="Reservado, dañado, stock de seguridad o en control de calidad"><span>No disponible</span></Tooltip>,
      align: 'right',
      render: (r) => r.unavailable,
    },
    {
      key: 'committed',
      header: <Tooltip title="Vendido en pedidos aún no despachados"><span>Comprometido</span></Tooltip>,
      align: 'right',
      render: (r) => r.committed,
    },
    {
      key: 'available',
      header: 'Disponible',
      align: 'right',
      minWidth: editable ? 150 : undefined,
      render: (r) => {
        if (!editable) return <strong>{r.available}</strong>;
        const edit = edits[r.inventoryItemId];
        const result = preview(edit);
        const bad = !!edit && edit.text.trim() !== '' && result === null;
        return (
          <TextField
            size="small"
            value={edit?.text ?? String(r.available)}
            onChange={(e) => setEdit(r, e.target.value)}
            error={bad || (result !== null && result < 0)}
            helperText={
              bad ? 'Usa 12, +5 o -3' : result !== null && result !== r.available ? `Quedará en ${result}` : undefined
            }
            sx={{ width: 120 }}
            slotProps={{ htmlInput: { inputMode: 'numeric', style: { textAlign: 'right' }, 'aria-label': `Disponible de ${r.productTitle} ${r.variantTitle ?? ''}`.trim() } }}
          />
        );
      },
    },
    { key: 'onHand', header: <Tooltip title="Unidades físicas en bodega"><span>En mano</span></Tooltip>, align: 'right', render: (r) => r.onHand },
  ];

  return (
    <Stack spacing={2}>
      {locationId === null && (
        <Alert severity="info" variant="outlined">
          Estás viendo la suma de todas las bodegas. Elige una bodega para ajustar su stock.
        </Alert>
      )}
      {editable && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Escribe la nueva cantidad (ej. <strong>12</strong>) o un ajuste (<strong>+5</strong>, <strong>-3</strong>) y guarda los cambios.
        </Typography>
      )}
      <TableSearch placeholder="Buscar por producto, variante o SKU…" />
      <DataTable
        columns={columns}
        data={{ ...page, items: page.items.map(shown) }}
        getRowId={(r) => r.inventoryItemId}
        searchQuery={searchQuery}
        emptyMessage="No hay productos que controlen stock. Actívalo en la ficha del producto (Inventario → Controlar cantidad)."
        aria-label="Stock"
      />

      {/* Barra de cambios sin guardar (como en Shopify). */}
      {pending.length > 0 && (
        <Paper
          elevation={6}
          sx={{ position: 'sticky', bottom: 16, p: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', zIndex: 2 }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mr: 'auto' }}>
            {pending.length} cambio{pending.length === 1 ? '' : 's'} sin guardar
          </Typography>
          <TextField select size="small" label="Motivo" value={reason} onChange={(e) => setReason(e.target.value as Exclude<AdjustmentReason, 'initial'>)} sx={{ minWidth: 210 }}>
            {MANUAL_ADJUSTMENT_REASONS.map((r) => (
              <MenuItem key={r} value={r}>
                {REASON_LABELS[r]}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} sx={{ minWidth: 200 }} />
          <Button color="inherit" onClick={() => setEdits({})} disabled={saving}>
            Descartar
          </Button>
          <Button variant="contained" onClick={save} loading={saving} disabled={invalid.length > 0}>
            Guardar
          </Button>
          {error && (
            <Alert
              severity="error"
              sx={{ width: '100%' }}
              action={
                <Button color="inherit" size="small" onClick={() => { setEdits({}); setError(null); router.refresh(); }}>
                  Recargar
                </Button>
              }
            >
              {error}
            </Alert>
          )}
        </Paper>
      )}
    </Stack>
  );
}
