import { productsQuerySchema } from '@erp/contracts';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getProductsPage } from '@/features/products/api/products.server';
import ProductsTable from '@/features/products/components/ProductsTable';
import { can } from '@/features/tenant/permissions';
import { getMe } from '@/lib/session';
import { firstParam, readTableQuery } from '@/lib/table-query';

export const metadata: Metadata = { title: 'Productos' };

type Props = PageProps<'/[tenant]/[shop]/products'>;

export default function ProductsPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton variant="rounded" height={320} />}>
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

  const query = productsQuerySchema.parse({ ...readTableQuery(search), status: firstParam(search, 'status') });
  const page = await getProductsPage(tenant, query);

  return (
    <ProductsTable
      basePath={`/${tenant}/${shop}/products`}
      page={page}
      searchQuery={query.q}
      filtered={!!query.q || !!query.status}
      canWrite={can(membership, 'catalog:write')}
    />
  );
}
