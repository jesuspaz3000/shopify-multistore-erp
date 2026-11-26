'use client';

import { createTheme } from '@mui/material/styles';

// Tema base de MUI v9. Se personaliza (paleta, tipografía, overrides) más adelante
// en palette.ts / components.ts.
const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: 'class',
  },
  colorSchemes: {
    light: true,
    dark: true,
  },
});

export default theme;
