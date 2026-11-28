"use client";

import type { MediaDetailResponse } from "@erp/contracts";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import StarOutlineIcon from "@mui/icons-material/StarBorder";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/http";
import { getMedia, mediaSrc, renameMedia } from "../api/media.api";
import { mediaSummary } from "./media-format";
import type { MediaItem } from "./MediaSection";

type Props = {
  tenant: string;
  media: MediaItem[];
  /** Imagen abierta (posición en `media`). */
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** El texto alternativo es del producto: se guarda al guardar el producto. */
  onAltChange: (mediaId: number, alt: string | null) => void;
  onRemove: (mediaId: number) => void;
  onMakeMain: (mediaId: number) => void;
  disabled?: boolean;
};

const dateFormat = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Visor de una imagen del producto (como el de Shopify): la imagen grande a la izquierda y a la
 * derecha su información (nombre, texto alternativo, detalles y dónde se usa). Flechas para pasar
 * a la siguiente imagen.
 */
export default function MediaViewerDialog({
  tenant,
  media,
  index,
  onIndexChange,
  onClose,
  onAltChange,
  onRemove,
  onMakeMain,
  disabled,
}: Props) {
  const item = media[index];
  const [details, setDetails] = useState<Record<number, MediaDetailResponse>>(
    {},
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const detail = item ? details[item.id] : undefined;

  // Nombre y texto alternativo en edición (se reinician al cambiar de imagen: ver `key` abajo).
  const [name, setName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!item || details[item.id]) return;
    let cancelled = false;
    getMedia(tenant, item.id)
      .then((d) => !cancelled && setDetails((prev) => ({ ...prev, [d.id]: d })))
      .catch(
        (error) =>
          !cancelled &&
          setLoadError(
            error instanceof ApiError
              ? error.message
              : "No se pudo cargar la información",
          ),
      );
    return () => {
      cancelled = true;
    };
  }, [tenant, item, details]);

  const go = (next: number) => {
    if (next < 0 || next >= media.length) return;
    setName(null);
    setNameError(null);
    setLoadError(null);
    onIndexChange(next);
  };

  // Flechas del teclado (salvo escribiendo en un campo).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea")) return;
      if (event.key === "ArrowLeft") go(index - 1);
      if (event.key === "ArrowRight") go(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const saveName = async () => {
    if (!detail || name === null) return;
    const next = name.trim();
    if (next === detail.filename) {
      setName(null);
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      const saved = await renameMedia(tenant, detail.id, next);
      setDetails((prev) => ({ ...prev, [saved.id]: saved }));
      setName(null);
    } catch (error) {
      setNameError(
        error instanceof ApiError
          ? (error.fieldErrors.filename ?? error.message)
          : "No se pudo renombrar",
      );
    } finally {
      setSavingName(false);
    }
  };

  if (!item) return null;
  const arrow = {
    bgcolor: "background.paper",
    boxShadow: 2,
    "&:hover": { bgcolor: "background.paper" },
  };

  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      aria-label={`Imagen ${index + 1} de ${media.length}`}
      // El visor siempre en oscuro (como Shopify), aunque la app esté en modo claro.
      slotProps={{
        paper: {
          className: "dark",
          sx: {
            bgcolor: "#0b0b0c",
            color: "text.primary",
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          },
        },
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{ height: "100%", p: { xs: 1.5, md: 3 }, gap: 3, minHeight: 0 }}
      >
        {/* Imagen */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            component="img"
            key={item.id}
            src={mediaSrc(item.url)}
            alt={item.alt ?? ""}
            sx={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              display: "block",
              bgcolor: "#fff",
              borderRadius: 0.5,
            }}
          />
          {media.length > 1 && (
            <>
              <IconButton
                onClick={() => go(index - 1)}
                disabled={index === 0}
                aria-label="Imagen anterior"
                sx={{ ...arrow, position: "absolute", left: 8 }}
              >
                <ChevronLeftIcon />
              </IconButton>
              <IconButton
                onClick={() => go(index + 1)}
                disabled={index === media.length - 1}
                aria-label="Imagen siguiente"
                sx={{ ...arrow, position: "absolute", right: 8 }}
              >
                <ChevronRightIcon />
              </IconButton>
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  bottom: 8,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  bgcolor: "background.paper",
                  boxShadow: 1,
                }}
              >
                {index + 1} de {media.length}
              </Typography>
            </>
          )}
        </Box>

        {/* Panel */}
        <Stack
          spacing={1.5}
          sx={{ width: { md: 340 }, flexShrink: 0, overflowY: "auto" }}
        >
          <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
            <Tooltip title="Cerrar (Esc)">
              <IconButton
                onClick={onClose}
                aria-label="Cerrar visor"
                sx={arrow}
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", mb: 2 }}
            >
              <InfoOutlinedIcon fontSize="small" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Información
              </Typography>
            </Stack>

            {loadError ? (
              <Typography variant="body2" sx={{ color: "error.main" }}>
                {loadError}
              </Typography>
            ) : !detail ? (
              <Stack spacing={1} aria-label="Cargando información">
                <Skeleton height={56} />
                <Skeleton height={110} />
                <Skeleton width="60%" />
                <Skeleton width="40%" />
              </Stack>
            ) : (
              <Stack spacing={2} key={detail.id}>
                <TextField
                  label="Nombre"
                  size="small"
                  value={name ?? detail.filename}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => void saveName()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape" && name !== null) {
                      e.stopPropagation(); // Esc deshace el cambio sin cerrar el visor
                      setName(null);
                      setNameError(null);
                    }
                  }}
                  disabled={disabled || savingName}
                  error={!!nameError}
                  helperText={
                    nameError ?? (savingName ? "Guardando…" : undefined)
                  }
                  fullWidth
                  slotProps={{
                    htmlInput: { maxLength: 255, spellCheck: false },
                  }}
                />
                <TextField
                  key={`alt-${item.id}`}
                  label="Texto alternativo"
                  size="small"
                  multiline
                  minRows={4}
                  defaultValue={item.alt ?? ""}
                  onBlur={(e) => {
                    const alt = e.target.value.trim() || null;
                    if (alt !== item.alt) onAltChange(item.id, alt);
                  }}
                  disabled={disabled}
                  helperText="Describe la imagen para lectores de pantalla y buscadores. Se guarda con el producto."
                  fullWidth
                  slotProps={{ htmlInput: { maxLength: 512 } }}
                />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Detalles
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {mediaSummary(detail)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Agregado el {dateFormat.format(new Date(detail.createdAt))}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Usado en
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {detail.usage.products > 0
                      ? `Productos (${detail.usage.products})`
                      : "Aún en ningún producto guardado"}
                  </Typography>
                </Box>
              </Stack>
            )}
          </Paper>

          {!disabled && (
            <Paper
              variant="outlined"
              sx={{ borderRadius: 3, overflow: "hidden" }}
            >
              {index > 0 && (
                <Button
                  fullWidth
                  color="inherit"
                  startIcon={<StarOutlineIcon />}
                  onClick={() => {
                    onMakeMain(item.id);
                    go(0);
                  }}
                  sx={{ justifyContent: "flex-start", px: 2, py: 1.25 }}
                >
                  Usar como imagen principal
                </Button>
              )}
              <Button
                fullWidth
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => {
                  onRemove(item.id);
                  if (media.length === 1) onClose();
                  else if (index === media.length - 1) go(index - 1);
                }}
                sx={{ justifyContent: "flex-start", px: 2, py: 1.25 }}
              >
                Quitar del producto
              </Button>
            </Paper>
          )}
        </Stack>
      </Stack>
    </Dialog>
  );
}
