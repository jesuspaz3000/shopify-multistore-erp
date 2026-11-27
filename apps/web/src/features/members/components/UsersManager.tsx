'use client';

import type {
  CreatedInvitationResponse,
  InvitationResponse,
  MemberResponse,
  Paginated,
  RoleOptionResponse,
  ShopOptionResponse,
} from '@erp/contracts';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LinkIcon from '@mui/icons-material/Link';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
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
import { roleLabel } from '@/features/tenant/role-labels';
import { ApiError } from '@/lib/http';
import { removeMember, resendInvitation, revokeInvitation } from '../api/members.api';
import { INVITATIONS_PREFIX } from '../table-params';
import EditMemberDialog from './EditMemberDialog';
import InviteDialog from './InviteDialog';
import InviteLinkDialog from './InviteLinkDialog';
import { useUiStore } from '@/stores/UiStoreProvider';

type Props = {
  tenant: string;
  /** Permisos del usuario actual en la empresa. */
  myPermissions: string[];
  members: Paginated<MemberResponse>;
  membersSearch?: string;
  invitations: Paginated<InvitationResponse>;
  invitationsSearch?: string;
  /** Todos los roles y tiendas (selectores y nombres en la tabla). */
  roles: RoleOptionResponse[];
  shops: ShopOptionResponse[];
};

type Confirm = { title: string; text: string; action: () => Promise<void>; done: string };

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es', { dateStyle: 'medium' }) : 'Nunca');

