import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/** Submódulo aún no construido: explica qué hará (en vez de una página vacía). */
export default function ComingSoon({ title, description, items }: { title: string; description: string; items: string[] }) {
  return (
    <Stack spacing={2.5}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Paper variant="outlined" sx={{ p: 4, borderStyle: 'dashed' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
          <ConstructionOutlinedIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Próximamente
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              {description}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary' }}>
              {items.map((item) => (
                <Typography key={item} component="li" variant="body2">
                  {item}
                </Typography>
              ))}
            </Box>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
