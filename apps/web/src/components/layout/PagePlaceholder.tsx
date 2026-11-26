import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// Placeholder temporal para visualizar las rutas mientras se construyen las features.
export default function PagePlaceholder({ title, path }: { title: string; path: string }) {
  return (
    <Box component="main" sx={{ p: 4 }}>
      <Typography variant="h4" component="h1">
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
        {path}
      </Typography>
    </Box>
  );
}
