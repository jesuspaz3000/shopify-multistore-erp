'use client';

import MuiLink, { type LinkProps as MuiLinkProps } from '@mui/material/Link';
import NextLink from 'next/link';

// Enlace de texto con estilos de MUI y navegación del cliente de Next.js.
export default function TextLink({ href, ...props }: Omit<MuiLinkProps, 'href'> & { href: string }) {
  return <MuiLink component={NextLink} href={href} underline="hover" {...props} />;
}