export default function UsersManager({
  tenant,
  myPermissions,
  members,
  membersSearch,
  invitations,
  invitationsSearch,
  roles,
  shops,
}: Props) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<MemberResponse | null>(null);
  const [link, setLink] = useState<CreatedInvitationResponse | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Aviso global (AppShell): sobrevive al router.refresh() que vuelve a montar la página.
  const setToast = useUiStore((s) => s.notify);

  const permissionsOf = (role: string) => roles.find((r) => r.name === role)?.permissions ?? ['*'];
  const grantableRoles = roles.filter((r) => canGrant(myPermissions, r.permissions));
  const canManage = (m: MemberResponse) => !m.isYou && canGrant(myPermissions, permissionsOf(m.role));
  const shopNames = (all: boolean, ids: number[]) =>
    all ? 'Todas' : ids.map((id) => shops.find((s) => s.id === id)?.name ?? `#${id}`).join(', ') || '—';

  const refresh = (message: string) => {
    setToast(message);
    router.refresh();
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    setConfirmError(null);
    try {
      await confirm.action();
      refresh(confirm.done);
      setConfirm(null);
    } catch (error) {
      setConfirmError(error instanceof ApiError ? error.message : 'Ocurrió un error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const resend = async (inv: InvitationResponse) => {
    try {
      setLink(await resendInvitation(tenant, inv.id));
      router.refresh();
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : 'No se pudo generar el link', 'error');
    }
  };

  const memberColumns: Column<MemberResponse>[] = [
    {
      key: 'user',
      header: 'Usuario',
      minWidth: 220,
      render: (m) => (
        <>
          {/* component="div": un Chip (div) no puede ir dentro de un <p> (error de hidratación) */}
          <Typography variant="body2" component="div" sx={{ fontWeight: 500 }}>
            {m.firstName} {m.lastName} {m.isYou && <Chip label="Tú" size="small" sx={{ ml: 0.5 }} />}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {m.email}
          </Typography>
        </>
      ),
    },
    { key: 'role', header: 'Rol', render: (m) => roleLabel(m.role) },
    { key: 'shops', header: 'Tiendas', render: (m) => shopNames(m.allShopsAccess, m.shopIds) },
    { key: 'lastLogin', header: 'Último acceso', nowrap: true, render: (m) => formatDate(m.lastLoginAt) },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      nowrap: true,
      render: (m) =>
        canManage(m) ? (
          <>
            <Tooltip title="Cambiar rol o tiendas">
              <IconButton size="small" onClick={() => setEditing(m)} aria-label={`Editar ${m.email}`}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Quitar de la empresa">
              <IconButton
                size="small"
                aria-label={`Quitar ${m.email}`}
                onClick={() =>
                  setConfirm({
                    title: '¿Quitar de la empresa?',
                    text: `${m.firstName} ${m.lastName} perderá el acceso de inmediato. Su cuenta no se elimina.`,
                    action: () => removeMember(tenant, m.tenantUserId),
                    done: 'Usuario quitado de la empresa',
                  })
                }
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {m.isYou ? 'Tu cuenta' : 'Sin permiso'}
          </Typography>
        ),
    },
  ];

  const invitationColumns: Column<InvitationResponse>[] = [
    { key: 'email', header: 'Email', minWidth: 200, render: (inv) => inv.email },
    { key: 'role', header: 'Rol', render: (inv) => roleLabel(inv.role) },
    { key: 'shops', header: 'Tiendas', render: (inv) => shopNames(inv.allShopsAccess, inv.shopIds) },
    { key: 'invitedBy', header: 'Invitado por', render: (inv) => inv.invitedBy },
    {
      key: 'expires',
      header: 'Vence',
      nowrap: true,
      render: (inv) =>
        inv.status === 'expired' ? <Chip size="small" label="Vencida" color="warning" variant="outlined" /> : formatDate(inv.expiresAt),
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      nowrap: true,
      render: (inv) =>
        canGrant(myPermissions, permissionsOf(inv.role)) && (
          <>
            <Tooltip title="Generar nuevo link (el anterior deja de servir)">
              <IconButton size="small" onClick={() => resend(inv)} aria-label={`Nuevo link para ${inv.email}`}>
                <LinkIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Cancelar invitación">
              <IconButton
                size="small"
                aria-label={`Cancelar invitación de ${inv.email}`}
                onClick={() =>
                  setConfirm({
                    title: '¿Cancelar la invitación?',
                    text: `El link enviado a ${inv.email} dejará de funcionar.`,
                    action: () => revokeInvitation(tenant, inv.id),
                    done: 'Invitación cancelada',
                  })
                }
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ),
    },
  ];

  return (
    <Stack spacing={4}>
      {/* ---------- Miembros ---------- */}
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="h6" component="h2">
              Usuarios
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Personas con acceso a esta empresa. Entran por invitación.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <TableSearch placeholder="Buscar por nombre o email…" />
            <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setInviting(true)} sx={{ flexShrink: 0 }}>
              Invitar usuario
            </Button>
          </Stack>
        </Stack>
        <DataTable
          columns={memberColumns}
          data={members}
          getRowId={(m) => m.tenantUserId}
          searchQuery={membersSearch}
          aria-label="Usuarios"
        />
      </Stack>

      {/* ---------- Invitaciones pendientes ---------- */}
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="h6" component="h2">
            Invitaciones pendientes
          </Typography>
          <TableSearch placeholder="Buscar por email…" paramPrefix={INVITATIONS_PREFIX} />
        </Stack>
        <DataTable
          columns={invitationColumns}
          data={invitations}
          getRowId={(inv) => inv.id}
          paramPrefix={INVITATIONS_PREFIX}
          searchQuery={invitationsSearch}
          emptyMessage="No hay invitaciones pendientes."
          aria-label="Invitaciones pendientes"
        />
      </Stack>

      {inviting && (
        <InviteDialog
          tenant={tenant}
          roles={grantableRoles}
          shops={shops}
          onClose={() => setInviting(false)}
          onInvited={(invitation) => {
            setInviting(false);
            setLink(invitation);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <EditMemberDialog
          tenant={tenant}
          member={editing}
          roles={grantableRoles}
          shops={shops}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh('Cambios guardados');
          }}
        />
      )}
      {link && <InviteLinkDialog invitation={link} onClose={() => setLink(null)} />}

      <ConfirmDialog
        item={confirm}
        title={(c) => c.title}
        description={(c) => c.text}
        confirmLabel="Confirmar"
        busy={busy}
        error={confirmError}
        onConfirm={runConfirm}
        onCancel={() => {
          setConfirm(null);
          setConfirmError(null);
        }}
      />
    </Stack>
  );
}
