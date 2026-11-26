import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16: "proxy" reemplaza a "middleware" (runtime Node.js).
// Uso previsto: chequeo OPTIMISTA de sesión (cookie presente) para redirigir a /login.
// La autorización real (tenant, tiendas, permisos) se valida en la API y en los Server Components.
export function proxy(request: NextRequest) {
  void request;
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
