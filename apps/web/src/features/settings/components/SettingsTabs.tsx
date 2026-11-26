'use client';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useParams, usePathname } from 'next/navigation';
import Link from '@/components/ui/Link';

const TABS = [
  { label: 'Tiendas', segment: 'shops' },
  { label: 'Bodegas', segment: 'locations' },
  { label: 'Usuarios', segment: 'users' },
  { label: 'Roles y permisos', segment: 'roles' },
];

export default function SettingsTabs() {
  const { tenant } = useParams<{ tenant: string }>();
  const pathname = usePathname();
  const current = TABS.find((t) => pathname.startsWith(`/${tenant}/settings/${t.segment}`))?.segment ?? false;

  return (
    <Tabs value={current} variant="scrollable" sx={{ borderBottom: 1, borderColor: 'divider' }}>
      {TABS.map((t) => (
        <Tab key={t.segment} value={t.segment} label={t.label} component={Link} href={`/${tenant}/settings/${t.segment}`} />
      ))}
    </Tabs>
  );
}
