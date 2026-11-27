import type { Metadata } from 'next';
import ComingSoon from '@/components/layout/ComingSoon';

export const metadata: Metadata = { title: 'Colecciones' };

export default function CollectionsPage() {
  return (
    <ComingSoon
      title="Colecciones"
      description="Agrupa productos para mostrarlos juntos en las tiendas."
      items={['Colecciones manuales: eliges los productos uno a uno.', 'Colecciones automáticas: por reglas (tipo, proveedor, etiqueta, precio…).', 'Publicación de cada colección en tus tiendas Shopify.']}
    />
  );
}