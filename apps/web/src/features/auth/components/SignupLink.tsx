import Typography from '@mui/material/Typography';
import TextLink from '@/components/ui/TextLink';
import { getAuthConfig } from '../api/auth-config.server';

/** Enlace "Crear cuenta": solo se muestra si la API tiene el registro público habilitado. */
export default async function SignupLink() {
  const { signupEnabled } = await getAuthConfig();
  if (!signupEnabled) return null;

  return (
    <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary' }}>
      ¿Tu empresa aún no tiene cuenta? <TextLink href="/register">Crear cuenta</TextLink>
    </Typography>
  );
}
