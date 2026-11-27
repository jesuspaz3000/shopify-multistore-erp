'use client';

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useDragReorder } from './useDragReorder';
import { newUid, type OptionDraft, type ValueDraft } from './variant-ops';

const NAME_SUGGESTIONS = ['Color', 'Talla', 'Material', 'Tamaño', 'Estilo'];

type EditorProps = {
  option: OptionDraft;
  /** Nombres de las otras opciones (no se pueden repetir). */
  otherNames: string[];
  isNew: boolean;
  onDone: (option: OptionDraft) => void;
  onDelete: () => void;
  onCancel: () => void;
};

/** Opción en edición: nombre + un campo por valor (el último, vacío, sirve para agregar otro). */
export function OptionEditor({ option, otherNames, isNew, onDone, onDelete, onCancel }: EditorProps) {
  const [name, setName] = useState(option.name);
  const [values, setValues] = useState<ValueDraft[]>(option.values);
  const [draft, setDraft] = useState('');
  const [errors, setErrors] = useState<{ name?: string; values?: string; dup?: string }>({});
  const { itemProps } = useDragReorder(values, setValues);

  const duplicated = (list: string[]) =>
    list.map((v) => v.trim().toLowerCase()).filter((v, i, all) => v && all.indexOf(v) !== i);

  const done = () => {
    const finalValues = [...values, ...(draft.trim() ? [{ uid: newUid('val'), name: draft }] : [])]
      .map((v) => ({ ...v, name: v.name.trim() }))
      .filter((v) => v.name);
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Escribe el nombre de la opción';
    else if (otherNames.some((n) => n.toLowerCase() === name.trim().toLowerCase())) next.name = 'Ya hay una opción con ese nombre';
    if (finalValues.length === 0) next.values = 'Agrega al menos un valor';
    const dups = duplicated(finalValues.map((v) => v.name));
    if (dups.length) next.dup = `Valor repetido: ${dups[0]}`;
    setErrors(next);
    if (Object.keys(next).length) return;
    onDone({ ...option, name: name.trim(), values: finalValues });
  };

  return (
    <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
      <Stack spacing={1.5}>
        <Autocomplete
          freeSolo
          options={NAME_SUGGESTIONS.filter((n) => !otherNames.some((o) => o.toLowerCase() === n.toLowerCase()))}
          inputValue={name}
          onInputChange={(_, v) => setName(v)}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="Nombre de la opción"
              placeholder="Talla, color…"
              autoFocus={isNew}
              error={!!errors.name}
              helperText={errors.name}
            />
          )}
        />
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Valores de la opción
        </Typography>
        {values.map((value, index) => (
          <Stack key={value.uid} direction="row" spacing={1} sx={{ alignItems: 'center' }} {...itemProps(index)}>
            <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled', cursor: 'grab' }} aria-hidden />
            <TextField
              size="small"
              value={value.name}
              onChange={(e) => setValues(values.map((v) => (v.uid === value.uid ? { ...v, name: e.target.value } : v)))}
              fullWidth
              slotProps={{ htmlInput: { 'aria-label': `Valor ${index + 1}` } }}
            />
            <IconButton
              size="small"
              onClick={() => setValues(values.filter((v) => v.uid !== value.uid))}
              aria-label={`Borrar valor ${value.name}`}
              disabled={values.length === 1 && !draft.trim()}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
        {/* Campo vacío al final: al escribir se convierte en un valor más (como en Shopify). */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', pl: 3.5, pr: 5 }}>
          <TextField
            size="small"
            value={draft}
            placeholder={values.length === 0 ? 'Ej. Mediano' : 'Agregar otro valor'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (draft.trim()) {
                  setValues([...values, { uid: newUid('val'), name: draft }]);
                  setDraft('');
                }
              }
            }}
            onBlur={() => {
              if (draft.trim()) {
                setValues([...values, { uid: newUid('val'), name: draft }]);
                setDraft('');
              }
            }}
            error={!!errors.values}
            helperText={errors.values ?? errors.dup}
            fullWidth
            slotProps={{ htmlInput: { 'aria-label': 'Agregar otro valor' } }}
          />
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Button color="error" onClick={onDelete}>
            Eliminar
          </Button>
          <Stack direction="row" spacing={1}>
            {!isNew && (
              <Button color="inherit" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button variant="contained" onClick={done}>
              Listo
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}

type SummaryProps = {
  option: OptionDraft;
  onEdit: () => void;
  disabled?: boolean;
  dragProps?: object;
};

/** Opción terminada: nombre y valores; clic para editar. */
export function OptionSummary({ option, onEdit, disabled, dragProps }: SummaryProps) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      {...(disabled ? {} : dragProps)}
      sx={{ alignItems: 'flex-start', py: 1.5, '&[data-dragging]': { opacity: 0.5 } }}
    >
      {!disabled && <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled', cursor: 'grab', mt: 0.25 }} aria-hidden />}
      <Box
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? undefined : 0}
        onClick={disabled ? undefined : onEdit}
        onKeyDown={(e) => !disabled && (e.key === 'Enter' || e.key === ' ') && onEdit()}
        aria-label={disabled ? undefined : `Editar opción ${option.name}`}
        sx={{ flex: 1, cursor: disabled ? 'default' : 'pointer' }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
          {option.name}
        </Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
          {option.values.map((v) => (
            <Chip key={v.uid} size="small" label={v.name} />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
