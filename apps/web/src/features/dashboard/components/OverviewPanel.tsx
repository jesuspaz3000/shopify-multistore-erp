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
import TextLink from '@/components/ui/TextLink';

type Props = {
  tenant: string;
  firstName: string;
  shopsCount: number;
  /** "Vista consolidada..." o "Tienda X". */
  scopeLabel: string;
};

export default function OverviewPanel({ tenant, firstName, shopsCount, scopeLabel }: Props) {
  // Productos, órdenes y bodegas llegarán con sus módulos.
  const stats = [
    { label: 'Tiendas', value: shopsCount, icon: StorefrontIcon },
    { label: 'Productos', value: 0, icon: SellIcon },
    { label: 'Órdenes del mes', value: 0, icon: ReceiptLongIcon },
    { label: 'Bodegas', value: 0, icon: WarehouseIcon },
  ];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          Hola, {firstName}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {scopeLabel}
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {stats.map(({ label, value, icon: Icon }) => (
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

      {shopsCount === 0 ? (
        <Alert severity="info" variant="outlined">
          <AlertTitle>Primer paso</AlertTitle>
          Agrega tus tiendas en <TextLink href={`/${tenant}/settings/shops`}>Configuración → Tiendas</TextLink>.
        </Alert>
      ) : (
        <Alert severity="info" variant="outlined">
          <AlertTitle>Próximo paso</AlertTitle>
          Conectar las tiendas con Shopify para sincronizar productos, inventario y órdenes (disponible cuando se
          configure la app en Shopify).
        </Alert>
      )}
    </Stack>
  );
}
