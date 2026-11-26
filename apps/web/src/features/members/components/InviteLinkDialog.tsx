'use client';

import type { CreatedInvitationResponse } from '@erp/contracts';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

/**
 * Muestra el link de invitación UNA sola vez (la API solo guarda su hash).
 * Mientras no haya servicio de correo, se copia y se envía manualmente.
 */
export default function InviteLinkDialog({ invitation, onClose }: { invitation: CreatedInvitationResponse; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(invitation.inviteUrl);
    setCopied(true);
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Link de invitación</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2">
            Envía este link a <strong>{invitation.email}</strong>. Vence el{' '}
            {new Date(invitation.expiresAt).toLocaleDateString('es', { dateStyle: 'long' })} y sirve una sola vez.
          </Typography>
          <TextField value={invitation.inviteUrl} fullWidth slotProps={{ input: { readOnly: true } }} onFocus={(e) => e.target.select()} />
          <Alert severity="warning" variant="outlined">
            Por seguridad el link no se vuelve a mostrar. Si lo pierdes, usa «Generar nuevo link» en la invitación.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cerrar
        </Button>
        <Button variant="contained" startIcon={<ContentCopyIcon />} onClick={copy}>
          {copied ? 'Copiado' : 'Copiar link'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
