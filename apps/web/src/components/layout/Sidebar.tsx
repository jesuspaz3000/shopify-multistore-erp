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
import Collapse from '@mui/material/Collapse';
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

/**
 * Enlace activo = el de prefijo más largo que coincide con la URL. Así /products/12 marca "Productos"
 * pero /products/collections marca su submódulo "Colecciones".
 */
function activeHref(pathname: string, hrefs: string[], overview: string): string | undefined {
  return hrefs
    .filter((href) => (href === overview ? pathname === overview : pathname === href || pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];
}

export default function Sidebar({ tenant, shop, onNavigate }: { tenant: string; shop: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const overview = `/${tenant}/${shop}`;
  const allHrefs = NAVIGATION.flatMap((s) => s.items.flatMap((i) => [navHref(i, tenant, shop), ...(i.children ?? []).map((c) => navHref(c, tenant, shop))]));
  const active = activeHref(pathname, allHrefs, overview);

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
            const children = (item.children ?? []).map((c) => ({ ...c, href: navHref(c, tenant, shop) }));
            // Los submódulos se despliegan mientras se está en el módulo o en alguno de ellos.
            const open = active === href || children.some((c) => c.href === active);
            const Icon = ICONS[item.icon];
            return (
              <li key={item.label} style={{ listStyle: 'none' }}>
                <ListItemButton
                  component={Link}
                  href={href}
                  selected={active === href}
                  onClick={onNavigate}
                  aria-expanded={children.length > 0 ? open : undefined}
                  sx={{ borderRadius: 1.5, mb: 0.25 }}
                >
                  <ListItemIcon>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
                {children.length > 0 && (
                  <Collapse in={open} timeout="auto" unmountOnExit>
                    <List dense disablePadding aria-label={`Submódulos de ${item.label}`}>
                      {children.map((child) => (
                        <ListItemButton
                          key={child.label}
                          component={Link}
                          href={child.href}
                          selected={active === child.href}
                          onClick={onNavigate}
                          sx={{ borderRadius: 1.5, mb: 0.25, pl: 7, py: 0.5 }}
                        >
                          <ListItemText primary={child.label} slotProps={{ primary: { variant: 'body2' } }} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                )}
              </li>
            );
          })}
        </List>
      ))}
    </nav>
  );
}
