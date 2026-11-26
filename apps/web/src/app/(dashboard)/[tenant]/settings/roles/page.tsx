import Skeleton from '@mui/material/Skeleton';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getRolesPage } from '@/features/members/api/members.server';
import RolesManager from '@/features/members/components/RolesManager';
import { can } from '@/features/tenant/permissions';
import { getMe } from '@/lib/session';
import { readTableQuery } from '@/lib/table-query';

export const metadata: Metadata = { title: 'Roles y permisos' };

type Props = PageProps<'/[tenant]/settings/roles'>;

export default function SettingsRolesPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton variant="rounded" height={320} />}>
      <RolesSection params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function RolesSection({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  const [{ tenant }, search] = await Promise.all([params, searchParams]);
  const query = readTableQuery(search);
  const [me, page] = await Promise.all([getMe(), getRolesPage(tenant, query)]);
  const membership = me?.memberships.find((m) => m.slug === tenant);
  if (!membership) notFound();

  return (
    <RolesManager
      tenant={tenant}
      page={page}
      searchQuery={query.q}
      myPermissions={membership.permissions}
      canManage={can(membership, 'users:manage')}
    />
  );
}
