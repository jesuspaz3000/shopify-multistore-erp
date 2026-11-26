import Box from '@mui/material/Box';
import ColorModeToggle from '@/components/ui/ColorModeToggle';

/** Acciones fijas arriba a la derecha en páginas sin barra superior (login, registro, elegir empresa). */
export default function TopRightActions() {
  return (
    <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 'appBar' }}>
      <ColorModeToggle />
    </Box>
  );
}
