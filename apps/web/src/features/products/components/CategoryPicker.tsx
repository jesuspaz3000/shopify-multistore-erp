'use client';

import type { TaxonomyCategoryResponse } from '@erp/contracts';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/http';
import { listCategories } from '../api/taxonomy.api';

type Props = {
  tenant: string;
  value: TaxonomyCategoryResponse | null;
  onChange: (category: TaxonomyCategoryResponse | null) => void;
  disabled?: boolean;
  error?: string;
};

const HELP = 'Determina las tasas de impuestos y agrega metacampos para mejorar la búsqueda, los filtros y las ventas multicanal';

/**
 * Categoría del producto (taxonomía estándar de Shopify), como en el admin de Shopify: se busca por
 * nombre o se navega por niveles (Equipamiento deportivo > ... > Tablas de snowboard).
 */
export default function CategoryPicker({ tenant, value, onChange, disabled, error }: Props) {
  // Campo al que se ancla el panel (null = cerrado).
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = !!anchor;
  const [query, setQuery] = useState('');
  // Ruta de navegación: categorías abiertas (vacía = raíces).
  const [path, setPath] = useState<TaxonomyCategoryResponse[]>([]);
  const [items, setItems] = useState<TaxonomyCategoryResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const parent = path.at(-1);
  const searching = query.trim().length >= 2;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Al escribir se espera un poco antes de buscar (no una consulta por tecla).
    const timer = setTimeout(
      () => {
        setLoading(true);
        setLoadError(null);
        listCategories(tenant, searching ? { q: query.trim() } : { parentId: parent?.id })
          .then((list) => !cancelled && setItems(list))
          .catch((e) => !cancelled && setLoadError(e instanceof ApiError ? e.message : 'No se pudieron cargar las categorías'))
          .finally(() => !cancelled && setLoading(false));
      },
      searching ? 250 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, tenant, query, searching, parent]);

  const close = () => {
    setAnchor(null);
    setQuery('');
  };
  const choose = (category: TaxonomyCategoryResponse) => {
    onChange(category);
    close();
  };
  const openPicker = (target: HTMLElement) => {
    setPath([]);
    setAnchor(target);
  };

  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 500, mb: 1, color: error ? 'error.main' : undefined }}>
        Categoría
      </Typography>
      <Box sx={{ position: 'relative' }}>
        <ButtonBase
          onClick={(e) => openPicker(e.currentTarget)}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-label={value ? `Categoría: ${value.fullName}` : 'Elige una categoría de producto'}
          sx={{
            width: '100%',
            justifyContent: 'space-between',
            textAlign: 'left',
            gap: 1,
            px: 1.75,
            py: 1,
            minHeight: 40,
            border: 1,
            borderColor: error ? 'error.main' : 'divider',
            borderRadius: 1,
            '&:hover': { borderColor: disabled ? 'divider' : 'text.primary' },
            '&:focus-visible': { outline: 2, outlineColor: 'primary.main' },
          }}
        >
          <Box sx={{ minWidth: 0, pr: value ? 4 : 0 }}>
            {value ? (
              <>
                <Typography variant="body2" noWrap>
                  {value.name}
                </Typography>
                <Typography variant="caption" noWrap component="div" sx={{ color: 'text.secondary' }}>
                  {value.fullName}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Elige una categoría de producto
              </Typography>
            )}
          </Box>
          <UnfoldMoreIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
        </ButtonBase>
        {value && !disabled && (
          <Tooltip title="Quitar categoría">
            <IconButton
              size="small"
              onClick={() => onChange(null)}
              aria-label="Quitar categoría"
              sx={{ position: 'absolute', right: 32, top: '50%', transform: 'translateY(-50%)' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Typography variant="caption" sx={{ color: error ? 'error.main' : 'text.secondary', display: 'block', mt: 0.75 }}>
        {error ?? HELP}
      </Typography>

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: anchor?.offsetWidth ?? 480, maxWidth: 'calc(100vw - 32px)', mt: 0.5 } } }}
      >
        <Box sx={{ p: 1.5 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="Buscar categorías (ej. tablas de snowboard)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            slotProps={{
              htmlInput: { 'aria-label': 'Buscar categorías' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: loading ? (
                  <InputAdornment position="end">
                    <CircularProgress size={16} />
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
        </Box>
        <Divider />

        {!searching && parent && (
          <>
            <ListItemButton onClick={() => setPath(path.slice(0, -1))} dense>
              <ArrowBackIcon fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
              <ListItemText primary={parent.name} slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
            </ListItemButton>
            <ListItemButton onClick={() => choose(parent)} dense sx={{ pl: 6 }}>
              <ListItemText primary={`Usar “${parent.name}”`} slotProps={{ primary: { sx: { color: 'primary.main' } } }} />
            </ListItemButton>
            <Divider />
          </>
        )}

        <List dense disablePadding sx={{ maxHeight: 360, overflowY: 'auto' }} aria-label="Categorías">
          {loadError && (
            <Typography variant="body2" sx={{ color: 'error.main', p: 2 }}>
              {loadError}
            </Typography>
          )}
          {!loadError && !loading && items.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
              {searching ? 'No hay categorías con ese nombre. Prueba con otra palabra (ej. “camisetas” en vez de “poleras”).' : 'Sin subcategorías'}
            </Typography>
          )}
          {items.map((category) => {
            const selected = category.id === value?.id;
            // Buscando: se elige directo. Navegando: una categoría con hijas se abre (se puede "Usar" adentro).
            const drill = !searching && !category.isLeaf;
            return (
              <ListItemButton
                key={category.id}
                selected={selected}
                onClick={() => (drill ? setPath([...path, category]) : choose(category))}
                aria-label={drill ? `Abrir ${category.name}` : `Elegir ${category.fullName}`}
              >
                <ListItemText
                  primary={category.name}
                  secondary={searching ? category.fullName : undefined}
                  slotProps={{ secondary: { noWrap: true } }}
                />
                {drill && <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
              </ListItemButton>
            );
          })}
        </List>
      </Popover>
    </Box>
  );
}
