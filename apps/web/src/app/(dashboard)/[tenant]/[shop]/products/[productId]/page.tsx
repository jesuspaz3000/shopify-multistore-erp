import Alert from '@mui/material/Alert';
import { ProductFormSkeleton } from '@/components/skeletons';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getLocationOptions } from '@/features/locations/api/locations.server';
import { getProduct, getProductFacets } from '@/features/products/api/products.server';
import ProductForm from '@/features/products/components/ProductForm';
import { can } from '@/features/tenant/permissions';
import { getMe } from '@/lib/session';

export const metadata: Metadata = { title: 'Producto' };

type Props = PageProps<'/[tenant]/[shop]/products/[productId]'>;

export default function ProductDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<ProductFormSkeleton />}>
      <ProductDetail params={params} />
    </Suspense>
  );
}

async function ProductDetail({ params }: Pick<Props, 'params'>) {
  const { tenant, shop, productId } = await params;
  const me = await getMe();
  const membership = me?.memberships.find((m) => m.slug === tenant);
  if (!membership) notFound();
  if (!can(membership, 'catalog:read')) {
    return <Alert severity="info">Tu rol no permite ver el catálogo de productos.</Alert>;
  }

  const canSeeStock = can(membership, 'inventory:read');
  const [product, locations, facets] = await Promise.all([
    getProduct(tenant, productId),
    canSeeStock ? getLocationOptions(tenant) : Promise.resolve([]),
    getProductFacets(tenant),
  ]);
  if (!product) notFound();

  return (
    <ProductForm
      // Otra versión (guardada aquí o por otra persona) = formulario nuevo con esos datos.
      key={`${product.id}-${product.version}`}
      basePath={`/${tenant}/${shop}/products`}
      tenant={tenant}
      product={product}
      currency={product.currency}
      canWrite={can(membership, 'catalog:write')}
      locations={locations}
      facets={facets}
    />
  );
}
