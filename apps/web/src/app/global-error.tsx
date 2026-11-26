'use client';

// Error boundary raíz: reemplaza al root layout, por eso define <html> y <body>.
export default function GlobalError() {
  return (
    <html lang="es">
      <body>
        <h1>Ocurrió un error inesperado</h1>
      </body>
    </html>
  );
}
