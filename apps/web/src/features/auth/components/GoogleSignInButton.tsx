import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';

// El login con Google se habilita cuando existan GOOGLE_CLIENT_ID/SECRET en el .env
// (el flujo OIDC vive en la API: /auth/google/login -> Google -> /auth/google/callback).
export default function GoogleSignInButton() {
  return (
    <>
      <Divider sx={{ color: 'text.secondary', typography: 'body2' }}>o</Divider>
      <Tooltip title="Disponible cuando se configuren las credenciales de Google">
        <span>
          <Button variant="outlined" size="large" fullWidth disabled>
            Continuar con Google
          </Button>
        </span>
      </Tooltip>
    </>
  );
}
