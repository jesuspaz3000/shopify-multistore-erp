'use client';

import type { TenantMembership } from '@erp/contracts';
import BusinessIcon from '@mui/icons-material/Business';
import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Link from '@/components/ui/Link';
import { roleLabel } from '../role-labels';

export default function TenantList({ memberships }: { memberships: TenantMembership[] }) {
  return (
    <List disablePadding sx={{ display: 'grid', gap: 1 }}>
      {memberships.map((m) => (
        <ListItemButton
          key={m.tenantId}
          component={Link}
          href={`/${m.slug}/all`}
          sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}
        >
          <ListItemAvatar>
            <Avatar>
              <BusinessIcon />
            </Avatar>
          </ListItemAvatar>
          <ListItemText primary={m.companyName} secondary={roleLabel(m.role)} />
        </ListItemButton>
      ))}
    </List>
  );
}
