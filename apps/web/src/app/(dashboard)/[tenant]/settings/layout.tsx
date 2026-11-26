import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SettingsTabs from '@/features/settings/components/SettingsTabs';

// Configuración de la empresa (no depende de una tienda): pestañas + contenido.
export default function SettingsLayout({ children }: LayoutProps<'/[tenant]/settings'>) {
  return (
    <Box>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 600, mb: 2 }}>
        Configuración
      </Typography>
      <SettingsTabs />
      <Box sx={{ pt: 3 }}>{children}</Box>
    </Box>
  );
}
