'use client';

import { type CreatedInvitationResponse, inviteMemberSchema, type RoleOptionResponse, type ShopOptionResponse } from '@erp/contracts';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { inviteMember } from '../api/members.api';
import MemberAccessFields, { type MemberAccess } from './MemberAccessFields';
import { useMutationForm } from './useMutationForm';

type Props = {
  tenant: string;
  roles: RoleOptionResponse[];
  shops: ShopOptionResponse[];
  onClose: () => void;
  onInvited: (invitation: CreatedInvitationResponse) => void;
};

export default function InviteDialog({ tenant, roles, shops, onClose, onInvited }: Props) {
  const [email, setEmail] = useState('');
  // Rol inicial: 'Solo lectura' si existe; si no, el primer rol de la empresa que se pueda otorgar.
  const defaultRole = roles.find((r) => r.name === 'Solo lectura') ?? roles.find((r) => !r.isSystem) ?? roles[0];
  const [access, setAccess] = useState<MemberAccess>({ roleName: defaultRole?.name ?? '', allShopsAccess: true, shopIds: [] });
  const { errors, formError, submitting, submit } = useMutationForm(inviteMemberSchema);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submit({ email, ...access }, async (data) => onInvited(await inviteMember(tenant, data)));
  };

  return (
    <Dialog open onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>Invitar usuario</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label="Email"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={!!errors.email}
              helperText={errors.email ?? 'Se generará un link de invitación válido por 7 días'}
              fullWidth
            />
            <MemberAccessFields value={access} onChange={setAccess} roles={roles} shops={shops} errors={errors} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={submitting} color="inherit">
            Cancelar
          </Button>
          <Button type="submit" variant="contained" loading={submitting}>
            Crear invitación
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
