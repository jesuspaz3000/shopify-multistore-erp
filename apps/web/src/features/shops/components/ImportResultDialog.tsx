'use client';

import type { ShopifyImportResponse } from '@erp/contracts';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';

type Props = { tenant: string; shopName: string; result: ShopifyImportResponse; onClose: () => void };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Resumen de "Importar desde Shopify": qué se creó, actualizó u omitió. */
export default function ImportResultDialog({ tenant, shopName, result, onClose }: Props) {
  const { locations, products, stock, warnings } = result;
  const rows = [
    {
      label: 'Productos',
      value: `${products.total} en Shopify`,
      detail: [
        products.created && `${products.created} nuevos`,
        products.updated && `${products.updated} actualizados`,
        products.unchanged && `${products.unchanged} sin cambios`,
        products.failed && `${products.failed} con error`,
      ]
        .filter(Boolean)
        .join(' · '),
    },
    {
      label: 'Ubicaciones → bodegas',
      value: plural(locations.total, 'ubicación', 'ubicaciones'),
      detail: [locations.created && `${locations.created} bodegas nuevas`, locations.linked && `${locations.linked} emparejadas por nombre`]
        .filter(Boolean)
        .join(' · '),
    },
    { label: 'Stock', value: plural(stock.adjusted, 'nivel actualizado', 'niveles actualizados'), detail: 'Disponible igual al de Shopify, registrado en el kardex' },
  ];

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Importación de “{shopName}”</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity={products.failed ? 'warning' : 'success'} variant="outlined">
            {products.failed
              ? `Se importó con ${plural(products.failed, 'producto', 'productos')} con error (detalle abajo).`
              : 'Importación completa.'}
          </Alert>
          <List dense disablePadding>
            {rows.map((row) => (
              <ListItem key={row.label} disableGutters divider>
                <ListItemText primary={`${row.label}: ${row.value}`} secondary={row.detail || undefined} />
              </ListItem>
            ))}
          </List>
          {warnings.length > 0 && (
            <>
              <Typography variant="subtitle2">Avisos</Typography>
              <List dense disablePadding sx={{ maxHeight: 220, overflow: 'auto' }}>
                {warnings.map((w, i) => (
                  <ListItem key={i} disableGutters>
                    <ListItemText primary={w.message} secondary={w.product ?? undefined} />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cerrar
        </Button>
        <Button component={Link} href={`/${tenant}/all/products`} variant="contained">
          Ver productos
        </Button>
      </DialogActions>
    </Dialog>
  );
}
