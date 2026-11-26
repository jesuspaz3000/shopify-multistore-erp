'use client';

import type { SessionUser } from '@erp/contracts';
import LogoutIcon from '@mui/icons-material/Logout';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { hardLogout } from '../hard-logout';

export default function UserMenu({ user, companyName, canSwitchTenant }: { user: SessionUser; companyName: string; canSwitchTenant: boolean }) {
  const router = useRouter();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  const handleLogout = async () => {
    setAnchor(null);
    await hardLogout();
  };

  return (
    <>
      <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Cuenta de usuario" sx={{ p: 0.5 }}>
        <Avatar sx={{ width: 34, height: 34, fontSize: 14, bgcolor: 'primary.main' }}>{initials}</Avatar>
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 240, mt: 1 } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">
            {user.firstName} {user.lastName}
          </Typography>
          {user.isSuperuser && <Chip label="Superadmin" size="small" color="secondary" sx={{ my: 0.5 }} />}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {user.email}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {companyName}
          </Typography>
        </Box>
        <Divider />
        {canSwitchTenant && (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              router.push('/select-tenant');
            }}
          >
            <ListItemIcon>
              <SwapHorizIcon fontSize="small" />
            </ListItemIcon>
            Cambiar de empresa
          </MenuItem>
        )}
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Cerrar sesión
        </MenuItem>
      </Menu>
    </>
  );
}
