'use client';

import LogoutIcon from '@mui/icons-material/Logout';
import Button from '@mui/material/Button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { logout } from '../api/auth.api';

/** Botón "Cerrar sesión" para páginas sin menú de usuario (ej. elegir empresa). */
export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await logout();
    } finally {
      router.replace('/login');
      router.refresh();
    }
  };

  return (
    <Button startIcon={<LogoutIcon />} color="inherit" loading={loading} onClick={handleClick}>
      Cerrar sesión
    </Button>
  );
}
