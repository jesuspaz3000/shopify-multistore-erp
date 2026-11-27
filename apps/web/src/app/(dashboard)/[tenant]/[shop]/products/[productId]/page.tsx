import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getProduct } from '@/features/products/api/products.server';
import ProductForm from '@/features/products/components/ProductForm';
import { can } from '@/features/tenant/permissions';
import { getMe } from '@/lib/session';

export const metadata: Metadata = { title: 'Producto' };

type Props = PageProps<'/[tenant]/[shop]/products/[productId]'>;

export default function ProductDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton variant="rounded" height={420} />}>
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

  const product = await getProduct(tenant, productId);
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
    />
  );
}
