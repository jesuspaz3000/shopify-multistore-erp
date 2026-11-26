import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16: "proxy" reemplaza a "middleware" (runtime Node.js).
// Chequeo OPTIMISTA: solo mira si existe la cookie de sesión para evitar renderizar
// páginas privadas a visitantes sin sesión. La validación real la hace la API
// (getMe en el layout privado), porque la cookie puede existir y estar vencida.

const SESSION_COOKIE = 'erp_sid';
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/invite'];

const isPublic = (pathname: string) => PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isPublic(pathname) && !request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
