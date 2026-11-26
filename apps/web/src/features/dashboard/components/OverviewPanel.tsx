import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SellIcon from '@mui/icons-material/Sell';
import StorefrontIcon from '@mui/icons-material/Storefront';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// Indicadores del resumen. Los valores reales llegarán con los módulos de tiendas, catálogo y órdenes.
const STATS = [
  { label: 'Tiendas conectadas', value: '0', icon: StorefrontIcon },
  { label: 'Productos', value: '0', icon: SellIcon },
  { label: 'Órdenes del mes', value: '0', icon: ReceiptLongIcon },
  { label: 'Bodegas', value: '0', icon: WarehouseIcon },
];

export default function OverviewPanel({ firstName }: { firstName: string }) {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          Hola, {firstName}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Vista consolidada de todas tus tiendas.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {STATS.map(({ label, value, icon: Icon }) => (
          <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <Icon sx={{ color: 'primary.main' }} />
                  <Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {label}
                    </Typography>
                    <Typography variant="h5" component="p" sx={{ fontWeight: 600 }}>
                      {value}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Alert severity="info" variant="outlined">
        <AlertTitle>Próximo paso</AlertTitle>
        Conecta tu primera tienda Shopify para empezar a sincronizar productos, inventario y órdenes. (Disponible
        cuando se configure la app en Shopify.)
      </Alert>
    </Stack>
  );
}
