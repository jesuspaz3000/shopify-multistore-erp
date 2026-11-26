'use client';

import { roleInputSchema, type RoleResponse } from '@erp/contracts';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { canGrant } from '@/features/tenant/permissions';
import { PERMISSION_GROUPS, roleLabel } from '@/features/tenant/role-labels';
import { createRole, updateRole } from '../api/members.api';
import { useMutationForm } from './useMutationForm';

type Props = {
  tenant: string;
  myPermissions: string[];
  /** Rol propio a editar. */
  role?: RoleResponse;
  /** Rol (normalmente predefinido) del que se copian los permisos al crear. */
  basedOn?: RoleResponse;
  onClose: () => void;
  onSaved: (message: string) => void;
};

const expand = (perms: string[]) =>
  perms.includes('*') ? PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.code)) : perms;

/** Crear o editar un rol propio: nombre, descripción y permisos (solo los que el usuario puede otorgar). */
export default function RoleDialog({ tenant, myPermissions, role, basedOn, onClose, onSaved }: Props) {
  const [name, setName] = useState(role?.name ?? (basedOn ? `${roleLabel(basedOn.name)} (copia)` : ''));
  const [description, setDescription] = useState(role?.description ?? basedOn?.description ?? '');
  const [permissions, setPermissions] = useState<string[]>(
    expand(role?.permissions ?? basedOn?.permissions ?? []).filter((p) => canGrant(myPermissions, [p])),
  );
  const { errors, formError, submitting, submit } = useMutationForm(roleInputSchema);

  const toggle = (code: string) =>
    setPermissions((list) => (list.includes(code) ? list.filter((p) => p !== code) : [...list, code]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submit({ name, description: description || undefined, permissions }, async (data) => {
      if (role) await updateRole(tenant, role.id, data);
      else await createRole(tenant, data);
      onSaved(role ? 'Rol actualizado' : `Rol "${data.name}" creado`);
    });
  };

  return (
    <Dialog open onClose={submitting ? undefined : onClose} fullWidth maxWidth="md">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{role ? `Editar rol "${role.name}"` : 'Crear rol'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {role && role.membersCount > 0 && (
              <Alert severity="info" variant="outlined">
                Los cambios se aplican de inmediato a {role.membersCount} miembro{role.membersCount === 1 ? '' : 's'} con este rol.
              </Alert>
            )}
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Nombre del rol"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={!!errors.name}
                helperText={errors.name ?? 'Ej: Vendedor, Supervisor de tienda'}
                fullWidth
              />
              <TextField
                label="Descripción (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                error={!!errors.description}
                helperText={errors.description}
                fullWidth
              />
            </Stack>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Permisos
              </Typography>
              <Grid container spacing={1.5}>
                {PERMISSION_GROUPS.map((group) => (
                  <Grid key={group.area} size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {group.area}
                    </Typography>
                    {group.permissions.map((p) => {
                      const allowed = canGrant(myPermissions, [p.code]);
                      const control = (
                        <FormControlLabel
                          control={<Checkbox size="small" checked={permissions.includes(p.code)} onChange={() => toggle(p.code)} />}
                          label={p.label}
                          disabled={!allowed}
                        />
                      );
                      return (
                        <Box key={p.code}>
                          {allowed ? control : <Tooltip title="Tu rol no tiene este permiso: no puedes otorgarlo"><span>{control}</span></Tooltip>}
                        </Box>
                      );
                    })}
                  </Grid>
                ))}
              </Grid>
              {errors.permissions && <FormHelperText error>{errors.permissions}</FormHelperText>}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={submitting} color="inherit">
            Cancelar
          </Button>
          <Button type="submit" variant="contained" loading={submitting}>
            {role ? 'Guardar cambios' : 'Crear rol'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
