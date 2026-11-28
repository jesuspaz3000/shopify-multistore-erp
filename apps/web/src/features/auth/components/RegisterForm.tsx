'use client';

import { PASSWORD_MIN_LENGTH, registerSchema } from '@erp/contracts';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import TextLink from '@/components/ui/TextLink';
import { register } from '../api/auth.api';
import { useZodForm } from '@/hooks/useZodForm';

export default function RegisterForm() {
  const router = useRouter();
  const { values, setField, fieldErrors, formError, submitting, handleSubmit } = useZodForm(
    registerSchema,
    { companyName: '', firstName: '', lastName: '', email: '', password: '' },
    async (input) => {
      const me = await register(input);
      router.replace(`/${me.memberships[0].slug}/all`);
    },
  );

  return (
    <Stack component="form" onSubmit={handleSubmit} noValidate spacing={2.5}>
      <div>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          Crear cuenta de empresa
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Serás el dueño de la cuenta. Después podrás invitar a tu equipo.
        </Typography>
      </div>

      {formError && <Alert severity="error">{formError}</Alert>}

      <TextField
        label="Nombre de la empresa"
        autoComplete="organization"
        autoFocus
        value={values.companyName}
        onChange={setField('companyName')}
        error={!!fieldErrors.companyName}
        helperText={fieldErrors.companyName}
        fullWidth
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Nombre"
          autoComplete="given-name"
          value={values.firstName}
          onChange={setField('firstName')}
          error={!!fieldErrors.firstName}
          helperText={fieldErrors.firstName}
          fullWidth
        />
        <TextField
          label="Apellido"
          autoComplete="family-name"
          value={values.lastName}
          onChange={setField('lastName')}
          error={!!fieldErrors.lastName}
          helperText={fieldErrors.lastName}
          fullWidth
        />
      </Stack>
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
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
        helperText={fieldErrors.password ?? `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
        fullWidth
      />

      <Button type="submit" variant="contained" size="large" loading={submitting} fullWidth>
        Crear cuenta
      </Button>

      <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary' }}>
        ¿Ya tienes cuenta? <TextLink href="/login">Iniciar sesión</TextLink>
      </Typography>
    </Stack>
  );
}
