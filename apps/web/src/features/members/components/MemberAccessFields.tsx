'use client';

import type { RoleOptionResponse, ShopOptionResponse } from '@erp/contracts';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import { roleLabel } from '@/features/tenant/role-labels';

export type MemberAccess = { roleName: string; allShopsAccess: boolean; shopIds: number[] };

type Props = {
  value: MemberAccess;
  onChange: (value: MemberAccess) => void;
  /** Solo los roles que el usuario actual puede otorgar. */
  roles: RoleOptionResponse[];
  shops: ShopOptionResponse[];
  errors: Record<string, string>;
};

/** Rol + acceso a tiendas (todas o solo algunas). Lo usan "Invitar" y "Editar miembro". */
export default function MemberAccessFields({ value, onChange, roles, shops, errors }: Props) {
  const toggleShop = (shopId: number) =>
    onChange({
      ...value,
      shopIds: value.shopIds.includes(shopId) ? value.shopIds.filter((id) => id !== shopId) : [...value.shopIds, shopId],
    });

  return (
    <>
      <TextField
        select
        label="Rol"
        value={value.roleName}
        onChange={(e) => onChange({ ...value, roleName: e.target.value })}
        error={!!errors.roleName}
        helperText={errors.roleName ?? roles.find((r) => r.name === value.roleName)?.description}
        fullWidth
      >
        {roles.map((r) => (
          <MenuItem key={r.name} value={r.name}>
            {roleLabel(r.name)}
          </MenuItem>
        ))}
      </TextField>

      <FormControl error={!!errors.shopIds}>
        <FormLabel>Acceso a tiendas</FormLabel>
        <RadioGroup
          value={value.allShopsAccess ? 'all' : 'some'}
          onChange={(e) => onChange({ ...value, allShopsAccess: e.target.value === 'all' })}
        >
          <FormControlLabel value="all" control={<Radio />} label="Todas las tiendas (incluidas las que se agreguen después)" />
          <FormControlLabel value="some" control={<Radio />} label="Solo algunas tiendas" disabled={shops.length === 0} />
        </RadioGroup>
        {!value.allShopsAccess && (
          <FormGroup sx={{ pl: 4 }}>
            {shops.map((s) => (
              <FormControlLabel
                key={s.id}
                control={<Checkbox checked={value.shopIds.includes(s.id)} onChange={() => toggleShop(s.id)} />}
                label={s.name}
              />
            ))}
          </FormGroup>
        )}
        {errors.shopIds && <FormHelperText>{errors.shopIds}</FormHelperText>}
      </FormControl>
    </>
  );
}
