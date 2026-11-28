'use client';

import { MEDIA_ACCEPTED_TYPES, MEDIA_MAX_BYTES } from '@erp/contracts';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useRef, useState } from 'react';
import { ApiError } from '@/lib/http';
import { mediaSrc, uploadMedia } from '../api/media.api';
import { useDragReorder } from '../variants/useDragReorder';
import MediaViewerDialog from './MediaViewerDialog';

export type MediaItem = { id: number; url: string; alt: string | null };

type Props = {
  tenant: string;
  media: MediaItem[];
  onChange: (media: MediaItem[]) => void;
  /** Agrega una imagen recién subida (sin repetir): varias subidas en paralelo no se pisan. */
  onAdd: (item: MediaItem) => void;
  disabled?: boolean;
};

type Upload = { key: string; name: string };

const ACCEPT = MEDIA_ACCEPTED_TYPES.join(',');
let uploadCounter = 0;

/**
 * Multimedia del producto, como en Shopify: subir/arrastrar, la primera es la principal, reordenar y
 * quitar. Al hacer clic en una imagen se abre el visor con su información (nombre, alt, detalles, uso).
 */
export default function MediaSection({ tenant, media, onChange, onAdd, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dropping, setDropping] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const { itemProps } = useDragReorder(media, onChange);

  const upload = async (files: File[]) => {
    setErrors([]);
    const problems: string[] = [];
    const valid = files.filter((file) => {
      if (!(MEDIA_ACCEPTED_TYPES as readonly string[]).includes(file.type)) problems.push(`${file.name}: formato no admitido (JPG, PNG, GIF o WebP)`);
      else if (file.size > MEDIA_MAX_BYTES) problems.push(`${file.name}: supera los 20 MB`);
      else return true;
      return false;
    });
    const pending = valid.map((file) => ({ key: `up-${++uploadCounter}`, name: file.name, file }));
    setUploads((prev) => [...prev, ...pending.map(({ key, name }) => ({ key, name }))]);

    await Promise.all(
      pending.map(async ({ key, name, file }) => {
        try {
          const saved = await uploadMedia(tenant, file);
          // Mismo archivo dos veces: el servidor devuelve la misma imagen y onAdd no la repite.
          onAdd({ id: saved.id, url: saved.url, alt: saved.alt });
        } catch (error) {
          problems.push(`${name}: ${error instanceof ApiError ? error.message : 'no se pudo subir'}`);
        } finally {
          setUploads((prev) => prev.filter((u) => u.key !== key));
        }
      }),
    );
    setErrors(problems);
  };

  const pick = () => input.current?.click();
  const onDrop = (event: React.DragEvent) => {
    // Solo archivos del sistema (al reordenar se arrastran las miniaturas, sin archivos).
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    setDropping(false);
    if (!disabled) void upload([...event.dataTransfer.files]);
  };
  const dropZone = {
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        setDropping(true);
      }
    },
    onDragLeave: () => setDropping(false),
    onDrop,
  };

  const empty = media.length === 0 && uploads.length === 0;

  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
        Multimedia
      </Typography>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          void upload([...(e.target.files ?? [])]);
          e.target.value = ''; // permite volver a elegir el mismo archivo
        }}
      />

      {empty ? (
        <Box
          {...dropZone}
          sx={{
            border: 2,
            borderStyle: 'dashed',
            borderColor: dropping ? 'primary.main' : 'divider',
            bgcolor: dropping ? 'action.hover' : undefined,
            borderRadius: 2,
            py: 4,
            textAlign: 'center',
          }}
        >
          <Button variant="outlined" size="small" onClick={pick} disabled={disabled}>
            Subir nuevo
          </Button>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            o arrastra imágenes aquí · JPG, PNG, GIF o WebP hasta 20 MB
          </Typography>
        </Box>
      ) : (
        <Box
          {...dropZone}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
            gap: 1,
            p: dropping ? 1 : 0,
            outline: dropping ? 2 : 0,
            outlineStyle: 'dashed',
            outlineColor: 'primary.main',
            borderRadius: 2,
          }}
        >
          {media.map((item, index) => (
            <Box
              key={item.id}
              {...(disabled ? {} : itemProps(index))}
              sx={{
                position: 'relative',
                // La primera es la principal: ocupa 2x2 (como en Shopify).
                gridColumn: index === 0 ? 'span 2' : undefined,
                gridRow: index === 0 ? 'span 2' : undefined,
                aspectRatio: '1',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1.5,
                overflow: 'hidden',
                bgcolor: 'background.paper',
                cursor: disabled ? 'default' : 'grab',
                '&[data-dragging]': { opacity: 0.4 },
                '&:hover .media-actions': { opacity: 1 },
              }}
            >
              <Box
                component="img"
                src={mediaSrc(item.url)}
                alt={item.alt ?? ''}
                draggable={false}
                role="button"
                tabIndex={0}
                aria-label={`Ver imagen ${index + 1}`}
                onClick={() => setViewing(index)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setViewing(index);
                  }
                }}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  cursor: 'pointer',
                  '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
                }}
              />
              {!disabled && (
                <Stack direction="row" className="media-actions" sx={{ position: 'absolute', top: 4, right: 4, gap: 0.5, opacity: 0, transition: 'opacity 120ms' }}>
                  <Tooltip title="Quitar del producto">
                    <IconButton
                      size="small"
                      onClick={() => onChange(media.filter((m) => m.id !== item.id))}
                      aria-label={`Quitar imagen ${index + 1}`}
                      sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' }, boxShadow: 1 }}
                    >
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              )}
            </Box>
          ))}
          {uploads.map((u) => (
            <Box
              key={u.key}
              sx={{ aspectRatio: '1', border: 1, borderColor: 'divider', borderRadius: 1.5, display: 'grid', placeItems: 'center' }}
              aria-label={`Subiendo ${u.name}`}
            >
              <CircularProgress size={24} />
            </Box>
          ))}
          {!disabled && (
            <Tooltip title="Agregar imágenes">
              <Box
                component="button"
                type="button"
                onClick={pick}
                aria-label="Agregar imágenes"
                sx={{
                  aspectRatio: '1',
                  border: 2,
                  borderStyle: 'dashed',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  bgcolor: 'transparent',
                  color: 'text.secondary',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                }}
              >
                <AddIcon />
              </Box>
            </Tooltip>
          )}
        </Box>
      )}
      {media.length > 1 && !disabled && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          La primera imagen es la principal. Arrástralas para cambiar el orden.
        </Typography>
      )}
      {errors.length > 0 && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setErrors([])}>
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </Alert>
      )}

      {viewing !== null && media[viewing] && (
        <MediaViewerDialog
          tenant={tenant}
          media={media}
          index={viewing}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
          onAltChange={(id, alt) => onChange(media.map((m) => (m.id === id ? { ...m, alt } : m)))}
          onRemove={(id) => onChange(media.filter((m) => m.id !== id))}
          onMakeMain={(id) => onChange([...media.filter((m) => m.id === id), ...media.filter((m) => m.id !== id)])}
          disabled={disabled}
        />
      )}
    </Box>
  );
}
