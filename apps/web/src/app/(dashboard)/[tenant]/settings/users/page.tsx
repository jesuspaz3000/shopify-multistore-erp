import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getInvitationsPage, getMembersPage, getRoleOptions } from '@/features/members/api/members.server';
import UsersManager from '@/features/members/components/UsersManager';
import { INVITATIONS_PREFIX } from '@/features/members/table-params';
import { getShopOptions } from '@/features/shops/api/shops.server';
import { can } from '@/features/tenant/permissions';
import { getMe } from '@/lib/session';
import { readTableQuery } from '@/lib/table-query';

export const metadata: Metadata = { title: 'Usuarios' };

type Props = PageProps<'/[tenant]/settings/users'>;

export default function SettingsUsersPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton variant="rounded" height={260} />}>
      <UsersSection params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function UsersSection({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  const [{ tenant }, search] = await Promise.all([params, searchParams]);
  const me = await getMe();
  const membership = me?.memberships.find((m) => m.slug === tenant);
  if (!membership) notFound();

  if (!can(membership, 'users:manage')) {
    return <Alert severity="info">Tu rol no permite administrar usuarios. Pídeselo a un administrador de la empresa.</Alert>;
  }

  // Dos tablas en la misma página: miembros (?page, ?q) e invitaciones (?invPage, ?invQ).
  const membersQuery = readTableQuery(search);
  const invitationsQuery = readTableQuery(search, INVITATIONS_PREFIX);
  const [members, invitations, roles, shops] = await Promise.all([
    getMembersPage(tenant, membersQuery),
    getInvitationsPage(tenant, invitationsQuery),
    getRoleOptions(tenant),
    getShopOptions(tenant),
  ]);

  return (
    <UsersManager
      tenant={tenant}
      myPermissions={membership.permissions}
      members={members}
      membersSearch={membersQuery.q}
      invitations={invitations}
      invitationsSearch={invitationsQuery.q}
      roles={roles}
      shops={shops}
    />
  );
}
