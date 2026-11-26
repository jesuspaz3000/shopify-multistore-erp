'use client';

import PagePlaceholder from '@/components/layout/PagePlaceholder';

// Error boundary de las vistas por tienda.
export default function ShopError() {
  return <PagePlaceholder title="No se pudo cargar esta vista" path="error" />;
}
