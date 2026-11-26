'use client';

import type { MeResponse, TenantMembership } from '@erp/contracts';
import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useParams } from 'next/navigation';
import ColorModeToggle from '@/components/ui/ColorModeToggle';
import UserMenu from '@/features/auth/components/UserMenu';
import ShopSwitcher, { ALL_SHOPS } from '@/features/shop-switcher/components/ShopSwitcher';
import { useUiStore } from '@/stores/UiStoreProvider';
import Sidebar from './Sidebar';

const DRAWER_WIDTH = 248;

type AppShellProps = {
  me: MeResponse;
  membership: TenantMembership;
  children: React.ReactNode;
};

/** Estructura del dashboard: menú lateral + barra superior + contenido. */
export default function AppShell({ me, membership, children }: AppShellProps) {
  const params = useParams<{ shop?: string }>();
  const shop = params.shop ?? ALL_SHOPS;
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const toggleMobileNav = useUiStore((s) => s.toggleMobileNav);

  const drawerContent = (
    <>
      <Toolbar sx={{ px: 2.5 }}>
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
          {membership.companyName}
        </Typography>
      </Toolbar>
      <Sidebar tenant={membership.slug} shop={shop} onNavigate={() => setMobileNavOpen(false)} />
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, ml: { md: `${DRAWER_WIDTH}px` }, borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          <IconButton edge="start" onClick={toggleMobileNav} aria-label="Abrir menú" sx={{ display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <ShopSwitcher tenant={membership.slug} shop={shop} shops={[]} />
          <Box sx={{ flexGrow: 1 }} />
          <ColorModeToggle />
          <UserMenu user={me.user} companyName={membership.companyName} canSwitchTenant={me.memberships.length > 1} />
        </Toolbar>
      </AppBar>

      <Box component="aside" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {/* Móvil: menú temporal */}
        <Drawer
          variant="temporary"
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {drawerContent}
        </Drawer>
        {/* Escritorio: menú fijo */}
        <Drawer
          variant="permanent"
          open
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, bgcolor: 'background.default' }}>
        <Toolbar />
        <Box sx={{ p: { xs: 2, sm: 3 } }}>{children}</Box>
      </Box>
    </Box>
  );
}
