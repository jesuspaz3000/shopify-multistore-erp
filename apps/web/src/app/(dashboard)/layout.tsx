import LinearProgress from '@mui/material/LinearProgress';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getMe } from '@/lib/session';

// Área privada. La sesión se valida EN EL SERVIDOR contra la API (no solo en proxy).
// Va dentro de <Suspense> porque lee cookies (dato dinámico) con cacheComponents activado.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LinearProgress />}>
      <RequireSession>{children}</RequireSession>
    </Suspense>
  );
}

async function RequireSession({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect('/login');
  return children;
}
