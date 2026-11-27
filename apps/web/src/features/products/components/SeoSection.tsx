'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

type Props = {
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  handle: string;
  /** URL actual guardada (al editar). */
  savedHandle?: string;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (patch: { seoTitle?: string; seoDescription?: string; handle?: string }) => void;
};

/** "Tienda Ñandú" -> "tienda-nandu" (vista previa; la API genera la URL definitiva). */
const slugPreview = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Ficha en buscadores: vista previa como en Google y, al editar, título/descripción/URL. */
export default function SeoSection(props: Props) {
  const { title, description, seoTitle, seoDescription, handle, savedHandle, errors, disabled, onChange } = props;
  const [open, setOpen] = useState(Object.keys(errors).some((k) => k.startsWith('seo') || k === 'handle'));
  const shownTitle = seoTitle || title;
  // La descripción es HTML del editor: en la vista previa va como texto plano.
  const plain = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const shownDescription = seoDescription || plain.slice(0, 160);
  const shownHandle = handle || savedHandle || slugPreview(title);
  const anyError = !!(errors.seoTitle || errors.seoDescription || errors.handle);

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
          Ficha en buscadores
        </Typography>
        {!disabled && !(open || anyError) && (
          <Button size="small" onClick={() => setOpen(true)}>
            Editar
          </Button>
        )}
      </Stack>
      {shownTitle ? (
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            …/products/{shownHandle || '…'}
          </Typography>
          <Typography variant="body1" sx={{ color: 'primary.main' }}>
            {shownTitle}
          </Typography>
          {shownDescription && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {shownDescription}
            </Typography>
          )}
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Agrega un título y una descripción para ver cómo aparecerá el producto en los buscadores.
        </Typography>
      )}
      {(open || anyError) && (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField
            label="Título de la página"
            value={seoTitle}
            placeholder={title}
            onChange={(e) => onChange({ seoTitle: e.target.value })}
            error={!!errors.seoTitle}
            helperText={errors.seoTitle ?? `${seoTitle.length} de 70 caracteres`}
            disabled={disabled}
            fullWidth
          />
          <TextField
            label="Meta descripción"
            value={seoDescription}
            onChange={(e) => onChange({ seoDescription: e.target.value })}
            error={!!errors.seoDescription}
            helperText={errors.seoDescription ?? `${seoDescription.length} de 160 caracteres`}
            disabled={disabled}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            label="URL del producto"
            value={handle}
            placeholder={savedHandle || slugPreview(title)}
            onChange={(e) => onChange({ handle: e.target.value })}
            error={!!errors.handle}
            helperText={errors.handle ?? (savedHandle ? 'Cambiarla rompe los enlaces que ya se compartieron' : 'Vacío = se genera desde el título')}
            disabled={disabled}
            fullWidth
            slotProps={{ input: { startAdornment: <InputAdornment position="start">…/products/</InputAdornment> } }}
          />
        </Stack>
      )}
    </Box>
  );
}
