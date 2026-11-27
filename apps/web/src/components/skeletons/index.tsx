import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography, { type TypographyProps } from '@mui/material/Typography';

// Placeholders de carga con la FORMA del contenido real (guía de MUI Skeleton): texto dentro de
// Typography (hereda su alto), "rounded" para campos/botones y filas de tabla. Se usan como
// fallback de <Suspense> en vez de un rectángulo que tapa toda la página.

/** Línea de texto con el alto de esa variante tipográfica. */
export function TextSkeleton({ variant = 'body2', width }: { variant?: TypographyProps['variant']; width?: number | string }) {
  return (
    <Typography variant={variant}>
      <Skeleton width={width} />
    </Typography>
  );
}

/** Título + descripción a la izquierda y botón de acción a la derecha. */
export function HeaderSkeleton({ title = 'h6', action = true }: { title?: TypographyProps['variant']; action?: boolean }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 2 }}>
      <Box sx={{ flex: 1, maxWidth: 420 }}>
        <TextSkeleton variant={title} width={160} />
        <TextSkeleton width="90%" />
      </Box>
      {action && <Skeleton variant="rounded" width={160} height={36} />}
    </Stack>
  );
}

/** Buscador (y filtros opcionales) sobre una tabla. */
export function ToolbarSkeleton({ filters = 0 }: { filters?: number }) {
  return (
    <Stack direction="row" spacing={1.5}>
      <Skeleton variant="rounded" width={280} height={40} />
      {Array.from({ length: filters }, (_, i) => (
        <Skeleton key={i} variant="rounded" width={150} height={40} />
      ))}
    </Stack>
  );
}

// Anchos fijos por columna (no aleatorios: el HTML del servidor y del cliente deben coincidir).
const CELL_WIDTHS = ['55%', '40%', '30%', '45%', '35%', '25%'];

/** Tabla con encabezados, filas (la primera columna con título y subtítulo) y paginación. */
export function TableSkeleton({ columns = 5, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow>
            {Array.from({ length: columns }, (_, c) => (
              <TableCell key={c}>
                <Skeleton width={c === 0 ? 90 : 70} />
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              {Array.from({ length: columns }, (_, c) =>
                c === 0 ? (
                  <TableCell key={c}>
                    <Skeleton width="70%" />
                    <Typography variant="caption" component="div">
                      <Skeleton width="40%" />
                    </Typography>
                  </TableCell>
                ) : (
                  <TableCell key={c}>
                    <Skeleton width={CELL_WIDTHS[(c + r) % CELL_WIDTHS.length]} />
                  </TableCell>
                ),
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Stack direction="row" spacing={3} sx={{ justifyContent: 'flex-end', alignItems: 'center', px: 2, py: 1.5 }}>
        <Skeleton width={140} />
        <Skeleton width={70} />
        <Skeleton variant="circular" width={24} height={24} />
        <Skeleton variant="circular" width={24} height={24} />
      </Stack>
    </Paper>
  );
}

/** Página de listado completa: cabecera + buscador/filtros + tabla. */
export function ListPageSkeleton({
  columns = 5,
  rows = 5,
  filters = 0,
  title = 'h6',
  action = true,
}: {
  columns?: number;
  rows?: number;
  filters?: number;
  title?: TypographyProps['variant'];
  action?: boolean;
}) {
  return (
    <Stack spacing={2} aria-busy="true" aria-label="Cargando">
      <HeaderSkeleton title={title} action={action} />
      <ToolbarSkeleton filters={filters} />
      <TableSkeleton columns={columns} rows={rows} />
    </Stack>
  );
}

/** Tarjeta con título y campos (formularios). */
function CardSkeleton({ fields = 2, tall = false }: { fields?: number; tall?: boolean }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <TextSkeleton variant="subtitle1" width={120} />
      <Stack spacing={2} sx={{ mt: 1.5 }}>
        {Array.from({ length: fields }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={tall && i === fields - 1 ? 130 : 56} />
        ))}
      </Stack>
    </Paper>
  );
}

/** Página de producto: cabecera, columna principal (tarjetas) y lateral. */
export function ProductFormSkeleton() {
  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }} aria-busy="true" aria-label="Cargando">
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 3 }}>
        <Skeleton variant="circular" width={36} height={36} />
        <Box sx={{ flex: 1 }}>
          <TextSkeleton variant="h5" width={240} />
        </Box>
        <Skeleton variant="rounded" width={100} height={36} />
      </Stack>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={2.5}>
            <CardSkeleton fields={2} tall />
            <CardSkeleton fields={2} />
            <CardSkeleton fields={1} />
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2.5}>
            <CardSkeleton fields={1} />
            <CardSkeleton fields={3} />
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

