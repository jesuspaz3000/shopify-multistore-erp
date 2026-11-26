'use client';

import {
  acceptInvitationExistingUserSchema,
  acceptInvitationNewUserSchema,
  type InvitationPreviewResponse,
  PASSWORD_MIN_LENGTH,
} from '@erp/contracts';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { roleLabel } from '@/features/tenant/role-labels';
import { acceptInvitation } from '../api/members.api';
import { useMutationForm } from './useMutationForm';

type Props = { token: string; invitation: InvitationPreviewResponse };

/** Aceptar invitación: crea la cuenta (si no existe) o confirma con la contraseña actual. */
export default function AcceptInvitationForm({ token, invitation }: Props) {
  const existing = invitation.userExists;
  const [values, setValues] = useState({ firstName: '', lastName: '', password: '' });
  const { errors, formError, submitting, submit } = useMutationForm(
    existing ? acceptInvitationExistingUserSchema : acceptInvitationNewUserSchema,
  );

  const set = (name: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [name]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submit(existing ? { password: values.password } : values, async (data) => {
      const { slug } = await acceptInvitation(token, data);
      // Navegación completa: la sesión cambió (puede haber otra cuenta abierta en este navegador).
      window.location.replace(`/${slug}/all`);
    });
  };

  return (
    <Stack component="form" onSubmit={handleSubmit} noValidate spacing={2.5}>
      <div>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          Únete a {invitation.companyName}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {invitation.invitedBy} te invitó como <strong>{roleLabel(invitation.role)}</strong>.
        </Typography>
      </div>

      {formError && <Alert severity="error">{formError}</Alert>}

      <TextField label="Email" value={invitation.email} fullWidth disabled />

      {existing ? (
        <Alert severity="info" variant="outlined">
          Ya tienes una cuenta con este email. Confirma con tu contraseña para sumar esta empresa.
        </Alert>
      ) : (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Nombre"
            autoFocus
            autoComplete="given-name"
            value={values.firstName}
            onChange={set('firstName')}
            error={!!errors.firstName}
            helperText={errors.firstName}
            fullWidth
          />
          <TextField
            label="Apellido"
            autoComplete="family-name"
            value={values.lastName}
            onChange={set('lastName')}
            error={!!errors.lastName}
            helperText={errors.lastName}
            fullWidth
          />
        </Stack>
      )}

      <TextField
        label={existing ? 'Tu contraseña' : 'Crea una contraseña'}
        type="password"
        autoFocus={existing}
        autoComplete={existing ? 'current-password' : 'new-password'}
        value={values.password}
        onChange={set('password')}
        error={!!errors.password}
        helperText={errors.password ?? (existing ? undefined : `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`)}
        fullWidth
      />

      <Button type="submit" variant="contained" size="large" loading={submitting} fullWidth>
        Aceptar invitación
      </Button>
    </Stack>
  );
}
