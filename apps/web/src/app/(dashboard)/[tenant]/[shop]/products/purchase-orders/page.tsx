import type { Metadata } from 'next';
import ComingSoon from '@/components/layout/ComingSoon';

export const metadata: Metadata = { title: 'Órdenes de compra' };

export default function PurchaseOrdersPage() {
  return (
    <ComingSoon
      title="Órdenes de compra"
      description="Registra lo que pides a tus proveedores y recíbelo en una bodega."
      items={['Proveedores y sus condiciones.', 'Órdenes con productos, cantidades y costos.', 'Recepción total o parcial: suma stock y queda en el kardex.']}
    />
  );
}