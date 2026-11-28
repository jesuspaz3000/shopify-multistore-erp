import { productsQuerySchema } from '@erp/contracts';
import Alert from '@mui/material/Alert';
import { ListPageSkeleton } from '@/components/skeletons';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getProductsPage } from '@/features/products/api/products.server';
import { getShopOptions } from '@/features/shops/api/shops.server';
import ProductsTable from '@/features/products/components/ProductsTable';
import { can } from '@/features/tenant/permissions';
import { getMe } from '@/lib/session';
import { firstParam, readTableQuery } from '@/lib/table-query';

export const metadata: Metadata = { title: 'Productos' };

type Props = PageProps<'/[tenant]/[shop]/products'>;

export default function ProductsPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<ListPageSkeleton title="h5" filters={1} columns={5} rows={6} />}>
      <ProductsSection params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ProductsSection({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  const [{ tenant, shop }, search] = await Promise.all([params, searchParams]);
  const me = await getMe();
  const membership = me?.memberships.find((m) => m.slug === tenant);
  if (!membership) notFound();
  if (!can(membership, 'catalog:read')) {
    return <Alert severity="info">Tu rol no permite ver el catálogo de productos.</Alert>;
  }

  // Una tienda elegida arriba: solo sus productos. "Todas las tiendas": el catálogo completo.
  const query = productsQuerySchema.parse({
    ...readTableQuery(search),
    status: firstParam(search, 'status'),
    shop: shop === 'all' ? undefined : shop,
  });
  const [page, shops] = await Promise.all([getProductsPage(tenant, query), getShopOptions(tenant)]);
  const currentShop = shops.find((s) => s.handle === shop);

  return (
    <ProductsTable
      tenant={tenant}
      basePath={`/${tenant}/${shop}/products`}
      page={page}
      shopName={currentShop?.name ?? null}
      searchQuery={query.q}
      status={query.status}
      filtered={!!query.q || !!query.status}
      canWrite={can(membership, 'catalog:write')}
    />
  );
}