/** Resumen: saludo y tarjetas de indicadores. */
export function OverviewSkeleton() {
  return (
    <Stack spacing={3} aria-busy="true" aria-label="Cargando">
      <Box>
        <TextSkeleton variant="h5" width={220} />
        <TextSkeleton width={300} />
      </Box>
      <Grid container spacing={2}>
        {Array.from({ length: 4 }, (_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <Skeleton variant="circular" width={24} height={24} />
                  <Box sx={{ flex: 1 }}>
                    <TextSkeleton width="60%" />
                    <TextSkeleton variant="h5" width={40} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Skeleton variant="rounded" height={72} />
    </Stack>
  );
}

/** Formulario simple (login, registro, invitación): título y campos. */
export function AuthFormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <Stack spacing={2.5} aria-busy="true" aria-label="Cargando">
      <TextSkeleton variant="h6" width="60%" />
      {Array.from({ length: fields }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={56} />
      ))}
      <Skeleton variant="rounded" height={42} />
    </Stack>
  );
}

/** Solo el contenido de una pestaña: buscador y tabla (el encabezado de la página ya está visible). */
export function TableSectionSkeleton({ columns = 5, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <Stack spacing={2} aria-busy="true" aria-label="Cargando">
      <ToolbarSkeleton />
      <TableSkeleton columns={columns} rows={rows} />
    </Stack>
  );
}
/** Usuarios: tabla de miembros y tabla de invitaciones. */
export function UsersSkeleton() {
  return (
    <Stack spacing={4} aria-busy="true" aria-label="Cargando">
      <Stack spacing={2}>
        <HeaderSkeleton />
        <TableSkeleton columns={5} rows={3} />
      </Stack>
      <Stack spacing={2}>
        <HeaderSkeleton action={false} />
        <TableSkeleton columns={6} rows={2} />
      </Stack>
    </Stack>
  );
}

/** Estructura del dashboard (menú lateral + barra superior) mientras se valida la sesión en una carga completa. */
export function AppShellSkeleton() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh' }} aria-busy="true" aria-label="Cargando">
      <Box
        component="aside"
        sx={{ width: 248, flexShrink: 0, borderRight: 1, borderColor: 'divider', display: { xs: 'none', md: 'block' }, px: 2.5 }}
      >
        <Box sx={{ height: 64, display: 'flex', alignItems: 'center' }}>
          <TextSkeleton variant="subtitle1" width={150} />
        </Box>
        <Stack spacing={1.75} sx={{ mt: 1 }}>
          {Array.from({ length: 10 }, (_, i) => (
            <Stack key={i} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Skeleton variant="circular" width={20} height={20} />
              <Skeleton width={i % 3 === 0 ? 90 : 110} />
            </Stack>
          ))}
        </Stack>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ height: 64, px: 3, alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}
        >
          <Skeleton variant="rounded" width={220} height={40} />
          <Box sx={{ flex: 1 }} />
          <Skeleton variant="circular" width={36} height={36} />
        </Stack>
        <Box sx={{ p: 3 }}>
          <HeaderSkeleton title="h5" />
        </Box>
      </Box>
    </Box>
  );
}
