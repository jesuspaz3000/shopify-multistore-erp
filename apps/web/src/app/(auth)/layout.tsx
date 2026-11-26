import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TopRightActions from '@/components/layout/TopRightActions';

// Layout de rutas públicas (login, registro, recuperar contraseña): tarjeta centrada, sin menú.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="main"
      sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 2, bgcolor: 'background.default' }}
    >
      <TopRightActions />
      <Box sx={{ width: '100%', maxWidth: 460 }}>
        <Typography variant="overline" component="p" sx={{ textAlign: 'center', mb: 2, letterSpacing: 2, fontWeight: 600 }}>
          Shopify ERP
        </Typography>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
          {children}
        </Paper>
      </Box>
    </Box>
  );
}
