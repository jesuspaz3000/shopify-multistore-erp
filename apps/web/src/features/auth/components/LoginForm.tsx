'use client';

import { loginSchema } from '@erp/contracts';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { login } from '../api/auth.api';
import { useZodForm } from '@/hooks/useZodForm';
import GoogleSignInButton from './GoogleSignInButton';

/** `footer`: contenido opcional bajo el formulario (ej. enlace de registro si está habilitado). */
export default function LoginForm({ footer }: { footer?: React.ReactNode }) {
  const router = useRouter();
  const { values, setField, fieldErrors, formError, submitting, handleSubmit } = useZodForm(
    loginSchema,
    { email: '', password: '' },
    async (input) => {
      const me = await login(input);
      // Con una sola empresa se entra directo (sin pasar por "Elegir empresa": un parpadeo menos).
      // Sin router.refresh(): replace ya trae la página nueva del servidor (refrescar la volvía a pedir).
      router.replace(me.memberships.length === 1 ? `/${me.memberships[0].slug}/all` : '/select-tenant');
    },
  );

  return (
    <Stack component="form" onSubmit={handleSubmit} noValidate spacing={2.5}>
      <div>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          Iniciar sesión
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Administra todas tus tiendas desde un solo panel.
        </Typography>
      </div>

      {formError && <Alert severity="error">{formError}</Alert>}

      <TextField
        label="Email"
        type="email"
        autoComplete="new-email"
        autoFocus
        value={values.email}
        onChange={setField('email')}
        error={!!fieldErrors.email}
        helperText={fieldErrors.email}
        fullWidth
      />
      <TextField
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        value={values.password}
        onChange={setField('password')}
        error={!!fieldErrors.password}
        helperText={fieldErrors.password}
        fullWidth
      />

      <Button type="submit" variant="contained" size="large" loading={submitting} fullWidth>
        Entrar
      </Button>

      <GoogleSignInButton />

      {footer}
    </Stack>
  );
}
