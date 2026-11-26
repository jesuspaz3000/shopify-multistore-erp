import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginForm from '@/features/auth/components/LoginForm';
import SignupLink from '@/features/auth/components/SignupLink';

export const metadata: Metadata = { title: 'Iniciar sesión' };

// El formulario es estático (aparece al instante); el enlace de registro depende de la API.
export default function LoginPage() {
  return (
    <LoginForm
      footer={
        <Suspense fallback={null}>
          <SignupLink />
        </Suspense>
      }
    />
  );
}
