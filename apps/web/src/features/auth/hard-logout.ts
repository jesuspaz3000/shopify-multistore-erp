import { logout } from './api/auth.api';

/**
 * Cierra la sesión y hace una navegación COMPLETA a /login (no una navegación del router).
 * Así se descarta todo lo que el navegador tenga en memoria del usuario: caché del router y
 * páginas ocultas que Next 16 conserva con <Activity>. Es la práctica recomendada para logout.
 */
export async function hardLogout(): Promise<void> {
  try {
    await logout();
  } finally {
    window.location.replace('/login');
  }
}
