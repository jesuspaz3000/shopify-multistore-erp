import { AppShellSkeleton } from '@/components/skeletons';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import AppShell from '@/components/layout/AppShell';
import { getShopOptions } from '@/features/shops/api/shops.server';
import { getMe } from '@/lib/session';

// Valida que el usuario pertenezca al tenant de la URL y monta la estructura del dashboard.
// La sesión y `params` se leen dentro de <Suspense> (no con await en el layout), así la
// navegación muestra el indicador de carga al instante en vez de quedar bloqueada.
export default function TenantLayout({ children, params }: LayoutProps<'/[tenant]'>) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <TenantShell params={params}>{children}</TenantShell>
    </Suspense>
  );
}

async function TenantShell({ params, children }: { params: LayoutProps<'/[tenant]'>['params']; children: React.ReactNode }) {
  const { tenant } = await params;
  const me = await getMe();
  if (!me) redirect('/login');

  const membership = me.memberships.find((m) => m.slug === tenant);
  // 404 (y no 403) para no revelar qué empresas existen.
  if (!membership) notFound();

  const shops = await getShopOptions(tenant);

  return (
    <AppShell me={me} membership={membership} shops={shops.map((s) => ({ handle: s.handle, name: s.name }))}>
      {children}
    </AppShell>
  );
}
