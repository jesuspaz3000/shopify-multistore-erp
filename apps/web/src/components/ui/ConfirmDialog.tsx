'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useState } from 'react';

type Props<T> = {
  /** Elemento a confirmar; null = cerrado. */
  item: T | null;
  title: (item: T) => string;
  description: (item: T) => React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: (item: T) => void;
  onCancel: () => void;
};

/**
 * Diálogo de confirmación. Conserva el último `item` mientras se anima el cierre: si el contenido
 * se vaciara al cerrar, el diálogo se encogería durante la animación de salida.
 */
export default function ConfirmDialog<T>({
  item,
  title,
  description,
  confirmLabel = 'Eliminar',
  busy = false,
  error,
  onConfirm,
  onCancel,
}: Props<T>) {
  // Último item mostrado (patrón de React para "recordar" un valor de renders anteriores).
  const [shown, setShown] = useState<T | null>(item);
  if (item !== null && item !== shown) setShown(item);

  return (
    <Dialog
      open={item !== null}
      onClose={busy ? undefined : onCancel}
      fullWidth
      maxWidth="xs"
      slotProps={{ transition: { onExited: () => setShown(null) } }}
    >
      {shown !== null && (
        <>
          <DialogTitle>{title(shown)}</DialogTitle>
          <DialogContent>
            <DialogContentText component="div">{description(shown)}</DialogContentText>
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onCancel} disabled={busy} color="inherit">
              Cancelar
            </Button>
            <Button onClick={() => onConfirm(shown)} color="error" variant="contained" loading={busy}>
              {confirmLabel}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
