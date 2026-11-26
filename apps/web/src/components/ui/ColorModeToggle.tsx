'use client';

import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import IconButton from '@mui/material/IconButton';
import { useColorScheme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';

/** Botón para alternar entre modo claro y oscuro (la preferencia se guarda en el navegador). */
export default function ColorModeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();

  // `mode` es undefined en el servidor y en el primer render del cliente (guía MUI).
  // Se reserva el mismo espacio con un botón vacío: sin error de hidratación ni salto de diseño.
  if (!mode) {
    return <IconButton disabled aria-hidden sx={{ width: 40, height: 40 }} />;
  }

  const resolved = mode === 'system' ? systemMode : mode;
  const next = resolved === 'dark' ? 'light' : 'dark';

  return (
    <Tooltip title={next === 'dark' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}>
      <IconButton onClick={() => setMode(next)} aria-label="Cambiar modo de color">
        {resolved === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}
