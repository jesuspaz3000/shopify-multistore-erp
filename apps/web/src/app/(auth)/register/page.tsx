import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import TextLink from '@/components/ui/TextLink';
import { getAuthConfig } from '@/features/auth/api/auth-config.server';
import RegisterForm from '@/features/auth/components/RegisterForm';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default function RegisterPage() {
  return (
    <Suspense fallback={<Skeleton variant="rounded" height={360} />}>
      <RegisterGate />
    </Suspense>
  );
}

/** Con el registro público desactivado, explica cómo se obtiene una cuenta en vez del formulario. */
async function RegisterGate() {
  const { signupEnabled } = await getAuthConfig();
  if (signupEnabled) return <RegisterForm />;

  return (
    <Stack spacing={2}>
      <Alert severity="info" variant="outlined">
        <AlertTitle>Registro por invitación</AlertTitle>
        Las cuentas de empresa las crea el administrador de la plataforma. Si formas parte de un equipo, pide a tu
        administrador que te envíe una invitación.
      </Alert>
      <TextLink href="/login" sx={{ textAlign: 'center' }}>
        Volver a iniciar sesión
      </TextLink>
    </Stack>
  );
}
