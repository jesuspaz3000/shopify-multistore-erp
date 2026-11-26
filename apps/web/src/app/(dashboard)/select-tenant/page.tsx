import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import TopRightActions from '@/components/layout/TopRightActions';
import LogoutButton from '@/features/auth/components/LogoutButton';
import TenantList from '@/features/tenant/components/TenantList';
import { getMe } from '@/lib/session';

export const metadata: Metadata = { title: 'Elegir empresa' };

// El marco (tarjeta, botón de tema) aparece al instante; los datos de la sesión cargan dentro de <Suspense>.
export default function SelectTenantPage() {
  return (
    <Box component="main" sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 2 }}>
      <TopRightActions />
      <Paper variant="outlined" sx={{ width: '100%', maxWidth: 520, p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        <Suspense fallback={<TenantPickerSkeleton />}>
          <TenantPicker />
        </Suspense>
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <LogoutButton />
        </Box>
      </Paper>
    </Box>
  );
}

async function TenantPicker() {
  const me = await getMe();
  if (!me) redirect('/login');

  // Con una sola empresa no hay nada que elegir.
  if (me.memberships.length === 1) redirect(`/${me.memberships[0].slug}/all`);

  return (
    <>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
        Hola, {me.user.firstName}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 3 }}>
        {me.memberships.length > 0 ? 'Elige la empresa con la que quieres trabajar.' : 'Aún no perteneces a ninguna empresa.'}
      </Typography>
      {me.user.isSuperuser && me.memberships.length === 0 && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          Eres <strong>superadmin</strong> de la plataforma. El panel de administración global (ver y gestionar todas las
          empresas) se construirá más adelante.
        </Alert>
      )}
      <TenantList memberships={me.memberships} />
    </>
  );
}

function TenantPickerSkeleton() {
  return (
    <>
      <Skeleton variant="text" width="60%" height={40} />
      <Skeleton variant="text" width="80%" sx={{ mb: 3 }} />
      <Skeleton variant="rounded" height={64} />
    </>
  );
}
