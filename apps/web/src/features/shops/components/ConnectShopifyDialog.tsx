'use client';

import { type ConnectShopifyData, connectShopifySchema, type ShopResponse } from '@erp/contracts';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import type { z } from 'zod';
import { useZodForm } from '@/hooks/useZodForm';
import { connectShopify } from '../api/shops.api';

type Values = { myshopifyDomain: string; clientId: string; clientSecret: string };

type Props = {
  tenant: string;
  /** Tienda a reconectar (dominio fijo); sin ella se conecta una tienda nueva. */
  shop?: ShopResponse;
  onClose: () => void;
  onConnected: (shop: ShopResponse) => void;
};

/** Conecta una tienda de Shopify (la crea en el ERP con sus datos) usando la app creada en el Dev Dashboard. */
export default function ConnectShopifyDialog({ tenant, shop, onClose, onConnected }: Props) {
  const [showSecret, setShowSecret] = useState(false);
  const { values, setField, fieldErrors, formError, submitting, handleSubmit } = useZodForm(
    connectShopifySchema as unknown as z.ZodType<ConnectShopifyData, Values>,
    { myshopifyDomain: shop?.myshopifyDomain ?? '', clientId: '', clientSecret: '' },
    async (input) => onConnected(await connectShopify(tenant, input)),
  );

  return (
    <Dialog open onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate autoComplete="off">
        <DialogTitle>{shop ? `Volver a conectar “${shop.name}”` : 'Conectar tienda de Shopify'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Alert severity="info" variant="outlined">
              <Typography variant="body2">
                Usa la app que creaste en el <strong>Dev Dashboard</strong> de Shopify e instalaste en la tienda. Al conectar, la tienda se crea aquí con su nombre, moneda, país y zona horaria de Shopify. El ID y el
                secreto están en <strong>Configuración</strong> de la app. El secreto se guarda cifrado y nunca se vuelve a
                mostrar.
              </Typography>
            </Alert>
            {formError && <Alert severity="error">{formError}</Alert>}

            <TextField
              label="Dominio de la tienda"
              placeholder="mi-tienda.myshopify.com"
              autoFocus={!shop}
              value={values.myshopifyDomain}
              onChange={setField('myshopifyDomain')}
              error={!!fieldErrors.myshopifyDomain}
              helperText={fieldErrors.myshopifyDomain ?? (shop ? 'Se reconecta la misma tienda' : 'El dominio .myshopify.com (también puedes pegar la URL del admin)')}
              fullWidth
              slotProps={{ htmlInput: { readOnly: !!shop } }}
            />
            <TextField
              label="ID de cliente (Client ID)"
              autoFocus={!!shop}
              value={values.clientId}
              onChange={setField('clientId')}
              error={!!fieldErrors.clientId}
              helperText={fieldErrors.clientId}
              fullWidth
              slotProps={{ htmlInput: { spellCheck: false } }}
            />
            <TextField
              label="Secreto de cliente (Client secret)"
              type={showSecret ? 'text' : 'password'}
              value={values.clientSecret}
              onChange={setField('clientSecret')}
              error={!!fieldErrors.clientSecret}
              helperText={fieldErrors.clientSecret}
              fullWidth
              slotProps={{
                htmlInput: { autoComplete: 'new-password', spellCheck: false },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowSecret((v) => !v)}
                        aria-label={showSecret ? 'Ocultar secreto' : 'Mostrar secreto'}
                        edge="end"
                      >
                        {showSecret ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={submitting} color="inherit">
            Cancelar
          </Button>
          <Button type="submit" variant="contained" loading={submitting}>
            Conectar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
