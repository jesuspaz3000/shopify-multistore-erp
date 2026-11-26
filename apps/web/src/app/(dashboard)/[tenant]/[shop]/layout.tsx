import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getTenantShops } from '@/features/shops/api/shops.server';

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
  const { tenant, shop } = await params;
  if (shop === 'all') return null;
  // Solo tiendas de la empresa visibles para el usuario (la API ya filtra por permisos).
  const shops = await getTenantShops(tenant);
  if (!shops.some((s) => s.handle === shop)) notFound();
  return null;
}
