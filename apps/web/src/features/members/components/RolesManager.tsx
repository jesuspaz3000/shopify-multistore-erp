'use client';

import type { Paginated, RoleResponse } from '@erp/contracts';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import DataTable, { type Column } from '@/components/data-table/DataTable';
import TableSearch from '@/components/data-table/TableSearch';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { canGrant } from '@/features/tenant/permissions';
import { roleLabel, summarizePermissions } from '@/features/tenant/role-labels';
import { ApiError } from '@/lib/http';
import { deleteRole } from '../api/members.api';
import RoleDialog from './RoleDialog';
import { useUiStore } from '@/stores/UiStoreProvider';

type Props = {
  tenant: string;
  page: Paginated<RoleResponse>;
  searchQuery?: string;
  myPermissions: string[];
  canManage: boolean;
};

/**
 * Roles de la empresa (paginados). Todos se editan y eliminan (si no están en uso), salvo el
 * Dueño: rol del sistema con todos los permisos, que nadie puede modificar.
 */
export default function RolesManager({ tenant, page, searchQuery, myPermissions, canManage }: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ role?: RoleResponse; basedOn?: RoleResponse } | null>(null);
  const [deleting, setDeleting] = useState<RoleResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Aviso global (AppShell): sobrevive al router.refresh() que vuelve a montar la página.
  const setToast = useUiStore((s) => s.notify);

  const done = (message: string) => {
    setDialog(null);
    setToast(message);
    router.refresh();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteRole(tenant, deleting.id);
      setDeleting(null);
      done('Rol eliminado');
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : 'No se pudo eliminar el rol');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<RoleResponse>[] = [
    {
      key: 'role',
      header: 'Rol',
      minWidth: 200,
      render: (r) => (
        <>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {roleLabel(r.name)}
            </Typography>
            {r.isSystem && (
              <Tooltip title="Rol del sistema: siempre tiene todos los permisos y nadie puede modificarlo">
                <Chip size="small" variant="outlined" icon={<LockOutlinedIcon />} label="Sistema" />
              </Tooltip>
            )}
          </Stack>
          {r.description && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {r.description}
            </Typography>
          )}
        </>
      ),
    },
    {
      key: 'permissions',
      header: 'Permisos',
      render: (r) => (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {summarizePermissions(r.permissions).map((s) => (
            <Chip key={s} size="small" label={s} />
          ))}
        </Box>
      ),
    },
    { key: 'members', header: 'Miembros', align: 'center', render: (r) => r.membersCount },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      nowrap: true,
      hidden: !canManage,
      render: (r) => {
        const editable = !r.isSystem && canGrant(myPermissions, r.permissions);
        return (
          <>
            {editable && (
              <Tooltip title="Editar nombre y permisos">
                <IconButton size="small" onClick={() => setDialog({ role: r })} aria-label={`Editar ${r.name}`}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {!r.isSystem && (
              <Tooltip title="Duplicar como rol nuevo">
                <IconButton size="small" onClick={() => setDialog({ basedOn: r })} aria-label={`Duplicar ${r.name}`}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {editable && (
              <Tooltip title={r.membersCount > 0 ? 'En uso: reasigna a sus miembros primero' : 'Eliminar rol'}>
                <span>
                  <IconButton size="small" disabled={r.membersCount > 0} onClick={() => setDeleting(r)} aria-label={`Eliminar ${r.name}`}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </>
        );
      },
    },
  ];

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h6" component="h2">
            Roles
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Cada rol es un conjunto de permisos. Edita los existentes o crea los tuyos. Nadie otorga más permisos que los suyos.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <TableSearch placeholder="Buscar rol…" />
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog({})} sx={{ flexShrink: 0 }}>
              Crear rol
            </Button>
          )}
        </Stack>
      </Stack>

      <DataTable columns={columns} data={page} getRowId={(r) => r.id} searchQuery={searchQuery} aria-label="Roles" />

      {dialog && (
        <RoleDialog
          key={dialog.role?.id ?? `copy-${dialog.basedOn?.id ?? 'new'}`}
          tenant={tenant}
          myPermissions={myPermissions}
          role={dialog.role}
          basedOn={dialog.basedOn}
          onClose={() => setDialog(null)}
          onSaved={done}
        />
      )}

      <ConfirmDialog
        item={deleting}
        title={() => '¿Eliminar el rol?'}
        description={(role) => (
          <>
            Se eliminará el rol <strong>{role.name}</strong>. Esta acción no se puede deshacer.
          </>
        )}
        busy={busy}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
      />
    </Stack>
  );
}
