'use client';

import LogoutIcon from '@mui/icons-material/Logout';
import Button from '@mui/material/Button';
import { useState } from 'react';
import { hardLogout } from '../hard-logout';

/** Botón "Cerrar sesión" para páginas sin menú de usuario (ej. elegir empresa). */
export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    await hardLogout();
  };

  return (
    <Button startIcon={<LogoutIcon />} color="inherit" loading={loading} onClick={handleClick}>
      Cerrar sesión
    </Button>
  );
}
