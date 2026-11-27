import Alert from '@mui/material/Alert';
import { ProductFormSkeleton } from '@/components/skeletons';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getLocationOptions } from '@/features/locations/api/locations.server';
import { getProductFacets } from '@/features/products/api/products.server';
import ProductForm from '@/features/products/components/ProductForm';
import { can } from '@/features/tenant/permissions';
import { getMe } from '@/lib/session';

export const metadata: Metadata = { title: 'Nuevo producto' };

type Props = PageProps<'/[tenant]/[shop]/products/new'>;

export default function NewProductPage({ params }: Props) {
  return (
    <Suspense fallback={<ProductFormSkeleton />}>
      <NewProduct params={params} />
    </Suspense>
  );
}

async function NewProduct({ params }: Pick<Props, 'params'>) {
  const { tenant, shop } = await params;
  const me = await getMe();
  const membership = me?.memberships.find((m) => m.slug === tenant);
  if (!membership) notFound();
  if (!can(membership, 'catalog:write')) {
    return <Alert severity="info">Tu rol no permite crear productos.</Alert>;
  }

  const [locations, facets] = await Promise.all([getLocationOptions(tenant), getProductFacets(tenant)]);

  return (
    <ProductForm
      basePath={`/${tenant}/${shop}/products`}
      tenant={tenant}
      currency={membership.reportingCurrency}
      canWrite
      locations={can(membership, 'inventory:read') ? locations : []}
      facets={facets}
    />
  );
}
