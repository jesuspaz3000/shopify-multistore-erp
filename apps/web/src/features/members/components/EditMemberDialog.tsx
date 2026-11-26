'use client';

import { type MemberResponse, type RoleOptionResponse, type ShopOptionResponse, updateMemberSchema } from '@erp/contracts';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import { useState } from 'react';
import { updateMember } from '../api/members.api';
import MemberAccessFields, { type MemberAccess } from './MemberAccessFields';
import { useMutationForm } from './useMutationForm';

type Props = {
  tenant: string;
  member: MemberResponse;
  roles: RoleOptionResponse[];
  shops: ShopOptionResponse[];
  onClose: () => void;
  onSaved: () => void;
};

export default function EditMemberDialog({ tenant, member, roles, shops, onClose, onSaved }: Props) {
  const [access, setAccess] = useState<MemberAccess>({
    roleName: member.role,
    allShopsAccess: member.allShopsAccess,
    shopIds: member.shopIds,
  });
  const { errors, formError, submitting, submit } = useMutationForm(updateMemberSchema);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submit(access, async (data) => {
      await updateMember(tenant, member.tenantUserId, data);
      onSaved();
    });
  };

  return (
    <Dialog open onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>
          Editar a {member.firstName} {member.lastName}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <MemberAccessFields value={access} onChange={setAccess} roles={roles} shops={shops} errors={errors} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={submitting} color="inherit">
            Cancelar
          </Button>
          <Button type="submit" variant="contained" loading={submitting}>
            Guardar cambios
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
