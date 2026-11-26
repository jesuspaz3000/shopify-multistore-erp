import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import theme from '@/theme/theme';
import AppProviders from '@/components/providers/AppProviders';
import './globals.css';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Shopify ERP',
    template: '%s | Shopify ERP',
  },
  description: 'Administra todas tus tiendas Shopify desde un solo panel.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // suppressHydrationWarning (solo afecta a los atributos de ESTE elemento, no a sus hijos):
    // - <html>: InitColorSchemeScript agrega la clase light/dark antes de hidratar (guía MUI).
    // - <body>: extensiones del navegador (ej. ColorZilla: cz-shortcut-listen) inyectan atributos.
    <html lang="es" className={roboto.className} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Debe ir antes del contenido para evitar el parpadeo de tema en SSR */}
        <InitColorSchemeScript attribute="class" />
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <AppProviders>{children}</AppProviders>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
