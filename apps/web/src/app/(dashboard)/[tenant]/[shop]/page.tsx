import Skeleton from '@mui/material/Skeleton';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import OverviewPanel from '@/features/dashboard/components/OverviewPanel';
import { getMe } from '@/lib/session';

export const metadata: Metadata = { title: 'Resumen' };

// La sesión se lee dentro de <Suspense>: la página aparece al instante con un placeholder.
export default function OverviewPage() {
  return (
    <Suspense fallback={<Skeleton variant="rounded" height={160} />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const me = await getMe();
  if (!me) redirect('/login');
  return <OverviewPanel firstName={me.user.firstName} />;
}
