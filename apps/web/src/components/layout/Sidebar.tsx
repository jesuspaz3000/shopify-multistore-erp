'use client';

import BarChartIcon from '@mui/icons-material/BarChart';
import CampaignIcon from '@mui/icons-material/Campaign';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InventoryIcon from '@mui/icons-material/Inventory2';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SellIcon from '@mui/icons-material/Sell';
import SettingsIcon from '@mui/icons-material/Settings';
import SyncIcon from '@mui/icons-material/Sync';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import { usePathname } from 'next/navigation';
import Link from '@/components/ui/Link';
import { NAVIGATION, navHref, type NavIcon } from '@/config/navigation';

const ICONS: Record<NavIcon, React.ElementType> = {
  dashboard: DashboardIcon,
  products: SellIcon,
  inventory: InventoryIcon,
  orders: ReceiptLongIcon,
  customers: PeopleIcon,
  fulfillment: LocalShippingIcon,
  marketing: CampaignIcon,
  reports: BarChartIcon,
  sync: SyncIcon,
  settings: SettingsIcon,
};

export default function Sidebar({ tenant, shop, onNavigate }: { tenant: string; shop: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const overview = `/${tenant}/${shop}`;

  return (
    <nav aria-label="Navegación principal">
      {NAVIGATION.map((section, index) => (
        <List
          key={section.title ?? index}
          dense
          subheader={section.title ? <ListSubheader sx={{ bgcolor: 'transparent', lineHeight: 2.5 }}>{section.title}</ListSubheader> : undefined}
          sx={{ px: 1 }}
        >
          {section.items.map((item) => {
            const href = navHref(item, tenant, shop);
            const selected = href === overview ? pathname === overview : pathname.startsWith(href);
            const Icon = ICONS[item.icon];
            return (
              <ListItemButton
                key={item.label}
                component={Link}
                href={href}
                selected={selected}
                onClick={onNavigate}
                sx={{ borderRadius: 1.5, mb: 0.25 }}
              >
                <ListItemIcon>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            );
          })}
        </List>
      ))}
    </nav>
  );
}
