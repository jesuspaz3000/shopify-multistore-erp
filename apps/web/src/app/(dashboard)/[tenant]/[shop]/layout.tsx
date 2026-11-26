import { notFound } from 'next/navigation';
import { Suspense } from 'react';

// [shop] = "all" (vista consolidada) o el handle de una tienda del tenant.
// La validación de `params` va en un componente dentro de <Suspense> (no con await en el layout):
// así cambiar de tienda o de sección no queda bloqueado esperando al servidor (Next 16: instant navigation).
export default function ShopLayout({ children, params }: LayoutProps<'/[tenant]/[shop]'>) {
  return (
    <>
      <Suspense fallback={null}>
        <ShopGuard params={params} />
      </Suspense>
      {children}
    </>
  );
}

async function ShopGuard({ params }: { params: LayoutProps<'/[tenant]/[shop]'>['params'] }) {
  const { shop } = await params;
  // Por ahora no hay tiendas conectadas: solo "all" es válido.
  if (shop !== 'all') notFound();
  return null;
}
